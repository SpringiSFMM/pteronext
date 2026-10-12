package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// SubuserController handles delegation of server permissions to subusers.
type SubuserController struct {
	db *gorm.DB
}

// NewSubuserController creates a new SubuserController instance.
func NewSubuserController(db *gorm.DB) *SubuserController {
	return &SubuserController{db: db}
}

// ListSubusers handles GET /api/servers/:uuid/subusers
func (s *SubuserController) ListSubusers(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var subusers []models.Subuser
	if err := s.db.Preload("User").Where("server_id = ?", server.ID).Find(&subusers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying subusers: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     subusers,
		"subusers": subusers,
	})
}

// CreateSubuserRequest defines the JSON payload for delegating access.
type CreateSubuserRequest struct {
	Email        string      `json:"email"`
	Username     string      `json:"username"`
	RoleName     string      `json:"role_name"`
	Role         string      `json:"role"`
	Permissions  interface{} `json:"permissions"`
	PathRules    interface{} `json:"path_rules"`
	CommandRules interface{} `json:"command_rules"`
}

// CreateSubuser handles POST /api/servers/:uuid/subusers
func (s *SubuserController) CreateSubuser(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req CreateSubuserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload: " + err.Error()})
		return
	}

	email := strings.TrimSpace(req.Email)
	username := strings.TrimSpace(req.Username)
	if email == "" && username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email or username is required."})
		return
	}

	var targetUser models.User
	query := s.db
	if email != "" && username != "" {
		query = query.Where("LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)", email, username)
	} else if email != "" {
		query = query.Where("LOWER(email) = LOWER(?)", email)
	} else {
		query = query.Where("LOWER(username) = LOWER(?)", username)
	}

	if err := query.First(&targetUser).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User account not found."})
		return
	}

	if targetUser.ID == server.OwnerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Owner already has full access to this server."})
		return
	}

	roleName := req.RoleName
	if roleName == "" {
		roleName = req.Role
	}
	if roleName == "" {
		roleName = "Custom"
	}

	// Serialize permissions
	var permStr string
	if req.Permissions != nil {
		switch p := req.Permissions.(type) {
		case string:
			permStr = p
		default:
			b, _ := json.Marshal(p)
			permStr = string(b)
		}
	}

	// Serialize path rules
	var pathRulesStr string
	if req.PathRules != nil {
		switch pr := req.PathRules.(type) {
		case string:
			pathRulesStr = pr
		default:
			b, _ := json.Marshal(pr)
			pathRulesStr = string(b)
		}
	}

	// Serialize command rules
	var cmdRulesStr string
	if req.CommandRules != nil {
		switch cr := req.CommandRules.(type) {
		case string:
			cmdRulesStr = cr
		default:
			b, _ := json.Marshal(cr)
			cmdRulesStr = string(b)
		}
	}

	var subuser models.Subuser
	if err := s.db.Where("server_id = ? AND user_id = ?", server.ID, targetUser.ID).First(&subuser).Error; err == nil {
		// Update existing delegation
		subuser.RoleName = roleName
		subuser.Permissions = permStr
		subuser.PathRules = pathRulesStr
		subuser.CommandRules = cmdRulesStr
		if err := s.db.Save(&subuser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating subuser: " + err.Error()})
			return
		}
	} else {
		// Create new subuser record
		subuser = models.Subuser{
			ServerID:     server.ID,
			UserID:       targetUser.ID,
			RoleName:     roleName,
			Permissions:  permStr,
			PathRules:    pathRulesStr,
			CommandRules: cmdRulesStr,
		}
		if err := s.db.Create(&subuser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating subuser: " + err.Error()})
			return
		}
	}

	// Preload User for client response
	_ = s.db.Preload("User").First(&subuser, subuser.ID)

	c.JSON(http.StatusCreated, gin.H{
		"data":    subuser,
		"subuser": subuser,
	})
}

// DeleteSubuser handles DELETE /api/servers/:uuid/subusers/:id
func (s *SubuserController) DeleteSubuser(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	idStr := c.Param("id")

	numID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subuser ID format."})
		return
	}

	res := s.db.Where("server_id = ? AND (id = ? OR user_id = ?)", server.ID, numID, numID).Delete(&models.Subuser{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting subuser: " + res.Error.Error()})
		return
	}

	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subuser not found on this server."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Subuser removed successfully.",
		"success": true,
	})
}
