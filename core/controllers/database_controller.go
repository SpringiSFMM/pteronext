package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// DatabaseController handles database provisioning for servers.
type DatabaseController struct {
	db *gorm.DB
}

// NewDatabaseController creates a new DatabaseController.
func NewDatabaseController(db *gorm.DB) *DatabaseController {
	return &DatabaseController{db: db}
}

// ListDatabases handles GET /api/servers/:uuid/databases
func (d *DatabaseController) ListDatabases(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var databases []models.Database
	if err := d.db.Preload("DatabaseHost").Where("server_id = ?", server.ID).Find(&databases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying databases."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": databases})
}

type CreateDatabaseRequest struct {
	Database       string `json:"database" binding:"required"`
	Remote         string `json:"remote"`
	DatabaseHostID uint   `json:"database_host_id"`
}

// CreateDatabase handles POST /api/servers/:uuid/databases
func (d *DatabaseController) CreateDatabase(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req CreateDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find database host
	var host models.DatabaseHost
	if req.DatabaseHostID > 0 {
		if err := d.db.First(&host, req.DatabaseHostID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Specified database host not found."})
			return
		}
	} else {
		// Use first available host or create a default host
		if err := d.db.First(&host).Error; err != nil {
			host = models.DatabaseHost{
				Name:     "Default Local Database Host",
				Host:     "127.0.0.1",
				Port:     3306,
				Username: "pteronext",
				Password: "password",
			}
			d.db.Create(&host)
		}
	}

	remoteHost := "%"
	if req.Remote != "" {
		remoteHost = req.Remote
	}

	// Generate random username and password
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	dbUsername := fmt.Sprintf("u%d_%s", server.ID, hex.EncodeToString(b[:4]))
	dbPassword := hex.EncodeToString(b)
	dbName := fmt.Sprintf("s%d_%s", server.ID, req.Database)

	database := models.Database{
		ServerID:       server.ID,
		DatabaseHostID: host.ID,
		Database:       dbName,
		Username:       dbUsername,
		Password:       dbPassword,
		Remote:         remoteHost,
	}

	if err := d.db.Create(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating database record."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"database": database,
		"relationships": gin.H{
			"password": dbPassword, // Returned once upon creation
		},
	})
}

// DeleteDatabase handles DELETE /api/servers/:uuid/databases/:id
func (d *DatabaseController) DeleteDatabase(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	id := c.Param("id")

	var database models.Database
	if err := d.db.Where("id = ? AND server_id = ?", id, server.ID).First(&database).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found."})
		return
	}

	if err := d.db.Delete(&database).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting database."})
		return
	}

	c.Status(http.StatusNoContent)
}

// -------------------------------------------------------------
// Admin Database Management (/api/admin/databases/*)
// -------------------------------------------------------------

type CreateDatabaseHostRequest struct {
	Name         string `json:"name" binding:"required"`
	Host         string `json:"host" binding:"required"`
	Port         int    `json:"port"`
	Username     string `json:"username" binding:"required"`
	Password     string `json:"password"`
	NodeID       *uint  `json:"node_id"`
	MaxDatabases *int   `json:"max_databases"`
}

// ListAdminHosts handles GET /api/admin/databases/hosts and GET /api/admin/database-hosts
func (d *DatabaseController) ListAdminHosts(c *gin.Context) {
	var hosts []models.DatabaseHost
	if err := d.db.Find(&hosts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying database hosts."})
		return
	}

	// Count databases per host
	type HostStat struct {
		DatabaseHostID uint
		Count          int64
	}
	var stats []HostStat
	d.db.Model(&models.Database{}).Select("database_host_id, count(*) as count").Group("database_host_id").Scan(&stats)
	countMap := make(map[uint]int64)
	for _, s := range stats {
		countMap[s.DatabaseHostID] = s.Count
	}

	result := make([]gin.H, len(hosts))
	for i, h := range hosts {
		result[i] = gin.H{
			"id":             h.ID,
			"name":           h.Name,
			"host":           h.Host,
			"port":           h.Port,
			"username":       h.Username,
			"node_id":        h.NodeID,
			"max_databases":  h.MaxDatabases,
			"database_count": countMap[h.ID],
			"created_at":     h.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": result, "hosts": result})
}

// CreateAdminHost handles POST /api/admin/databases/hosts and POST /api/admin/database-hosts
func (d *DatabaseController) CreateAdminHost(c *gin.Context) {
	var req CreateDatabaseHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Port <= 0 {
		req.Port = 3306
	}

	host := models.DatabaseHost{
		Name:         req.Name,
		Host:         req.Host,
		Port:         req.Port,
		Username:     req.Username,
		Password:     req.Password,
		NodeID:       req.NodeID,
		MaxDatabases: req.MaxDatabases,
	}

	if err := d.db.Create(&host).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating database host: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": host, "host": host})
}

// DeleteAdminHost handles DELETE /api/admin/databases/hosts/:id and DELETE /api/admin/database-hosts/:id
func (d *DatabaseController) DeleteAdminHost(c *gin.Context) {
	id := c.Param("id")
	var count int64
	d.db.Model(&models.Database{}).Where("database_host_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Cannot delete host: %d active database(s) still exist on this host.", count)})
		return
	}

	if err := d.db.Delete(&models.DatabaseHost{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting database host."})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListAllDatabases handles GET /api/admin/databases
func (d *DatabaseController) ListAllDatabases(c *gin.Context) {
	var databases []models.Database
	if err := d.db.Preload("DatabaseHost").Find(&databases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying all databases."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": databases, "databases": databases})
}
