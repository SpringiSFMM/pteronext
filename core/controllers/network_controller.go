package controllers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type NetworkController struct {
	db *gorm.DB
}

func NewNetworkController(db *gorm.DB) *NetworkController {
	return &NetworkController{db: db}
}

// GetNetwork handles GET /api/servers/:uuid/network
func (n *NetworkController) GetNetwork(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	// Fetch current server allocations
	var current []models.Allocation
	n.db.Where("server_id = ?", server.ID).Order("port asc").Find(&current)

	// Fetch available allocations on the same node
	var available []models.Allocation
	n.db.Where("node_id = ? AND (server_id IS NULL OR server_id = 0)", server.NodeID).Order("port asc").Limit(50).Find(&available)

	type AllocDto struct {
		ID        uint   `json:"id"`
		IP        string `json:"ip"`
		Port      int    `json:"port"`
		Alias     string `json:"alias"`
		Notes     string `json:"notes"`
		IsPrimary bool   `json:"is_primary"`
	}

	currentDtos := make([]AllocDto, len(current))
	for i, a := range current {
		currentDtos[i] = AllocDto{
			ID:        a.ID,
			IP:        a.IP,
			Port:      a.Port,
			Alias:     a.Alias,
			Notes:     a.Notes,
			IsPrimary: a.ID == server.AllocationID,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"primary_allocation_id": server.AllocationID,
		"allocations":           currentDtos,
		"available_pool":        available,
	})
}

// AssignAllocation handles POST /api/servers/:uuid/network/assign
func (n *NetworkController) AssignAllocation(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		AllocationID uint `json:"allocation_id"` // 0 for auto next available
	}
	_ = c.ShouldBindJSON(&req)

	var alloc models.Allocation
	if req.AllocationID > 0 {
		if err := n.db.Where("id = ? AND node_id = ? AND (server_id IS NULL OR server_id = 0)", req.AllocationID, server.NodeID).First(&alloc).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Allocation is not available or not on server node."})
			return
		}
	} else {
		// Auto pick next available
		if err := n.db.Where("node_id = ? AND (server_id IS NULL OR server_id = 0)", server.NodeID).Order("port asc").First(&alloc).Error; err != nil {
			// Auto create next port in range 25565-25600 if pool empty
			var maxAlloc models.Allocation
			nextPort := 25566
			if err := n.db.Where("node_id = ?", server.NodeID).Order("port desc").First(&maxAlloc).Error; err == nil {
				nextPort = maxAlloc.Port + 1
			}
			alloc = models.Allocation{
				NodeID:   server.NodeID,
				ServerID: &server.ID,
				IP:       "0.0.0.0",
				Port:     nextPort,
				Notes:    "Secondary Game Port",
			}
			if err := n.db.Create(&alloc).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating auto allocation."})
				return
			}
			c.JSON(http.StatusOK, gin.H{"data": alloc, "message": fmt.Sprintf("Allocated port %d to server.", nextPort)})
			return
		}
	}

	// Assign to server
	alloc.ServerID = &server.ID
	if err := n.db.Save(&alloc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": alloc, "message": fmt.Sprintf("Assigned port %d successfully.", alloc.Port)})
}

// SetPrimary handles POST /api/servers/:uuid/network/set-primary
func (n *NetworkController) SetPrimary(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req struct {
		AllocationID uint `json:"allocation_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify allocation belongs to server
	var alloc models.Allocation
	if err := n.db.Where("id = ? AND server_id = ?", req.AllocationID, server.ID).First(&alloc).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Allocation does not belong to this server."})
		return
	}

	server.AllocationID = req.AllocationID
	if err := n.db.Model(&server).Update("allocation_id", req.AllocationID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Primary port set to %d.", alloc.Port)})
}

// UpdateNotes handles PATCH /api/servers/:uuid/network/:id/notes
func (n *NetworkController) UpdateNotes(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	allocIDStr := c.Param("id")
	allocID, _ := strconv.ParseUint(allocIDStr, 10, 32)

	var req struct {
		Notes string `json:"notes"`
		Alias string `json:"alias"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := n.db.Model(&models.Allocation{}).Where("id = ? AND server_id = ?", allocID, server.ID).Updates(map[string]interface{}{
		"notes": req.Notes,
		"alias": req.Alias,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Allocation notes updated."})
}

// DeleteAllocation handles DELETE /api/servers/:uuid/network/:id
func (n *NetworkController) DeleteAllocation(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	allocIDStr := c.Param("id")
	allocID, _ := strconv.ParseUint(allocIDStr, 10, 32)

	if uint(allocID) == server.AllocationID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove the primary allocation. Assign another primary port first."})
		return
	}

	if err := n.db.Model(&models.Allocation{}).Where("id = ? AND server_id = ?", allocID, server.ID).Update("server_id", nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Allocation released back to node pool."})
}
