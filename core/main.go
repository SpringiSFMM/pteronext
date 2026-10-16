package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/pteronext/panel-core/cli"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/database"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/routes"
	"github.com/pteronext/panel-core/services"
)

const banner = `
=====================================================================
    ____  __                     _   __          __ 
   / __ \/ /____  _________     / | / /__  _  __/ /_
  / /_/ / __/ _ \/ ___/ __ \   /  |/ / _ \| |/_/ __/
 / ____/ /_/  __/ /  / /_/ /  / /|  /  __/>  </ /_  
/_/    \__/\___/_/   \____/  /_/ |_/\___/_/|_|\__/  
       P T E R O N E X T   C O R E   B A C K E N D
=====================================================================
  High-Performance, Lightweight Go Core for Next-Gen Pterodactyl
`

func main() {
	// Subcommand dispatcher (supports 'pteronext update [options]' and 'pteronext version')
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "update", "-update", "--update":
			cfg := config.Load()
			if err := cli.RunUpdate(os.Args[1:], cfg.DBPath); err != nil {
				if err == flag.ErrHelp {
					os.Exit(0)
				}
				log.Fatalf("[FATAL] Update fehlgeschlagen: %v", err)
			}
			os.Exit(0)
		case "version", "-v", "--version":
			fmt.Printf("PteroNext Panel Core Backend %s (%s/%s)\n", cli.CurrentVersion, runtime.GOOS, runtime.GOARCH)
			os.Exit(0)
		}
	}

	// Parse CLI flags
	portFlag := flag.Int("port", 0, "HTTP server port (default from env or 8080)")
	hostFlag := flag.String("host", "", "HTTP server bind address (default 0.0.0.0)")
	dbFlag := flag.String("db", "", "SQLite database file path")
	dataFlag := flag.String("data", "", "Data directory for database and storage")
	secretFlag := flag.String("jwt-secret", "", "JWT secret string")
	skipSeedFlag := flag.Bool("no-seed", false, "Skip seeding default data")
	reset2FAFlag := flag.String("reset-2fa", "", "Emergency reset 2FA for a given username or email")
	updateFlag := flag.Bool("update", false, "Panel sicher aktualisieren (Zero Data Loss: automatischer DB-Snapshot, keine Server-/DB-Veränderung)")
	versionFlag := flag.Bool("version", false, "PteroNext Versionsinformation anzeigen")

	flag.Usage = func() {
		fmt.Printf("PteroNext Panel Core %s (%s/%s)\n\n", cli.CurrentVersion, runtime.GOOS, runtime.GOARCH)
		fmt.Println("Verwendung:")
		fmt.Println("  pteronext [Optionen]               Startet den Web- & API-Server")
		fmt.Println("  pteronext update [Optionen]        Aktualisiert das Panel sicher ohne Datenverlust")
		fmt.Println("  pteronext -update [Optionen]       (Alternative Syntax für das CLI-Update)")
		fmt.Println("  pteronext -reset-2fa <user/email>  Setzt 2FA im Notfall für einen Benutzer zurück")
		fmt.Println("  pteronext -version                 Zeigt die installierte Version an")
		fmt.Println()
		fmt.Println("Optionen für 'pteronext update':")
		fmt.Println("  --check        Nur auf Updates prüfen, keine Änderungen vornehmen")
		fmt.Println("  --force        Update auch installieren, wenn Version bereits aktuell ist")
		fmt.Println("  --dry-run      Trockenlauf: Zeigt Aktionen ohne Dateiveränderungen")
		fmt.Println("  --db <pfad>    Pfad zur pteronext.db für den Sicherheits-Snapshot")
		fmt.Println("  --no-restart   Dienst nach dem Update nicht automatisch neu starten")
		fmt.Println()
		fmt.Println("Server-Optionen:")
		flag.PrintDefaults()
	}

	flag.Parse()

	// Handle flag-based update invocation (-update)
	if *updateFlag {
		cfg := config.Load()
		if *dbFlag != "" {
			cfg.DBPath = *dbFlag
		}
		if err := cli.RunUpdate(os.Args[1:], cfg.DBPath); err != nil {
			if err == flag.ErrHelp {
				os.Exit(0)
			}
			log.Fatalf("[FATAL] Update fehlgeschlagen: %v", err)
		}
		os.Exit(0)
	}

	// Handle version flag (-version)
	if *versionFlag {
		fmt.Printf("PteroNext Panel Core Backend %s (%s/%s)\n", cli.CurrentVersion, runtime.GOOS, runtime.GOARCH)
		os.Exit(0)
	}

	fmt.Print(banner)

	// Load configuration
	cfg := config.Load()
	if *portFlag > 0 {
		cfg.HTTPPort = *portFlag
	}
	if *hostFlag != "" {
		cfg.HTTPHost = *hostFlag
	}
	if *dataFlag != "" {
		if err := os.MkdirAll(*dataFlag, 0755); err == nil {
			cfg.DBPath = filepath.Join(*dataFlag, "pteronext.db")
		}
	}
	if *dbFlag != "" {
		cfg.DBPath = *dbFlag
	}
	if *secretFlag != "" {
		cfg.JWTSecret = *secretFlag
	}

	// Initialize Database with WAL mode
	db, err := database.InitDB(cfg.DBPath, cfg.Debug)
	if err != nil {
		log.Fatalf("[FATAL] Database initialization failed: %v", err)
	}

	// Handle emergency 2FA reset if requested
	if *reset2FAFlag != "" {
		target := strings.TrimSpace(*reset2FAFlag)
		var targetUser models.User
		if err := db.Where("LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)", target, target).First(&targetUser).Error; err != nil {
			log.Fatalf("[RESET-2FA ERROR] User '%s' not found in database: %v", target, err)
		}
		if err := db.Model(&targetUser).Updates(map[string]interface{}{
			"two_factor_enabled": false,
			"two_factor_secret":  "",
			"recovery_codes":     "",
		}).Error; err != nil {
			log.Fatalf("[RESET-2FA ERROR] Failed resetting 2FA: %v", err)
		}
		log.Printf("[RESET-2FA SUCCESS] Two-factor authentication successfully disabled for user '%s' (%s).", targetUser.Username, targetUser.Email)
		os.Exit(0)
	}

	log.Printf("[CORE] Starting PteroNext Panel Core backend on %s:%d (env: %s)...", cfg.HTTPHost, cfg.HTTPPort, cfg.AppEnv)

	// Auto-migrate schema
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("[FATAL] Auto-migration failed: %v", err)
	}

	// Seed database if not skipped
	if !*skipSeedFlag {
		if err := database.SeedDatabase(db); err != nil {
			log.Printf("[WARN] Seeding warning: %v", err)
		}
		if err := database.LoadOfficialEggs(db); err != nil {
			log.Printf("[WARN] Egg loading warning: %v", err)
		}
	}

	// Auto-heal Node configuration in DB for Wings connectivity
	var defaultNode models.Node
	if err := db.First(&defaultNode, 1).Error; err == nil {
		nodeUpdates := map[string]interface{}{}
		if defaultNode.Scheme != "https" {
			nodeUpdates["scheme"] = "https"
		}
		if defaultNode.FQDN == "127.0.0.1" || defaultNode.FQDN == "localhost" || defaultNode.FQDN == "" {
			nodeUpdates["fqdn"] = "wings.springisfm.de"
		}
		if defaultNode.DaemonListenPort <= 0 {
			nodeUpdates["daemon_listen_port"] = 8080
		}
		if len(nodeUpdates) > 0 {
			db.Model(&defaultNode).Updates(nodeUpdates)
			log.Printf("[CORE] Auto-repaired default Node 1 settings: %v", nodeUpdates)
		}
	}

	// Initialize services
	authService := services.NewAuthService(db, cfg)
	serverService := services.NewServerService(db)
	wingsClient := services.NewWingsClient()
	wsHub := services.NewWebSocketHub(wingsClient, db)
	auditService := services.NewAuditService(db)
	statsService := services.NewStatsService(db, cfg.DBPath)
	fileService := services.NewFileService(db, filepath.Dir(cfg.DBPath))
	webhookService := services.NewWebhookService(db)
	backupService := services.NewBackupService(db, fileService, webhookService, filepath.Dir(cfg.DBPath))
	scannerService := services.NewSecurityScannerService()
	discordBotService := services.NewDiscordBotService(db, wingsClient)
	discordBotService.Start()

	// Setup Router & Middleware
	router := routes.SetupRouter(
		cfg,
		db,
		authService,
		serverService,
		wingsClient,
		wsHub,
		auditService,
		statsService,
		fileService,
		backupService,
		webhookService,
		scannerService,
		discordBotService,
	)

	// HTTP Server with graceful shutdown
	addr := fmt.Sprintf("%s:%d", cfg.HTTPHost, cfg.HTTPPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in background goroutine
	go func() {
		log.Printf("[HTTP] Server listening on http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP server error: %v", err)
		}
	}()

	// Wait for OS interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[CORE] Shutting down PteroNext server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[WARN] Server forced to shutdown: %v", err)
	}

	if err := database.Close(db); err != nil {
		log.Printf("[WARN] Database close error: %v", err)
	}

	log.Println("[CORE] PteroNext gracefully stopped.")
}
