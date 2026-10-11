package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// SetupController manages initial first-startup production onboarding.
type SetupController struct {
	db          *gorm.DB
	cfg         *config.Config
	authService *services.AuthService
}

// NewSetupController initializes a new SetupController instance.
func NewSetupController(db *gorm.DB, cfg *config.Config, authService *services.AuthService) *SetupController {
	return &SetupController{
		db:          db,
		cfg:         cfg,
		authService: authService,
	}
}

// GetSetupStatus handles GET /api/system/setup-status (public)
func (s *SetupController) GetSetupStatus(c *gin.Context) {
	var userCount int64
	s.db.Model(&models.User{}).Count(&userCount)

	var nodeCount int64
	s.db.Model(&models.Node{}).Count(&nodeCount)

	var serverCount int64
	s.db.Model(&models.Server{}).Count(&serverCount)

	c.JSON(http.StatusOK, gin.H{
		"setup_completed": userCount > 0 && nodeCount > 0,
		"user_count":      userCount,
		"node_count":      nodeCount,
		"server_count":    serverCount,
		"app_version":     "1.0.0",
		"mode":            "production",
	})
}

// SetupRequest defines the initial setup payload.
type SetupRequest struct {
	AdminUsername string `json:"admin_username" binding:"required"`
	AdminEmail    string `json:"admin_email" binding:"required"`
	AdminPassword string `json:"admin_password" binding:"required"`
	AdminFirst    string `json:"admin_first"`
	AdminLast     string `json:"admin_last"`
	PanelURL      string `json:"panel_url"`
	NodeName      string `json:"node_name"`
	NodeFQDN      string `json:"node_fqdn"`
	NodePort      int    `json:"node_port"`
	NodeSFTP      int    `json:"node_sftp"`
}

// CompleteSetup handles POST /api/system/setup
func (s *SetupController) CompleteSetup(c *gin.Context) {
	var req SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roleID := uint(1)
	var user models.User
	if err := s.db.Where("username = ?", req.AdminUsername).First(&user).Error; err != nil {
		user = models.User{
			Username:  req.AdminUsername,
			Email:     req.AdminEmail,
			NameFirst: req.AdminFirst,
			NameLast:  req.AdminLast,
			RootAdmin: true,
			RoleID:    &roleID,
		}
		if user.NameFirst == "" {
			user.NameFirst = "System"
		}
		if user.NameLast == "" {
			user.NameLast = "Admin"
		}
		if err := user.SetPassword(req.AdminPassword); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed hashing password: " + err.Error()})
			return
		}
		if err := s.db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating admin user: " + err.Error()})
			return
		}
	} else {
		_ = user.SetPassword(req.AdminPassword)
		s.db.Model(&user).Updates(map[string]interface{}{
			"email":      req.AdminEmail,
			"password":   user.Password,
			"name_first": req.AdminFirst,
			"name_last":  req.AdminLast,
			"root_admin": true,
		})
	}

	nodeName := req.NodeName
	if nodeName == "" {
		nodeName = "Primary Node"
	}
	nodeFQDN := req.NodeFQDN
	if nodeFQDN == "" {
		nodeFQDN = "127.0.0.1"
	}
	nodePort := req.NodePort
	if nodePort <= 0 {
		nodePort = 8080
	}
	nodeSFTP := req.NodeSFTP
	if nodeSFTP <= 0 {
		nodeSFTP = 2022
	}

	var node models.Node
	if err := s.db.Where("name = ?", nodeName).First(&node).Error; err != nil {
		node = models.Node{
			Name:             nodeName,
			FQDN:             nodeFQDN,
			Scheme:           "http",
			MemoryMB:         16384,
			DiskMB:           102400,
			DaemonListenPort: nodePort,
			DaemonSFTPPort:   nodeSFTP,
			DaemonBaseDir:    "/var/lib/pterodactyl/volumes",
		}
		_ = s.db.Create(&node)
	}

	token, err := s.authService.GenerateJWT(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed generating token: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Production setup completed successfully.",
		"token":   token,
		"user":    user,
	})
}
