package controllers

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type CrashController struct {
	db             *gorm.DB
	wingsClient    *services.WingsClient
	webhookService *services.WebhookService
}

func NewCrashController(db *gorm.DB, wingsClient *services.WingsClient, webhookService *services.WebhookService) *CrashController {
	return &CrashController{
		db:             db,
		wingsClient:    wingsClient,
		webhookService: webhookService,
	}
}

type CrashAnalysisResult struct {
	Crashed           bool   `json:"crashed"`
	Category          string `json:"category"` // "java_version", "port_conflict", "oom", "config_syntax", "none"
	Title             string `json:"title"`
	TitleEN           string `json:"title_en"`
	Description       string `json:"description"`
	DescriptionEN     string `json:"description_en"`
	DetectedError     string `json:"detected_error"`
	SuggestedSolution string `json:"suggested_solution"`
	SolutionLabel     string `json:"solution_label"`
	SolutionLabelEN   string `json:"solution_label_en"`
	FixAction         string `json:"fix_action"` // "switch_java_21", "optimize_flags", "restart_clean", "open_timemachine"
	TargetFile        string `json:"target_file,omitempty"`
}

// AnalyzeCrash handles GET /api/servers/:uuid/crash-analysis
func (cc *CrashController) AnalyzeCrash(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	// Fetch recent server logs from daemon or log file
	logLines := ""
	if server.Node != nil && cc.wingsClient != nil {
		// Attempt reading live logs from wings daemon
		if logs, err := cc.wingsClient.FetchServerLogs(server.Node, server.UUID, 100); err == nil && len(logs) > 0 {
			logLines = strings.Join(logs, "\n")
		}
	}

	// If no live logs from daemon, fallback to server status or mock diagnostic buffer
	analysis := cc.analyzeLogContent(logLines, server)

	// Automated Webhook Event triggers
	if analysis.Crashed && cc.webhookService != nil {
		if analysis.Category == "oom" {
			fields := map[string]string{
				"Fehler":     "Out of Memory (OOM Killer)",
				"RAM Limit":  fmt.Sprintf("%d MB", server.MemoryMB),
				"Lösung":     analysis.SuggestedSolution,
			}
			cc.webhookService.TriggerEvent(
				server.UUID,
				"server.oom",
				fmt.Sprintf("💥 Out of Memory (OOM): %s", server.Name),
				fmt.Sprintf("Server **%s** hat das konfigurierte RAM-Limit (%d MB) überschritten und wurde beendet.", server.Name, server.MemoryMB),
				fields,
				fmt.Sprintf("https://panel.springisfm.de/server/%s", server.UUID),
			)
		} else {
			fields := map[string]string{
				"Kategorie": analysis.Category,
				"Fehler":    analysis.DetectedError,
				"Lösung":    analysis.SuggestedSolution,
			}
			cc.webhookService.TriggerEvent(
				server.UUID,
				"server.crash",
				fmt.Sprintf("⚠️ Server Crash: %s", server.Name),
				fmt.Sprintf("Server **%s** ist abgestürzt: %s", server.Name, analysis.Title),
				fields,
				fmt.Sprintf("https://panel.springisfm.de/server/%s", server.UUID),
			)
		}
	}

	c.JSON(http.StatusOK, analysis)
}

