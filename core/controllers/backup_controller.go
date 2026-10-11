package controllers

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/services"
)

type BackupController struct {
	backupService *services.BackupService
}

func NewBackupController(backupService *services.BackupService) *BackupController {
	return &BackupController{
		backupService: backupService,
	}
}

// ListBackups handles GET /api/servers/:uuid/backups
func (b *BackupController) ListBackups(c *gin.Context) {
	uuid := c.Param("uuid")
	backups, err := b.backupService.ListBackups(uuid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": backups})
}

// CreateBackup handles POST /api/servers/:uuid/backups
func (b *BackupController) CreateBackup(c *gin.Context) {
	uuid := c.Param("uuid")

	var req struct {
		Name            string   `json:"name"`
		IsLocked        bool     `json:"is_locked"`
		EncryptPassword string   `json:"encrypt_password"`
		IgnoredFiles    []string `json:"ignored_files"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	backup, err := b.backupService.CreateBackup(uuid, req.Name, req.EncryptPassword, req.IsLocked, req.IgnoredFiles)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": backup, "message": "Backup created successfully."})
}

// DeleteBackup handles DELETE /api/servers/:uuid/backups/:id
func (b *BackupController) DeleteBackup(c *gin.Context) {
	uuid := c.Param("uuid")
	backupUUID := c.Param("id")

	if err := b.backupService.DeleteBackup(uuid, backupUUID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Backup deleted successfully."})
}

// ToggleLock handles POST /api/servers/:uuid/backups/:id/lock
func (b *BackupController) ToggleLock(c *gin.Context) {
	uuid := c.Param("uuid")
	backupUUID := c.Param("id")

	backup, err := b.backupService.ToggleLock(uuid, backupUUID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": backup})
}

// RestoreFull handles POST /api/servers/:uuid/backups/:id/restore
func (b *BackupController) RestoreFull(c *gin.Context) {
	uuid := c.Param("uuid")
	backupUUID := c.Param("id")

	var req struct {
		Truncate        bool   `json:"truncate"`
		EncryptPassword string `json:"encrypt_password"`
	}
	_ = c.ShouldBindJSON(&req)

	if err := b.backupService.RestoreFull(uuid, backupUUID, req.EncryptPassword, req.Truncate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Server restored successfully from backup."})
}

// RestoreFile handles POST /api/servers/:uuid/backups/:id/restore-file
func (b *BackupController) RestoreFile(c *gin.Context) {
	uuid := c.Param("uuid")
	backupUUID := c.Param("id")

	var req struct {
		Path            string `json:"path" binding:"required"`
		EncryptPassword string `json:"encrypt_password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := b.backupService.RestoreFile(uuid, backupUUID, req.EncryptPassword, req.Path); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Restored '%s' successfully.", req.Path)})
}

// GetContents handles GET /api/servers/:uuid/backups/:id/contents
func (b *BackupController) GetContents(c *gin.Context) {
	uuid := c.Param("uuid")
	backupUUID := c.Param("id")
	password := c.Query("password")

	files, err := b.backupService.ListBackupContents(uuid, backupUUID, password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"files": files})
}

// DownloadBackup handles GET /api/servers/:uuid/backups/:id/download
func (b *BackupController) DownloadBackup(c *gin.Context) {
	uuid := c.Param("uuid")
	backupUUID := c.Param("id")

	backup, err := b.backupService.GetBackup(uuid, backupUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	filePath := b.backupService.GetBackupFilePath(backup, uuid)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physical backup file not found on disk."})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", backup.Name+".tar.gz"))
	c.Header("Content-Type", "application/gzip")
	c.File(filePath)
}
