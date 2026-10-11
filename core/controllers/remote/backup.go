package remote

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// BackupRemoteController handles Wings daemon backup reporting and restoration callbacks.
type BackupRemoteController struct {
	db           *gorm.DB
	auditService *services.AuditService
}

// NewBackupRemoteController creates a new BackupRemoteController.
func NewBackupRemoteController(db *gorm.DB, auditService *services.AuditService) *BackupRemoteController {
	return &BackupRemoteController{
		db:           db,
		auditService: auditService,
	}
}

// GetBackupRemoteUpload handles GET /api/remote/backups/:backup
func (c *BackupRemoteController) GetBackupRemoteUpload(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	backupUUID := ctx.Param("backup")
	var backup models.Backup
	if err := c.db.Preload("Server").Where("uuid = ?", backupUUID).First(&backup).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Backup not found."})
		return
	}

	if backup.Server.NodeID != node.ID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Requesting node does not have permission to access this server."})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"parts":     []interface{}{},
		"part_size": 104857600, // 100MB
		"url":       "",
	})
}

type BackupCompleteRequest struct {
	Successful   bool   `json:"successful"`
	ChecksumType string `json:"checksum_type"`
	Checksum     string `json:"checksum"`
	Size         int64  `json:"size"`
}

// PostBackupStatus handles POST /api/remote/backups/:backup
func (c *BackupRemoteController) PostBackupStatus(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	backupUUID := ctx.Param("backup")
	var backup models.Backup
	if err := c.db.Preload("Server").Where("uuid = ?", backupUUID).First(&backup).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Backup not found."})
		return
	}

	if backup.Server.NodeID != node.ID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Requesting node does not have permission to access this server."})
		return
	}

	var req BackupCompleteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload."})
		return
	}

	checksum := ""
	if req.ChecksumType != "" && req.Checksum != "" {
		checksum = fmt.Sprintf("%s:%s", req.ChecksumType, req.Checksum)
	}

	now := time.Now().UTC()
	updates := map[string]interface{}{
		"is_successful": req.Successful,
		"checksum":      checksum,
		"bytes":         req.Size,
		"completed_at":  &now,
	}
	c.db.Model(&backup).Updates(updates)

	// Log audit trail
	event := "server:backup.complete"
	if !req.Successful {
		event = "server:backup.fail"
	}
	_ = c.auditService.Log(nil, "daemon", &backup.ServerID, event, map[string]interface{}{
		"backup_uuid": backup.UUID,
		"bytes":       req.Size,
		"successful":  req.Successful,
	}, ctx.ClientIP())

	ctx.Status(http.StatusNoContent)
}

type BackupRestoreRequest struct {
	Successful bool `json:"successful"`
}

// PostBackupRestore handles POST /api/remote/backups/:backup/restore
func (c *BackupRemoteController) PostBackupRestore(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	backupUUID := ctx.Param("backup")
	var backup models.Backup
	if err := c.db.Preload("Server").Where("uuid = ?", backupUUID).First(&backup).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Backup not found."})
		return
	}

	if backup.Server.NodeID != node.ID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Requesting node does not have permission to access this server."})
		return
	}

	var req BackupRestoreRequest
	_ = ctx.ShouldBindJSON(&req)

	// Clear restoring status on server
	c.db.Model(&models.Server{}).Where("id = ?", backup.ServerID).Update("status", nil)

	event := "server:backup.restore-complete"
	if !req.Successful {
		event = "server:backup.restore-failed"
	}
	_ = c.auditService.Log(nil, "daemon", &backup.ServerID, event, map[string]interface{}{
		"backup_uuid": backup.UUID,
		"successful":  req.Successful,
	}, ctx.ClientIP())

	ctx.Status(http.StatusNoContent)
}