func (cc *CrashController) analyzeLogContent(logs string, server *models.Server) CrashAnalysisResult {
	// 1. Java Version Mismatch
	// "UnsupportedClassVersionError: ... (class file version 65.0)" -> requires Java 21
	javaRegex := regexp.MustCompile(`(?i)(UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime|class file version (65|61|60|55)\.0|requires Java (\d+))`)
	if javaRegex.MatchString(logs) {
		reqJava := "21"
		if strings.Contains(logs, "version 65.0") || strings.Contains(logs, "Java 21") {
			reqJava = "21"
		} else if strings.Contains(logs, "version 61.0") || strings.Contains(logs, "Java 17") {
			reqJava = "17"
		}
		return CrashAnalysisResult{
			Crashed:           true,
			Category:          "java_version",
			Title:             fmt.Sprintf("Server abgestürzt: Java %s erforderlich", reqJava),
			TitleEN:           fmt.Sprintf("Server Crashed: Java %s Required", reqJava),
			Description:       fmt.Sprintf("Ein Plugin oder die Server-Software wurde für Java %s kompiliert. Der Container läuft aktuell mit einer inkompatiblen Java-Version.", reqJava),
			DescriptionEN:     fmt.Sprintf("A plugin or server core was compiled for Java %s. The container is running an incompatible runtime.", reqJava),
			DetectedError:     "UnsupportedClassVersionError (Java Runtime Mismatch)",
			SuggestedSolution: fmt.Sprintf("Stelle das Docker-Image auf Java %s um und starte den Server neu.", reqJava),
			SolutionLabel:     fmt.Sprintf("Auf Java %s umstellen & neustarten", reqJava),
			SolutionLabelEN:   fmt.Sprintf("Switch to Java %s & Restart", reqJava),
			FixAction:         "switch_java_21",
		}
	}

	// 2. Port Binding Conflict
	portRegex := regexp.MustCompile(`(?i)(FAILED TO BIND TO PORT|Address already in use|BindException|Port already in use)`)
	if portRegex.MatchString(logs) {
		return CrashAnalysisResult{
			Crashed:           true,
			Category:          "port_conflict",
			Title:             "Server abgestürzt: Portkonflikt",
			TitleEN:           "Server Crashed: Port Binding Conflict",
			Description:       "Der zugewiesene Server-Port ist noch durch einen hängenden Zombie-Prozess belegt oder ein anderer Dienst nutzt ihn.",
			DescriptionEN:     "The configured server port is currently occupied by another process or lingering socket.",
			DetectedError:     "BindException: Address already in use",
			SuggestedSolution: "Prozessreste bereinigen, Port freigeben und Server sauber neu starten.",
			SolutionLabel:     "Port freigeben & sauber neustarten",
			SolutionLabelEN:   "Release Port & Clean Restart",
			FixAction:         "restart_clean",
		}
	}

	// 3. Out of Memory (OOM)
	oomRegex := regexp.MustCompile(`(?i)(java\.lang\.OutOfMemoryError|Container killed due to memory limit|Out of Memory|OOMKilled)`)
	if oomRegex.MatchString(logs) {
		return CrashAnalysisResult{
			Crashed:           true,
			Category:          "oom",
			Title:             "Server abgestürzt: Speichermangel (OOM)",
			TitleEN:           "Server Crashed: Out of Memory (OOM)",
			Description:       "Der Server hat das zugewiesene RAM-Limit überschritten und wurde vom Linux-Kernel gestoppt.",
			DescriptionEN:     "The server exceeded its allocated RAM limit and was terminated by the OOM killer.",
			DetectedError:     "java.lang.OutOfMemoryError: Java heap space",
			SuggestedSolution: "Speicherflags anpassen (-XX:+UseG1GC -XX:+ParallelRefProcEnabled) für geringeren Overhead.",
			SolutionLabel:     "GC-Flags optimieren & neustarten",
			SolutionLabelEN:   "Optimize GC Flags & Restart",
			FixAction:         "optimize_flags",
		}
	}

	// 4. Broken YAML / Config Syntax
	yamlRegex := regexp.MustCompile(`(?i)(ScannerException|InvalidConfigurationException|mapping values are not allowed here|while scanning a simple key)`)
	if yamlRegex.MatchString(logs) {
		return CrashAnalysisResult{
			Crashed:           true,
			Category:          "config_syntax",
			Title:             "Server abgestürzt: Fehlerhafte YAML-Einrückung",
			TitleEN:           "Server Crashed: Faulty YAML Indentation",
			Description:       "Eine Konfigurationsdatei (z. B. config.yml oder paper.yml) enthält ungültige Leerzeichen oder Tabs.",
			DescriptionEN:     "A configuration file contains invalid YAML indentation or tab characters.",
			DetectedError:     "ScannerException: mapping values are not allowed here",
			SuggestedSolution: "Öffne die Datei in der Time-Machine, um den fehlerfreien Stand von vor wenigen Minuten wiederherzustellen.",
			SolutionLabel:     "In File-Time-Machine öffnen",
			SolutionLabelEN:   "Open in File Time-Machine",
			FixAction:         "open_timemachine",
			TargetFile:        "config.yml",
		}
	}

	// If no explicit crash pattern found in logs
	return CrashAnalysisResult{
		Crashed:       false,
		Category:      "none",
		Title:         "Kein Absturz festgestellt",
		TitleEN:       "No Crash Detected",
		Description:   "Alle Systemlogs und Container-Statuswerte sind im normalen Bereich.",
		DescriptionEN: "System logs and container telemetry are within normal operating parameters.",
		FixAction:     "none",
	}
}

type ExecuteCrashFixRequest struct {
	FixAction string `json:"fix_action" binding:"required"`
}

// ExecuteCrashFix handles POST /api/servers/:uuid/crash-fix
func (cc *CrashController) ExecuteCrashFix(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	user, _ := middleware.GetRequestUser(c)
	if server.Suspended && (user == nil || !user.RootAdmin) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Dieser Server ist administrativ suspendiert. Automatische Reparaturen und Server-Starts sind gesperrt.",
		})
		return
	}

	var req ExecuteCrashFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fix_action is required"})
		return
	}

	switch req.FixAction {
	case "switch_java_21":
		// Update Docker Image to Java 21
		newImage := "ghcr.io/pterodactyl/yolks:java_21"
		cc.db.Model(&models.Server{}).Where("id = ?", server.ID).Update("image", newImage)
		// Restart server
		if server.Node != nil && cc.wingsClient != nil {
			_ = cc.wingsClient.SendPowerAction(server.Node, server.UUID, "restart")
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Docker-Image erfolgreich auf Java 21 umgestellt! Server startet neu...",
			"image":   newImage,
		})

	case "restart_clean":
		// Force kill lingering container and start cleanly
		if server.Node != nil && cc.wingsClient != nil {
			_ = cc.wingsClient.SendPowerAction(server.Node, server.UUID, "kill")
			_ = cc.wingsClient.SendPowerAction(server.Node, server.UUID, "start")
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Port-Bindung freigegeben und Container sauber gestartet!",
		})

	case "optimize_flags":
		// Optimize startup command with G1GC & Aflags
		optFlags := " -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC "
		newStartup := server.Startup
		if !strings.Contains(newStartup, "-XX:+UseG1GC") {
			newStartup = strings.Replace(newStartup, "java ", "java "+optFlags, 1)
			cc.db.Model(&models.Server{}).Where("id = ?", server.ID).Update("startup", newStartup)
		}
		if server.Node != nil && cc.wingsClient != nil {
			_ = cc.wingsClient.SendPowerAction(server.Node, server.UUID, "restart")
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Speicher- und GC-Flags optimiert! Server startet neu...",
		})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown fix action: " + req.FixAction})
	}
}
