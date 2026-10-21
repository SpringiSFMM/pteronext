package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// NodeController manages daemon node records and configuration generation.
type NodeController struct {
	db  *gorm.DB
	cfg *config.Config
}

// NewNodeController creates a new NodeController.
func NewNodeController(db *gorm.DB, cfg *config.Config) *NodeController {
	return &NodeController{
		db:  db,
		cfg: cfg,
	}
}

// ListNodes handles GET /api/nodes
func (n *NodeController) ListNodes(c *gin.Context) {
	var nodes []models.Node
	if err := n.db.Preload("Allocations").Find(&nodes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying nodes."})
		return
	}

	for i := range nodes {
		var stat struct {
			Count         int64
			AllocatedMem  int64
			AllocatedDisk int64
		}
		n.db.Model(&models.Server{}).
			Where("node_id = ? AND deleted_at IS NULL", nodes[i].ID).
			Select("COUNT(id) as count, COALESCE(SUM(memory_mb), 0) as allocated_mem, COALESCE(SUM(disk_mb), 0) as allocated_disk").
			Scan(&stat)

		nodes[i].ServersCount = stat.Count
		nodes[i].AllocatedMemory = stat.AllocatedMem
		nodes[i].AllocatedDisk = stat.AllocatedDisk
	}

	c.JSON(http.StatusOK, gin.H{"data": nodes})
}

// GetNode handles GET /api/nodes/:id
func (n *NodeController) GetNode(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.Preload("Allocations").Preload("Servers").First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	var stat struct {
		Count         int64
		AllocatedMem  int64
		AllocatedDisk int64
	}
	n.db.Model(&models.Server{}).
		Where("node_id = ? AND deleted_at IS NULL", node.ID).
		Select("COUNT(id) as count, COALESCE(SUM(memory_mb), 0) as allocated_mem, COALESCE(SUM(disk_mb), 0) as allocated_disk").
		Scan(&stat)

	node.ServersCount = stat.Count
	node.AllocatedMemory = stat.AllocatedMem
	node.AllocatedDisk = stat.AllocatedDisk

	c.JSON(http.StatusOK, gin.H{"node": node, "data": node})
}

// CreateNode handles POST /api/nodes
func (n *NodeController) CreateNode(c *gin.Context) {
	var node models.Node
	if err := c.ShouldBindJSON(&node); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := n.db.Create(&node).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating node: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"node": node, "data": node})
}

// UpdateNode handles PATCH /api/nodes/:id
func (n *NodeController) UpdateNode(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload."})
		return
	}

	// Do not overwrite primary key, uuid, or relation fields
	delete(updates, "id")
	delete(updates, "uuid")
	delete(updates, "allocations")
	delete(updates, "servers")

	// Remap frontend JSON field names to DB column names
	fieldMap := map[string]string{
		"memory":        "memory_mb",
		"disk":          "disk_mb",
		"upload_size":   "upload_size_mb",
		"daemon_listen": "daemon_listen_port",
		"daemon_sftp":   "daemon_sftp_port",
		"daemon_base":   "daemon_base_dir",
	}
	for jsonKey, colName := range fieldMap {
		if val, ok := updates[jsonKey]; ok {
			updates[colName] = val
			delete(updates, jsonKey)
		}
	}

	if err := n.db.Model(&node).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating node: " + err.Error()})
		return
	}

	// Reload updated node with relations
	n.db.Preload("Allocations").Preload("Servers").First(&node, id)
	c.JSON(http.StatusOK, gin.H{"node": node, "data": node})
}

// DeleteNode handles DELETE /api/nodes/:id
func (n *NodeController) DeleteNode(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	// Check if any servers are assigned
	var serverCount int64
	n.db.Model(&models.Server{}).Where("node_id = ?", node.ID).Count(&serverCount)
	if serverCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete node with active servers assigned to it."})
		return
	}

	if err := n.db.Delete(&node).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting node."})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetConfiguration handles GET /api/nodes/:id/configuration
// Generates the Wings daemon config.yml YAML string.
func (n *NodeController) GetConfiguration(c *gin.Context) {
	id := c.Param("id")
	var node models.Node
	if err := n.db.First(&node, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found."})
		return
	}

	panelURL := n.cfg.AppURL
	yamlContent := node.GenerateWingsConfiguration(panelURL)

	c.JSON(http.StatusOK, gin.H{
		"node_id":   node.ID,
		"uuid":      node.UUID,
		"token_id":  node.DaemonTokenID,
		"token":     node.DaemonToken,
		"yaml":      yamlContent,
	})
}
