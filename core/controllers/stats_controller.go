package controllers

import (
	"net/http"
	"os/exec"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/services"
)

// StatsController provides telemetry and health endpoints.
type StatsController struct {
	statsService *services.StatsService
	wingsClient  *services.WingsClient
}

// NewStatsController creates a new StatsController.
func NewStatsController(statsService *services.StatsService, wingsClient *services.WingsClient) *StatsController {
	return &StatsController{
		statsService: statsService,
		wingsClient:  wingsClient,
	}
}

// GetSystemStats handles GET /api/system/stats
func (s *StatsController) GetSystemStats(c *gin.Context) {
	stats, err := s.statsService.GetSystemStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed fetching system statistics."})
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
		"wings_log": string(wingsLogBytes),
		"docker_ps": string(dockerPsBytes),
		"listening_ports": string(netstatBytes),
	})
}

