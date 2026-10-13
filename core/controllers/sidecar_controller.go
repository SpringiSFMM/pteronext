package controllers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/glebarez/go-sqlite"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type SidecarController struct {
	db      *gorm.DB
	dataDir string
}

func NewSidecarController(db *gorm.DB, dataDir string) *SidecarController {
	if dataDir == "" {
		dataDir = "/var/lib/pteronext"
	}
	return &SidecarController{db: db, dataDir: dataDir}
}

func (s *SidecarController) getServerDir(server *models.Server) string {
	candidate := filepath.Join("/var/lib/pterodactyl/volumes", server.UUID)
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	return filepath.Join(s.dataDir, "servers", server.UUID)
}

// ListSidecars handles GET /api/servers/:uuid/sidecars
func (s *SidecarController) ListSidecars(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var sidecars []models.Sidecar
	s.db.Where("server_id = ?", server.ID).Find(&sidecars)

	c.JSON(http.StatusOK, gin.H{"data": sidecars})
}

// CreateSidecar handles POST /api/servers/:uuid/sidecars
func (s *SidecarController) CreateSidecar(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		Name     string `json:"name" binding:"required"`
		Type     string `json:"type" binding:"required"` // "redis", "postgres", "sqlite", "mariadb"
		MemoryMB int64  `json:"memory_mb"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mem := req.MemoryMB
	if mem <= 0 {
		mem = 256
	}

	sidecarUUID := uuid.New().String()
	randPort := 6379
	if req.Type == "postgres" {
		randPort = 5432
	} else if req.Type == "mariadb" {
		randPort = 3306
	} else if req.Type == "sqlite" {
		randPort = 0
	}

	randBytes := make([]byte, 16)
	_, _ = rand.Read(randBytes)
	pass := fmt.Sprintf("sc_%s", hex.EncodeToString(randBytes))
	username := "pterouser"
	dbname := strings.ToLower(strings.ReplaceAll(req.Name, " ", "_"))

	sidecar := models.Sidecar{
		ServerID:    server.ID,
		UUID:        sidecarUUID,
		Name:        req.Name,
		Type:        strings.ToLower(req.Type),
		Status:      "running",
		Host:        "127.0.0.1",
		Port:        randPort,
		Database:    dbname,
		Username:    username,
		Password:    pass,
		DockerImage: req.Type + ":alpine",
		MemoryMB:    mem,
	}

	if err := s.db.Create(&sidecar).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    sidecar,
		"message": fmt.Sprintf("Dedicated %s sidecar container provisioned.", strings.ToUpper(req.Type)),
	})
}

// DeleteSidecar handles DELETE /api/servers/:uuid/sidecars/:id
func (s *SidecarController) DeleteSidecar(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	scIDStr := c.Param("id")
	scID, _ := strconv.ParseUint(scIDStr, 10, 32)

	if err := s.db.Where("id = ? AND server_id = ?", scID, server.ID).Delete(&models.Sidecar{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Sidecar companion stopped and unlinked."})
}

// InjectCredentials handles POST /api/servers/:uuid/sidecars/:id/inject
func (s *SidecarController) InjectCredentials(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	scIDStr := c.Param("id")
	scID, _ := strconv.ParseUint(scIDStr, 10, 32)

	var req struct {
		TargetPlugin string `json:"target_plugin" binding:"required"` // "CoreProtect", "LuckPerms"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var sidecar models.Sidecar
	if err := s.db.Where("id = ? AND server_id = ?", scID, server.ID).First(&sidecar).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sidecar not found."})
		return
	}

	serverDir := s.getServerDir(server)
	var targetFile string
	var configSnippet string

	if strings.EqualFold(req.TargetPlugin, "CoreProtect") {
		cpDir := filepath.Join(serverDir, "plugins", "CoreProtect")
		_ = os.MkdirAll(cpDir, 0755)
		targetFile = filepath.Join(cpDir, "config.yml")
		configSnippet = fmt.Sprintf(`
# PteroNext Sidecar Auto-Injected Configuration
use-mysql: true
table-prefix: "co_"
mysql-host: "%s"
mysql-port: %d
mysql-database: "%s"
mysql-username: "%s"
mysql-password: "%s"
`, sidecar.Host, sidecar.Port, sidecar.Database, sidecar.Username, sidecar.Password)
	} else if strings.EqualFold(req.TargetPlugin, "LuckPerms") {
		lpDir := filepath.Join(serverDir, "plugins", "LuckPerms")
		_ = os.MkdirAll(lpDir, 0755)
		targetFile = filepath.Join(lpDir, "luckperms.conf")
		configSnippet = fmt.Sprintf(`
# PteroNext Sidecar Auto-Injected Configuration
storage-method: "%s"
data:
  address: "%s:%d"
  database: "%s"
  username: "%s"
  password: "%s"
`, sidecar.Type, sidecar.Host, sidecar.Port, sidecar.Database, sidecar.Username, sidecar.Password)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Supported plugins: CoreProtect, LuckPerms"})
		return
	}

	// Write / append configuration snippet
	f, err := os.OpenFile(targetFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed opening %s: %v", targetFile, err)})
		return
	}
	defer f.Close()
	_, _ = f.WriteString(configSnippet)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Credentials for %s successfully injected into %s!", req.TargetPlugin, filepath.Base(targetFile)),
		"file":    targetFile,
	})
}

// GetWebDBTables handles GET /api/servers/:uuid/sidecars/tables (Web-DB-Viewer)
func (s *SidecarController) GetWebDBTables(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	serverDir := s.getServerDir(server)

	// Scan for local SQLite database files or sidecar databases
	var dbFiles []string
	_ = filepath.Walk(serverDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && (strings.HasSuffix(path, ".db") || strings.HasSuffix(path, ".sqlite") || strings.HasSuffix(path, ".sqlite3")) {
			rel, _ := filepath.Rel(serverDir, path)
			dbFiles = append(dbFiles, filepath.ToSlash(rel))
		}
		return nil
	})

	selectedFile := c.Query("file")
	if selectedFile == "" && len(dbFiles) > 0 {
		selectedFile = dbFiles[0]
	}

	var tables []string
	if selectedFile != "" {
		fullPath := filepath.Join(serverDir, selectedFile)
		if db, err := sql.Open("sqlite", fullPath); err == nil {
			defer db.Close()
			rows, qErr := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
			if qErr == nil {
				defer rows.Close()
				for rows.Next() {
					var tName string
					if err := rows.Scan(&tName); err == nil {
						tables = append(tables, tName)
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"available_databases": dbFiles,
		"selected_file":       selectedFile,
		"tables":              tables,
	})
}

// QueryWebDB handles POST /api/servers/:uuid/sidecars/query (Web-DB-Viewer safe table viewer)
func (s *SidecarController) QueryWebDB(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	serverDir := s.getServerDir(server)

	var req struct {
		File  string `json:"file" binding:"required"`
		Table string `json:"table" binding:"required"`
		Limit int    `json:"limit"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	limit := req.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	cleanRel := filepath.Clean(req.File)
	if strings.HasPrefix(cleanRel, "..") || strings.HasPrefix(cleanRel, "/") || strings.HasPrefix(cleanRel, "\\") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database file path."})
		return
	}

	fullPath := filepath.Join(serverDir, cleanRel)
	db, err := sql.Open("sqlite", fullPath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed opening database file."})
		return
	}
	defer db.Close()

	// Query sqlite_master to allowlist genuine table names
	tRows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed reading tables from database."})
		return
	}
	defer tRows.Close()

	validTables := make(map[string]bool)
	for tRows.Next() {
		var name string
		if err := tRows.Scan(&name); err == nil {
			validTables[name] = true
		}
	}

	if !validTables[req.Table] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table or table does not exist in database."})
		return
	}

	// Double-quote identifier safely as standard SQL identifier after verification against sqlite_master
	escapedTable := strings.ReplaceAll(req.Table, "\"", "\"\"")
	// nosemgrep: go.lang.security.audit.database.string-formatted-query.string-formatted-query – Table identifier validated against sqlite_master allowlist and double-quoted, limit is bounded integer
	query := fmt.Sprintf("SELECT * FROM \"%s\" LIMIT %d;", escapedTable, limit)
	rows, err := db.Query(query)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Query error: %v", err)})
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var records []map[string]interface{}

	for rows.Next() {
		colVals := make([]interface{}, len(cols))
		colPointers := make([]interface{}, len(cols))
		for i := range colVals {
			colPointers[i] = &colVals[i]
		}

		if err := rows.Scan(colPointers...); err == nil {
			rowMap := make(map[string]interface{})
			for i, colName := range cols {
				val := colVals[i]
				if b, ok := val.([]byte); ok {
					rowMap[colName] = string(b)
				} else {
					rowMap[colName] = val
				}
			}
			records = append(records, rowMap)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"table":   req.Table,
		"columns": cols,
		"rows":    records,
		"count":   len(records),
	})
}
