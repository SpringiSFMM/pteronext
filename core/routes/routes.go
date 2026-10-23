package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/controllers"
	"github.com/pteronext/panel-core/controllers/remote"
	"github.com/pteronext/panel-core/database"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/pkg/web"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// SetupRouter initializes the Gin router, registers all routes, middleware, and controllers.
func SetupRouter(
	cfg *config.Config,
	db *gorm.DB,
	authService *services.AuthService,
	serverService *services.ServerService,
	wingsClient *services.WingsClient,
	wsHub *services.WebSocketHub,
	auditService *services.AuditService,
	statsService *services.StatsService,
	fileService *services.FileService,
	backupService *services.BackupService,
	webhookService *services.WebhookService,
	scannerService *services.SecurityScannerService,
	discordBotService *services.DiscordBotService,
) *gin.Engine {
	if !cfg.Debug {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.SetupCORS(cfg.AllowOrigin))

	// Health endpoint
	router.GET("/health", func(c *gin.Context) {
		if err := database.CheckHealth(db); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "db": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "app": "pteronext-core"})
	})

	accountCtrl := controllers.NewAccountController(db, auditService)

	// Public system telemetry, global theme, and setup onboarding endpoints
	statsCtrl := controllers.NewStatsController(statsService, wingsClient, db)
	router.GET("/api/system/stats", statsCtrl.GetSystemStats)
	router.GET("/api/theme/global", accountCtrl.GetGlobalTheme)
	router.GET("/api/system/health/watchdog", statsCtrl.WatchdogHealth)

	changelogCtrl := controllers.NewChangelogController()
	router.GET("/api/system/changelog", changelogCtrl.GetChangelog)

	systemUpdateCtrl := controllers.NewSystemUpdateController()
	router.GET("/api/system/updates/check", systemUpdateCtrl.CheckUpdate)

	discordCtrl := controllers.NewDiscordController(db, authService, discordBotService)
	router.GET("/api/auth/discord/status", discordCtrl.GetPublicStatus)
	router.GET("/api/auth/discord/login", discordCtrl.DiscordLogin)
	router.GET("/api/auth/discord/redirect", discordCtrl.DiscordLogin)
	router.GET("/api/auth/discord/callback", discordCtrl.DiscordCallback)
	router.GET("/api/discord/users/:discord_id", discordCtrl.GetUserByDiscordID)

	setupCtrl := controllers.NewSetupController(db, cfg, authService)
	router.GET("/api/system/setup-status", setupCtrl.GetSetupStatus)
	router.POST("/api/system/setup", setupCtrl.CompleteSetup)

	// Auth controller
	authCtrl := controllers.NewAuthController(db, authService)
	router.POST("/api/auth/login", authCtrl.Login)
	router.POST("/api/auth/register", authCtrl.Register)

	// Server, Node, Schedule, Database, APIKey, Audit, and WebSocket controllers
	serverCtrl := controllers.NewServerController(db, serverService, wingsClient, wsHub, auditService, webhookService, fileService)
	nodeCtrl := controllers.NewNodeController(db, cfg)
	schedCtrl := controllers.NewScheduleController(db)
	dbCtrl := controllers.NewDatabaseController(db)
	apiKeyCtrl := controllers.NewAPIKeyController(db)
	auditCtrl := controllers.NewAuditController(db)
	wsCtrl := controllers.NewWebSocketController(wsHub)
	nestCtrl := controllers.NewNestController(db)
	userAdminCtrl := controllers.NewUserAdminController(db)
	backupCtrl := controllers.NewBackupController(backupService)
	webhookCtrl := controllers.NewWebhookController(db, webhookService)

	// Advanced Controllers: Players, Network, Sidecars, Security, Incident, Crash, DNS, Diagnostics, Automation, Migration, Reverse-Proxy
	playerCtrl := controllers.NewPlayerController(db, wingsClient, wsHub, cfg.DBPath)
	networkCtrl := controllers.NewNetworkController(db)
	sidecarCtrl := controllers.NewSidecarController(db, cfg.DBPath)
	incidentCtrl := controllers.NewIncidentController(db, wingsClient, wsHub, webhookService)
	securityCtrl := controllers.NewSecurityController(scannerService, cfg.DBPath)
	crashCtrl := controllers.NewCrashController(db, wingsClient, webhookService)
	dnsCtrl := controllers.NewDNSController(db, wsHub)
	diagnosticsCtrl := controllers.NewDiagnosticsController(db, wingsClient)
	automationCtrl := controllers.NewAutomationController(db)
	migrationCtrl := controllers.NewMigrationController(db)
	reverseProxyCtrl := controllers.NewReverseProxyController(db)
	importerCtrl := controllers.NewImporterController(db, wingsClient)

	// Webhook notification endpoint for DNS Relay Micro-Service (no user session cookie required)
	router.POST("/api/servers/:uuid/dns/notify", dnsCtrl.HandleRelayRevocationNotification)

	// -------------------------------------------------------------
	// Wings Remote API (/api/remote/*) - Protected by DaemonAuth
	// -------------------------------------------------------------
	remoteGroup := router.Group("/api/remote")
	remoteGroup.Use(middleware.DaemonAuthenticate(db))
	{
		serverRemoteCtrl := remote.NewServerRemoteController(db, serverService)
		activityRemoteCtrl := remote.NewActivityRemoteController(db, auditService, webhookService)
		installRemoteCtrl := remote.NewInstallRemoteController(db)
		backupRemoteCtrl := remote.NewBackupRemoteController(db, auditService)
		sftpRemoteCtrl := remote.NewSftpRemoteController(db)

		// Servers
		remoteGroup.GET("/servers", serverRemoteCtrl.ListServers)
		remoteGroup.POST("/servers/reset", serverRemoteCtrl.ResetServersState)
		remoteGroup.GET("/servers/:uuid", serverRemoteCtrl.GetServerDetails)

		// Activity
		remoteGroup.POST("/activity", activityRemoteCtrl.PostActivity)

		// Install
		remoteGroup.GET("/servers/:uuid/install", installRemoteCtrl.GetInstallData)
		remoteGroup.POST("/servers/:uuid/install", installRemoteCtrl.PostInstallData)

		// Backups
		remoteGroup.GET("/backups/:backup", backupRemoteCtrl.GetBackupRemoteUpload)
		remoteGroup.POST("/backups/:backup", backupRemoteCtrl.PostBackupStatus)
		remoteGroup.POST("/backups/:backup/restore", backupRemoteCtrl.PostBackupRestore)

		// SFTP
		remoteGroup.POST("/sftp/auth", sftpRemoteCtrl.AuthenticateSFTP)
	}

	// -------------------------------------------------------------
	// Panel Authenticated REST & WebSocket API (/api/*)
	// -------------------------------------------------------------
	apiGroup := router.Group("/api")
	apiGroup.Use(middleware.AuthenticateUser(authService))
	{
		apiGroup.GET("/auth/me", authCtrl.Me)

		// Server management
		apiGroup.GET("/servers", serverCtrl.ListServers)
		apiGroup.POST("/servers", serverCtrl.CreateServer)

		serverAccess := apiGroup.Group("/servers/:uuid")
		serverAccess.Use(middleware.RequireServerAccess(db, ""))
		{
			serverAccess.GET("", serverCtrl.GetServer)
			serverAccess.PATCH("", serverCtrl.UpdateServer)
			serverAccess.DELETE("", serverCtrl.DeleteServer)
			serverAccess.POST("/reinstall", serverCtrl.ReinstallServer)
			serverAccess.POST("/power", serverCtrl.PowerAction)
			serverAccess.POST("/command", serverCtrl.SendCommand)
			serverAccess.POST("/commands", serverCtrl.SendCommand)
			serverAccess.GET("/resources", statsCtrl.GetServerResources)
			serverAccess.GET("/ws", wsCtrl.ConnectConsole)

			// Schedules
			serverAccess.GET("/schedules", schedCtrl.ListSchedules)
			serverAccess.POST("/schedules", schedCtrl.CreateSchedule)
			serverAccess.DELETE("/schedules/:id", schedCtrl.DeleteSchedule)

			// Databases
			serverAccess.GET("/databases", dbCtrl.ListDatabases)
			serverAccess.POST("/databases", dbCtrl.CreateDatabase)
			serverAccess.DELETE("/databases/:id", dbCtrl.DeleteDatabase)

			// Subusers (Granular Staff & Team Access)
			subuserCtrl := controllers.NewSubuserController(db)
			serverAccess.GET("/subusers", subuserCtrl.ListSubusers)
			serverAccess.POST("/subusers", subuserCtrl.CreateSubuser)
			serverAccess.PUT("/subusers/:id", subuserCtrl.UpdateSubuser)
			serverAccess.DELETE("/subusers/:id", subuserCtrl.DeleteSubuser)

			// Files (Filesystem persistence on node)
			fileCtrl := controllers.NewFileController(fileService, db)
			serverAccess.GET("/files/list", fileCtrl.ListFiles)
			serverAccess.GET("/files/contents", fileCtrl.GetFileContent)
			serverAccess.POST("/files/write", fileCtrl.WriteFileContent)
			serverAccess.POST("/files/upload", fileCtrl.UploadFiles)
			serverAccess.POST("/files/delete", fileCtrl.DeleteFiles)
			serverAccess.POST("/files/create-directory", fileCtrl.CreateDirectory)
			serverAccess.PUT("/files/rename", fileCtrl.RenameFile)
			serverAccess.POST("/files/install-version", fileCtrl.InstallVersion)
			serverAccess.POST("/files/download-remote", fileCtrl.DownloadRemote)
			serverAccess.POST("/files/compress", fileCtrl.CompressFiles)
			serverAccess.POST("/files/decompress", fileCtrl.DecompressFile)

			// File-Time-Machine (Mikro-Snapshots & Revisions)
			serverAccess.GET("/files/revisions", fileCtrl.ListFileRevisions)
			serverAccess.GET("/files/revisions/:id", fileCtrl.GetFileRevision)
			serverAccess.POST("/files/revisions/:id/restore", fileCtrl.RestoreFileRevision)

			// Backups (Fast tar.gz, AES-256 encrypted, selective restore, auto-rotation)
			serverAccess.GET("/backups", backupCtrl.ListBackups)
			serverAccess.POST("/backups", backupCtrl.CreateBackup)
			serverAccess.POST("/backups/rotate", backupCtrl.RotateBackups)
			serverAccess.GET("/backups/config", backupCtrl.GetConfig)
			serverAccess.POST("/backups/config", backupCtrl.UpdateConfig)
			serverAccess.DELETE("/backups/:id", backupCtrl.DeleteBackup)
			serverAccess.POST("/backups/:id/lock", backupCtrl.ToggleLock)
			serverAccess.POST("/backups/:id/restore", backupCtrl.RestoreFull)
			serverAccess.POST("/backups/:id/restore-file", backupCtrl.RestoreFile)
			serverAccess.GET("/backups/:id/contents", backupCtrl.GetContents)
			serverAccess.GET("/backups/:id/download", backupCtrl.DownloadBackup)

			// Webhooks (Discord & Slack Event Automation)
			serverAccess.GET("/webhooks", webhookCtrl.ListWebhooks)
			serverAccess.POST("/webhooks", webhookCtrl.CreateWebhook)
			serverAccess.DELETE("/webhooks/:id", webhookCtrl.DeleteWebhook)
			serverAccess.POST("/webhooks/:id/test", webhookCtrl.TestWebhook)

			// Smart Webhook-Trigger & Event-Chains (No-Code Automation)
			serverAccess.GET("/automation/triggers", automationCtrl.ListTriggers)
			serverAccess.POST("/automation/triggers", automationCtrl.CreateTrigger)
			serverAccess.PUT("/automation/triggers/:id", automationCtrl.UpdateTrigger)
			serverAccess.DELETE("/automation/triggers/:id", automationCtrl.DeleteTrigger)
			serverAccess.POST("/automation/triggers/:id/test", automationCtrl.TestTrigger)

			// Player- & Community-Dashboard
			serverAccess.GET("/players", playerCtrl.GetPlayers)
			serverAccess.POST("/players/kick", playerCtrl.KickPlayer)
			serverAccess.POST("/players/ban", playerCtrl.BanPlayer)
			serverAccess.POST("/players/unban", playerCtrl.UnbanPlayer)
			serverAccess.POST("/players/op", playerCtrl.ToggleOp)
			serverAccess.POST("/players/whitelist", playerCtrl.ToggleWhitelist)
			serverAccess.POST("/players/teleport", playerCtrl.TeleportPlayer)
			serverAccess.POST("/players/chat", playerCtrl.SendWebChat)
			serverAccess.GET("/players/bans", playerCtrl.GetBans)
			serverAccess.POST("/players/unban-ip", playerCtrl.UnbanIP)

			// Port- & Netzwerk-Manager
			serverAccess.GET("/network", networkCtrl.GetNetwork)
			serverAccess.POST("/network/assign", networkCtrl.AssignAllocation)
			serverAccess.POST("/network/set-primary", networkCtrl.SetPrimary)
			serverAccess.PATCH("/network/:id/notes", networkCtrl.UpdateNotes)
			serverAccess.DELETE("/network/:id", networkCtrl.DeleteAllocation)
			serverAccess.GET("/network/preflight", networkCtrl.PreflightCheck)
			serverAccess.POST("/network/auto-remap", networkCtrl.AutoRemapPort)

			// Integrierter Reverse-Proxy & Web-SSL Manager (Caddy/Traefik)
			serverAccess.GET("/reverse-proxy", reverseProxyCtrl.ListProxies)
			serverAccess.POST("/reverse-proxy", reverseProxyCtrl.CreateProxy)
			serverAccess.DELETE("/reverse-proxy/:id", reverseProxyCtrl.DeleteProxy)

			// MSPT-/TPS-Heatmap, Entity- & Tile-Radar, Automatischer Lag-Dump
			serverAccess.GET("/diagnostics/tps-heatmap", diagnosticsCtrl.GetTpsHeatmap)
			serverAccess.GET("/diagnostics/radar", diagnosticsCtrl.GetRadar)
			serverAccess.GET("/diagnostics/lag-dumps", diagnosticsCtrl.GetLagDumps)
			serverAccess.POST("/diagnostics/lag-dumps/trigger", diagnosticsCtrl.TriggerLagDump)

			// Multi-Node Live-Migration (Streaming ohne Ausfallzeit)
			serverAccess.GET("/migration/status", migrationCtrl.GetStatus)
			serverAccess.POST("/migration/start", migrationCtrl.StartMigration)
			serverAccess.POST("/migration/cancel", migrationCtrl.CancelMigration)

			// Integrierte Container-Sidecars (Redis, Postgres, SQLite) & Web-DB-Viewer
			serverAccess.GET("/sidecars", sidecarCtrl.ListSidecars)
			serverAccess.POST("/sidecars", sidecarCtrl.CreateSidecar)
			serverAccess.DELETE("/sidecars/:id", sidecarCtrl.DeleteSidecar)
			serverAccess.POST("/sidecars/:id/inject", sidecarCtrl.InjectCredentials)
			serverAccess.GET("/sidecars/tables", sidecarCtrl.GetWebDBTables)
			serverAccess.POST("/sidecars/query", sidecarCtrl.QueryWebDB)

			// Sicherheits-Scan & Malicious Code Detection
			serverAccess.POST("/security/scan-jar", securityCtrl.ScanJar)
			serverAccess.GET("/security/summary", securityCtrl.GetSummary)

			// Multi-User Presence & Incident-Modus (Freeze / Safe Mode)
			serverAccess.GET("/incident/status", incidentCtrl.GetStatus)
			serverAccess.POST("/incident/freeze", incidentCtrl.ToggleFreeze)
			serverAccess.GET("/presence", incidentCtrl.GetPresence)
			serverAccess.POST("/presence", incidentCtrl.PostPresence)

			// Server-scoped Audit Feed
			serverAccess.GET("/audit", auditCtrl.ListServerAuditLogs)

			// Server Resource Auto-Scaler / Sleep Mode
			serverAccess.GET("/sleep-mode", serverCtrl.GetSleepMode)
			serverAccess.POST("/sleep-mode", serverCtrl.UpdateSleepMode)

			// Intelligent Crash-Analyzer mit 1-Klick-Lösung
			serverAccess.GET("/crash-analysis", crashCtrl.AnalyzeCrash)
			serverAccess.POST("/crash-fix", crashCtrl.ExecuteCrashFix)

			// Zero-Config Cloudflare DNS- & SRV-Automation
			serverAccess.GET("/dns", dnsCtrl.ListServerDomains)
			serverAccess.POST("/dns", dnsCtrl.CreateServerDomain)
			serverAccess.DELETE("/dns/:id", dnsCtrl.DeleteServerDomain)
			serverAccess.GET("/notifications", dnsCtrl.GetServerNotifications)
			serverAccess.POST("/notifications/:id/dismiss", dnsCtrl.DismissServerNotification)

			// Instant Server-Klon / 1-Klick-Staging
			serverAccess.POST("/clone", serverCtrl.CloneServer)

			// Canvas-basierter Minecraft Region- & World-Viewer (.mca Anvil Chunks)
			worldRegionCtrl := controllers.NewWorldRegionController(db)
			serverAccess.GET("/world/meta", worldRegionCtrl.GetWorldMeta)
			serverAccess.GET("/world/region", worldRegionCtrl.GetRegionData)

			// Auto-Updater für Cores (Paper, Purpur, Velocity) & Plugins mit Nightly-Cron & Auto-Revert
			autoUpdateCtrl := controllers.NewAutoUpdateController(db, fileService, wingsClient)
			serverAccess.GET("/auto-updater", autoUpdateCtrl.GetConfig)
			serverAccess.POST("/auto-updater", autoUpdateCtrl.UpdateConfig)
			serverAccess.POST("/auto-updater/trigger", autoUpdateCtrl.TriggerNightlyUpdate)

			// Smart SFTP- & Access-Key-Manager (Temporäre Gast-Keys, TTL, IP-Whitelisting)
			sftpKeyCtrl := controllers.NewSftpKeyController(db)
			serverAccess.GET("/sftp-keys", sftpKeyCtrl.ListKeys)
			serverAccess.POST("/sftp-keys", sftpKeyCtrl.CreateKey)
			serverAccess.DELETE("/sftp-keys/:id", sftpKeyCtrl.DeleteKey)

			// Developer Suite (.env Secret Vault, Git Auto-Deploy Webhook, Package Manager)
			developerCtrl := controllers.NewDeveloperController(db, fileService, wingsClient)
			serverAccess.GET("/env", developerCtrl.GetEnv)
			serverAccess.POST("/env", developerCtrl.SaveEnv)
			serverAccess.POST("/deploy/webhook", developerCtrl.DeployWebhook)
			serverAccess.POST("/deploy/run-pkg", developerCtrl.RunPkg)
		}

		// Node management (Admin only)
		nodesGroup := apiGroup.Group("/nodes")
		nodesGroup.Use(middleware.RequireAdmin())
		{
			nodesGroup.GET("", nodeCtrl.ListNodes)
			nodesGroup.POST("", nodeCtrl.CreateNode)
			nodesGroup.GET("/:id", nodeCtrl.GetNode)
			nodesGroup.PATCH("/:id", nodeCtrl.UpdateNode)
			nodesGroup.DELETE("/:id", nodeCtrl.DeleteNode)
			nodesGroup.GET("/:id/configuration", nodeCtrl.GetConfiguration)
		}

		adminNodesGroup := apiGroup.Group("/admin/nodes")
		adminNodesGroup.Use(middleware.RequireAdmin())
		{
			adminNodesGroup.GET("", nodeCtrl.ListNodes)
			adminNodesGroup.POST("", nodeCtrl.CreateNode)
			adminNodesGroup.GET("/:id", nodeCtrl.GetNode)
			adminNodesGroup.PATCH("/:id", nodeCtrl.UpdateNode)
			adminNodesGroup.DELETE("/:id", nodeCtrl.DeleteNode)
			adminNodesGroup.GET("/:id/configuration", nodeCtrl.GetConfiguration)
		}

		// Account API (Settings, 2FA, API Keys, Activity)
		accountGroup := apiGroup.Group("/account")
		{
			// Account Details
			accountGroup.GET("", accountCtrl.GetAccount)

			// 2FA Endpoints
			accountGroup.POST("/2fa/setup", accountCtrl.Setup2FA)
			accountGroup.POST("/2fa/enable", accountCtrl.Enable2FA)
			accountGroup.POST("/2fa/disable", accountCtrl.Disable2FA)

			// Account Settings
			accountGroup.PUT("/password", accountCtrl.UpdatePassword)
			accountGroup.PUT("/profile", accountCtrl.UpdateProfile)
			accountGroup.GET("/activity", accountCtrl.GetActivity)

			// Discord Account Linking
			accountGroup.POST("/discord/request-code", discordCtrl.RequestVerificationCode)
			accountGroup.POST("/discord/confirm-code", discordCtrl.ConfirmVerificationCode)
			accountGroup.POST("/discord/link", discordCtrl.LinkDiscord)
			accountGroup.POST("/discord/unlink", discordCtrl.UnlinkDiscord)

			// Theme preferences (Personal User Theme)
			accountGroup.GET("/theme", accountCtrl.GetUserTheme)
			accountGroup.PUT("/theme", accountCtrl.UpdateUserTheme)

			// API Keys
			accountGroup.GET("/api-keys", apiKeyCtrl.ListAPIKeys)
			accountGroup.POST("/api-keys", apiKeyCtrl.CreateAPIKey)
			accountGroup.DELETE("/api-keys/:id", apiKeyCtrl.DeleteAPIKey)
		}

		// User Theme aliases
		apiGroup.GET("/user/theme", accountCtrl.GetUserTheme)
		apiGroup.PUT("/user/theme", accountCtrl.UpdateUserTheme)

		// Admin Global Theme management (Admin only)
		adminThemeGroup := apiGroup.Group("/admin/theme")
		adminThemeGroup.Use(middleware.RequireAdmin())
		{
			adminThemeGroup.PUT("", accountCtrl.UpdateGlobalTheme)
		}

		// Audit logs
		apiGroup.GET("/audit-logs", auditCtrl.ListAuditLogs)

		// Nests & Eggs (read access for all authenticated users)
		apiGroup.GET("/nests", nestCtrl.ListNests)
		apiGroup.GET("/nests/:id", nestCtrl.GetNest)
		apiGroup.GET("/nests/:id/eggs", nestCtrl.ListEggs)
		apiGroup.GET("/eggs", nestCtrl.ListAllEggs)
		apiGroup.GET("/eggs/:id", nestCtrl.GetEgg)

		// Nest & Egg management (admin only)
		nestsAdminGroup := apiGroup.Group("/nests")
		nestsAdminGroup.Use(middleware.RequireAdmin())
		{
			nestsAdminGroup.POST("", nestCtrl.CreateNest)
			nestsAdminGroup.PATCH("/:id", nestCtrl.UpdateNest)
			nestsAdminGroup.DELETE("/:id", nestCtrl.DeleteNest)
			nestsAdminGroup.POST("/:nestId/eggs/import", nestCtrl.ImportEgg)
		}

		adminNestsGroup := apiGroup.Group("/admin/nests")
		adminNestsGroup.Use(middleware.RequireAdmin())
		{
			adminNestsGroup.POST("/:nestId/eggs/import", nestCtrl.ImportEgg)
		}

		eggsAdminGroup := apiGroup.Group("/eggs")
		eggsAdminGroup.Use(middleware.RequireAdmin())
		{
			eggsAdminGroup.POST("", nestCtrl.CreateEgg)
			eggsAdminGroup.POST("/import", nestCtrl.ImportEgg)
			eggsAdminGroup.PATCH("/:id", nestCtrl.UpdateEgg)
			eggsAdminGroup.DELETE("/:id", nestCtrl.DeleteEgg)
		}

		// Admin User Management
		adminUsersGroup := apiGroup.Group("/admin/users")
		adminUsersGroup.Use(middleware.RequireAdmin())
		{
			adminUsersGroup.GET("", userAdminCtrl.ListUsers)
			adminUsersGroup.POST("", userAdminCtrl.CreateUser)
			adminUsersGroup.PUT("/:id", userAdminCtrl.UpdateUser)
			adminUsersGroup.DELETE("/:id", userAdminCtrl.DeleteUser)
		}

		// Admin Database Management
		adminDatabasesGroup := apiGroup.Group("/admin/databases")
		adminDatabasesGroup.Use(middleware.RequireAdmin())
		{
			adminDatabasesGroup.GET("", dbCtrl.ListAllDatabases)
			adminDatabasesGroup.GET("/hosts", dbCtrl.ListAdminHosts)
			adminDatabasesGroup.POST("/hosts", dbCtrl.CreateAdminHost)
			adminDatabasesGroup.DELETE("/hosts/:id", dbCtrl.DeleteAdminHost)
		}

		// Alias /api/admin/database-hosts
		adminDbHostsGroup := apiGroup.Group("/admin/database-hosts")
		adminDbHostsGroup.Use(middleware.RequireAdmin())
		{
			adminDbHostsGroup.GET("", dbCtrl.ListAdminHosts)
			adminDbHostsGroup.POST("", dbCtrl.CreateAdminHost)
			adminDbHostsGroup.DELETE("/:id", dbCtrl.DeleteAdminHost)
		}

		// Admin Integrations (Discord OAuth2 & Bot, Cloudflare DNS)
		adminIntegrationsGroup := apiGroup.Group("/admin/integrations")
		adminIntegrationsGroup.Use(middleware.RequireAdmin())
		{
			adminIntegrationsGroup.GET("/discord", discordCtrl.GetDiscordConfig)
			adminIntegrationsGroup.POST("/discord", discordCtrl.SaveDiscordConfig)
			adminIntegrationsGroup.POST("/discord/test", discordCtrl.TestDiscordConnection)
			adminIntegrationsGroup.GET("/discord/roles", discordCtrl.GetDiscordRoles)
			adminIntegrationsGroup.POST("/discord/sync-commands", discordCtrl.SyncSlashCommands)
			adminIntegrationsGroup.GET("/cloudflare", dnsCtrl.GetCloudflareConfig)
			adminIntegrationsGroup.POST("/cloudflare", dnsCtrl.SaveCloudflareConfig)
		}

		// Pterodactyl & Pelican Importer (1-Click Migration)
		adminImporterGroup := apiGroup.Group("/admin/importer")
		adminImporterGroup.Use(middleware.RequireAdmin())
		{
			adminImporterGroup.POST("/test", importerCtrl.TestConnection)
			adminImporterGroup.POST("/execute", importerCtrl.ExecuteImport)
			adminImporterGroup.POST("/upload-json", importerCtrl.ImportEggOrJSON)
		}

		// Admin System Updates (1-Click Install)
		adminUpdatesGroup := apiGroup.Group("/system/updates")
		adminUpdatesGroup.Use(middleware.RequireAdmin())
		{
			adminUpdatesGroup.POST("/install", systemUpdateCtrl.InstallUpdate)
		}

		// Admin System Health & Maintenance (Admin only)
		adminHealthGroup := apiGroup.Group("/system")
		adminHealthGroup.Use(middleware.RequireAdmin())
		{
			adminHealthGroup.GET("/diagnostics", statsCtrl.GetDiagnostics)
			adminHealthGroup.GET("/health/storage", statsCtrl.GetStorageHealth)
			adminHealthGroup.POST("/health/clean-logs", statsCtrl.CleanOldLogs)
		}
	}

	// Mount single-binary embedded frontend SPA
	web.RegisterRoutes(router)

	return router
}
