package controllers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
)

type SecurityController struct {
	scanner *services.SecurityScannerService
	dataDir string
}

func NewSecurityController(scanner *services.SecurityScannerService, dataDir string) *SecurityController {
	if dataDir == "" {
		dataDir = "/var/lib/pteronext"
	}
	return &SecurityController{
		scanner: scanner,
		dataDir: dataDir,
	}
}

func (s *SecurityController) getServerDir(server *models.Server) string {
	candidate := filepath.Join("/var/lib/pterodactyl/volumes", server.UUID)
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	return filepath.Join(s.dataDir, "servers", server.UUID)
}

// ScanJar handles POST /api/servers/:uuid/security/scan-jar
func (s *SecurityController) ScanJar(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	serverDir := s.getServerDir(server)

	var req struct {
		File string `json:"file" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cleanRel := filepath.Clean(strings.TrimPrefix(req.File, "/"))
	fullPath := filepath.Join(serverDir, cleanRel)

	report, err := s.scanner.ScanJarFile(fullPath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": report})
}

// GetSummary handles GET /api/servers/:uuid/security/summary
func (s *SecurityController) GetSummary(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	serverDir := s.getServerDir(server)

	var jarFiles []string
	_ = filepath.Walk(serverDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(path), ".jar") {
			rel, _ := filepath.Rel(serverDir, path)
			jarFiles = append(jarFiles, filepath.ToSlash(rel))
		}
		return nil
	})

	c.JSON(http.StatusOK, gin.H{
		"jar_count": len(jarFiles),
		"jar_files": jarFiles,
	})
}
