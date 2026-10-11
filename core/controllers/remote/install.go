package remote

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// InstallRemoteController handles server installation scripts and state updates from Wings.
type InstallRemoteController struct {
	db *gorm.DB
}

// NewInstallRemoteController creates a new InstallRemoteController.
func NewInstallRemoteController(db *gorm.DB) *InstallRemoteController {
	return &InstallRemoteController{db: db}
}

// GetInstallData handles GET /api/remote/servers/:uuid/install
// Returns installation container, entrypoint and bash install script.
func (c *InstallRemoteController) GetInstallData(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	serverUUID := ctx.Param("uuid")
	var server models.Server
	if err := c.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	if server.NodeID != node.ID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Requesting node does not have permission to access this server."})
		return
	}

	// Standard install script container and script
	containerImage := "ghcr.io/pterodactyl/installers:alpine"
	entrypoint := "ash"
	script := `#!/bin/ash
# PteroNext Server Installation Script
echo "Installing server container..."
cd /mnt/server
if [ ! -f "server.jar" ]; then
    echo "Creating initial server structure..."
    echo "eula=true" > eula.txt
fi
echo "Installation complete."
exit 0
`

	if server.EggID != nil {
		var egg models.Egg
		if err := c.db.First(&egg, *server.EggID).Error; err == nil && egg.ScriptInstall != "" {
			if egg.ScriptContainer != "" {
				containerImage = egg.ScriptContainer
			}
			if egg.ScriptEntry != "" {
				entrypoint = egg.ScriptEntry
			}
			script = egg.ScriptInstall
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"container_image": containerImage,
		"entrypoint":      entrypoint,
		"script":          script,
	})
}

type InstallStatusRequest struct {
	Successful bool `json:"successful"`
	Reinstall  bool `json:"reinstall"`
}

// PostInstallData handles POST /api/remote/servers/:uuid/install
// Receives installation outcome from Wings daemon and clears installing state.
func (c *InstallRemoteController) PostInstallData(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	serverUUID := ctx.Param("uuid")
	var server models.Server
	if err := c.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	if server.NodeID != node.ID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Requesting node does not have permission to access this server."})
		return
	}

	var req InstallStatusRequest
	_ = ctx.ShouldBindJSON(&req)

	var status *string
	if !req.Successful {
		failedStatus := models.ServerStatusInstallFailed
		if req.Reinstall {
			failedStatus = models.ServerStatusReinstallFailed
		}
		status = &failedStatus
	}

	now := time.Now().UTC()
	updates := map[string]interface{}{
		"status":       status,
		"installed_at": &now,
	}

	c.db.Model(&server).Updates(updates)
	ctx.Status(http.StatusNoContent)
}
