package controllers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// StatsController provides telemetry and health endpoints.
type StatsController struct {
	statsService *services.StatsService
	wingsClient  *services.WingsClient
	db           *gorm.DB
}

// NewStatsController creates a new StatsController.
func NewStatsController(statsService *services.StatsService, wingsClient *services.WingsClient, db *gorm.DB) *StatsController {
	return &StatsController{
		statsService: statsService,
		wingsClient:  wingsClient,
		db:           db,
	}
}

// GetSystemStats handles GET /api/system/stats
func (s *StatsController) GetSystemStats(c *gin.Context) {
	stats, err := s.statsService.GetSystemStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed fetching system statistics."})
		return
	}

	user, hasUser := middleware.GetRequestUser(c)
	if !hasUser || user == nil || !user.RootAdmin {
		// Non-admins or unauthenticated callers receive basic health and system version,
		// but node metrics, host memory breakdown, and daemon internals are sanitized.
		c.JSON(http.StatusOK, gin.H{
			"status":         "online",
			"go_version":     stats.GoVersion,
			"uptime_seconds": stats.UptimeSeconds,
			"counts": gin.H{
				"servers": stats.Counts.Servers,
				"nodes":   0,
				"users":   0,
			},
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetServerResources handles GET /api/servers/:uuid/resources
func (s *StatsController) GetServerResources(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	// Attempt to query Wings daemon if reachable
	if server.Node != nil {
		if stats, err := s.wingsClient.FetchServerResources(server.Node, server.UUID); err == nil {
			c.JSON(http.StatusOK, stats)
			return
		}
	}

	// Server is offline or daemon not reporting active process
	state := "offline"
	if server.Suspended {
		state = "suspended"
	}

	c.JSON(http.StatusOK, gin.H{
		"current_state":      state,
		"is_suspended":       server.Suspended,
		"memory_bytes":       int64(0),
		"memory_limit_bytes": server.MemoryMB * 1024 * 1024,
		"cpu_absolute":       0.0,
		"disk_bytes":         int64(0),
		"network_rx_bytes":   int64(0),
		"network_tx_bytes":   int64(0),
		"uptime":             int64(0),
	})
}

// GetDiagnostics handles GET /api/system/diagnostics
func (s *StatsController) GetDiagnostics(c *gin.Context) {
	wingsLogBytes, _ := exec.Command("tail", "-n", "80", "/var/log/pterodactyl/wings.log").CombinedOutput()
	dockerPsBytes, _ := exec.Command("docker", "ps", "-a", "--no-trunc").CombinedOutput()
	netstatBytes, _ := exec.Command("ss", "-tulpn").CombinedOutput()

	c.JSON(http.StatusOK, gin.H{
		"wings_log":       string(wingsLogBytes),
		"docker_ps":       string(dockerPsBytes),
		"listening_ports": string(netstatBytes),
	})
}

// NodeStorageHealth represents disk balance telemetry for a node
type NodeStorageHealth struct {
	NodeID          uint    `json:"node_id"`
	NodeName        string  `json:"node_name"`
	FQDN            string  `json:"fqdn"`
	DiskLimitMB     int64   `json:"disk_limit_mb"`
	AllocatedDiskMB int64   `json:"allocated_disk_mb"`
	UsagePercent    float64 `json:"usage_percent"`
	WarningTriggered bool   `json:"warning_triggered"` // True if > 90%
}

// StorageHealthResponse holds multi-node disk balances and alerts
type StorageHealthResponse struct {
	OverallStatus string              `json:"overall_status"` // "healthy", "warning", "critical"
	AlertMessage  string              `json:"alert_message,omitempty"`
	Nodes         []NodeStorageHealth `json:"nodes"`
}

// GetStorageHealth handles GET /api/system/health/storage
func (s *StatsController) GetStorageHealth(c *gin.Context) {
	var nodes []models.Node
	if err := s.db.Find(&nodes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying nodes."})
		return
	}

	res := StorageHealthResponse{
		OverallStatus: "healthy",
		Nodes:         make([]NodeStorageHealth, 0),
	}

	for _, n := range nodes {
		var allocated int64
		s.db.Model(&models.Server{}).Where("node_id = ?", n.ID).Select("COALESCE(SUM(disk_mb), 0)").Scan(&allocated)

		var pct float64
		if n.DiskMB > 0 {
			pct = (float64(allocated) / float64(n.DiskMB)) * 100.0
		}

		isWarning := pct >= 90.0
		if isWarning && res.OverallStatus != "critical" {
			res.OverallStatus = "warning"
			res.AlertMessage = fmt.Sprintf("Node '%s' has exceeded 90%% disk storage allocation (%.1f%%)!", n.Name, pct)
		}

		res.Nodes = append(res.Nodes, NodeStorageHealth{
			NodeID:           n.ID,
			NodeName:         n.Name,
			FQDN:             n.FQDN,
			DiskLimitMB:      n.DiskMB,
			AllocatedDiskMB:  allocated,
			UsagePercent:     pct,
			WarningTriggered: isWarning,
		})
	}

	c.JSON(http.StatusOK, res)
}

// CleanOldLogs handles POST /api/system/health/clean-logs
// Compresses / purges logs older than 14 days in log directories
func (s *StatsController) CleanOldLogs(c *gin.Context) {
	threshold := time.Now().Add(-14 * 24 * time.Hour)
	cleanedCount := 0
	freedBytes := int64(0)

	logDirs := []string{
		"/var/log/pterodactyl",
		"/var/log/pteronext",
		"./logs",
		"logs",
	}

	for _, d := range logDirs {
		_ = filepath.Walk(d, func(path string, info os.FileInfo, err error) error {
			if err != nil || info == nil || info.IsDir() {
				return nil
			}
			if strings.HasSuffix(info.Name(), ".log") || strings.HasSuffix(info.Name(), ".gz") {
				if info.ModTime().Before(threshold) {
					size := info.Size()
					if os.Remove(path) == nil {
						cleanedCount++
						freedBytes += size
					}
				}
			}
			return nil
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"cleaned_files": cleanedCount,
		"freed_mb":      float64(freedBytes) / (1024 * 1024),
		"message":       fmt.Sprintf("Cleaned %d log file(s) older than 14 days.", cleanedCount),
	})
}

// WatchdogHealth handles GET /api/system/health/watchdog
func (s *StatsController) WatchdogHealth(c *gin.Context) {
	var servers []models.Server
	s.db.Preload("Node").Find(&servers)

	unresponsiveCount := 0
	type ServerWatchdogInfo struct {
		UUID         string `json:"uuid"`
		Name         string `json:"name"`
		Status       string `json:"status"`
		NodeName     string `json:"node_name"`
		Unresponsive bool   `json:"unresponsive"`
	}

	var results []ServerWatchdogInfo
	for _, srv := range servers {
		unresponsive := false
		state := "offline"
		if srv.Status != nil {
			state = *srv.Status
		}
		nodeName := ""
		if srv.Node != nil {
			nodeName = srv.Node.Name
			stats, err := s.wingsClient.FetchServerResources(srv.Node, srv.UUID)
			if err != nil && srv.Status != nil && *srv.Status == "running" {
				// Daemon unreachable while database considers server running -> potential hang
				unresponsive = true
				unresponsiveCount++
			} else if stats != nil {
				state = stats.State
			}
		}

		results = append(results, ServerWatchdogInfo{
			UUID:         srv.UUID,
			Name:         srv.Name,
			Status:       state,
			NodeName:     nodeName,
			Unresponsive: unresponsive,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"watchdog_active":    true,
		"checked_containers": len(servers),
		"unresponsive_count": unresponsiveCount,
		"servers":            results,
	})
}
