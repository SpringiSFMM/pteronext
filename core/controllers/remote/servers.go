package remote

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// ServerRemoteController handles daemon communication for server configurations.
type ServerRemoteController struct {
	db            *gorm.DB
	serverService *services.ServerService
}

// NewServerRemoteController creates a new ServerRemoteController.
func NewServerRemoteController(db *gorm.DB, serverService *services.ServerService) *ServerRemoteController {
	return &ServerRemoteController{
		db:            db,
		serverService: serverService,
	}
}

// ListServers handles GET /api/remote/servers
// Returns paginated list of servers and configurations assigned to the calling node.
func (c *ServerRemoteController) ListServers(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(ctx.DefaultQuery("per_page", "50"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	var total int64
	c.db.Model(&models.Server{}).Where("node_id = ?", node.ID).Count(&total)

	var servers []models.Server
	offset := (page - 1) * perPage
	err := c.db.Preload("Node").
		Preload("Allocation").
		Preload("Allocations").
		Preload("Variables").
		Preload("Egg").
		Preload("Nest").
		Where("node_id = ?", node.ID).
		Limit(perPage).
		Offset(offset).
		Find(&servers).Error

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying servers."})
		return
	}

	serverConfigs := make([]services.WingsServerData, 0, len(servers))
	for i := range servers {
		serverConfigs = append(serverConfigs, c.serverService.BuildWingsConfiguration(&servers[i]))
	}

	totalPages := int(total) / perPage
	if int(total)%perPage != 0 {
		totalPages++
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data": serverConfigs,
		"meta": gin.H{
			"pagination": gin.H{
				"total":        total,
				"count":        len(serverConfigs),
				"per_page":     perPage,
				"current_page": page,
				"total_pages":  totalPages,
			},
		},
	})
}

// GetServerDetails handles GET /api/remote/servers/:uuid
// Returns single server settings and process_configuration for Wings self-recovery.
func (c *ServerRemoteController) GetServerDetails(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	serverUUID := ctx.Param("uuid")
	server, err := c.serverService.GetServerWithRelations(serverUUID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	if server.NodeID != node.ID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Requesting node does not have permission to access this server."})
		return
	}

	wingsData := c.serverService.BuildWingsConfiguration(server)
	ctx.JSON(http.StatusOK, gin.H{
		"settings":              wingsData.Settings,
		"process_configuration": wingsData.ProcessConfiguration,
	})
}

// ResetServersState handles POST /api/remote/servers/reset
// Resets servers marked as installing or restoring to normal state upon Wings reboot.
func (c *ServerRemoteController) ResetServersState(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	// Clear stuck status on node restart
	c.db.Model(&models.Server{}).
		Where("node_id = ? AND status IN (?)", node.ID, []string{models.ServerStatusInstalling, models.ServerStatusRestoringBackup}).
		Update("status", nil)

	ctx.Status(http.StatusNoContent)
}
