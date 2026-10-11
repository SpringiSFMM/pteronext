package controllers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

const SetupLockfilePath = ".setup_locked"

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

// isSetupLocked checks whether the setup lockfile exists or DB flags it as permanently locked.
func (s *SetupController) isSetupLocked() bool {
	if _, err := os.Stat(SetupLockfilePath); err == nil {
		return true
	}
	var lockSetting models.SystemSetting
	if err := s.db.Where("key = ?", "setup:completed").First(&lockSetting).Error; err == nil && lockSetting.Value == "true" {
		return true
	}
	return false
}

// GetSetupStatus handles GET /api/system/setup-status (public)
func (s *SetupController) GetSetupStatus(c *gin.Context) {
	locked := s.isSetupLocked()

	var userCount int64
	s.db.Model(&models.User{}).Count(&userCount)

	var nodeCount int64
	s.db.Model(&models.Node{}).Count(&nodeCount)

	var serverCount int64
	s.db.Model(&models.Server{}).Count(&serverCount)

	// Setup is completed if lockfile exists or if an admin user + node exists
	completed := locked || (userCount > 0 && nodeCount > 0)

	c.JSON(http.StatusOK, gin.H{
		"setup_completed": completed,
		"setup_locked":    locked,
		"user_count":      userCount,
		"node_count":      nodeCount,
		"server_count":    serverCount,
		"app_version":     "v2.7.4",
		"mode":            "production",
	})
}

// SetupRequest defines the initial 5-step setup payload.
type SetupRequest struct {
	// Step 1: Database Credentials
	DBType     string `json:"db_type"`     // "sqlite", "postgres", "mariadb"
	DBHost     string `json:"db_host"`
	DBPort     int    `json:"db_port"`
	DBUser     string `json:"db_user"`
	DBPassword string `json:"db_password"`
	DBName     string `json:"db_name"`

	// Step 2: Discord Bot Integration
	DiscordBotToken string `json:"discord_bot_token"`
	DiscordClientID string `json:"discord_client_id"`
	DiscordGuildID  string `json:"discord_guild_id"`

	// Step 3: Cloudflare Automation
	CloudflareAPIToken   string `json:"cloudflare_api_token"`
	CloudflareZoneID     string `json:"cloudflare_zone_id"`
	CloudflareBaseDomain string `json:"cloudflare_base_domain"`

	// Step 4: Initial Root Admin Account
	AdminUsername string `json:"admin_username" binding:"required"`
	AdminEmail    string `json:"admin_email" binding:"required"`
	AdminPassword string `json:"admin_password" binding:"required"`
	AdminFirst    string `json:"admin_first"`
	AdminLast     string `json:"admin_last"`

	// Step 5: Node / General Setup
	PanelURL string `json:"panel_url"`
	NodeName string `json:"node_name"`
	NodeFQDN string `json:"node_fqdn"`
	NodePort int    `json:"node_port"`
	NodeSFTP int    `json:"node_sftp"`
}

// CompleteSetup handles POST /api/system/setup
func (s *SetupController) CompleteSetup(c *gin.Context) {
	if s.isSetupLocked() {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Der Setup-Assistent wurde bereits abgeschlossen und ist dauerhaft gesperrt (.setup_locked).",
		})
		return
	}

	var req SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Save Step 1: Database Settings to SystemSettings
	if req.DBType != "" {
		s.db.Save(&models.SystemSetting{Key: "database:type", Value: req.DBType, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "database:host", Value: req.DBHost, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "database:port", Value: fmt.Sprintf("%d", req.DBPort), UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "database:user", Value: req.DBUser, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "database:name", Value: req.DBName, UpdatedAt: time.Now().UTC()})
	}

	// 2. Save Step 2: Discord Settings
	if req.DiscordBotToken != "" || req.DiscordClientID != "" {
		s.db.Save(&models.SystemSetting{Key: "discord:bot_token", Value: req.DiscordBotToken, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "discord:client_id", Value: req.DiscordClientID, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "discord:guild_id", Value: req.DiscordGuildID, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "discord:enabled", Value: "true", UpdatedAt: time.Now().UTC()})
	}

	// 3. Save Step 3: Cloudflare Settings
	if req.CloudflareAPIToken != "" || req.CloudflareZoneID != "" {
		s.db.Save(&models.SystemSetting{Key: "cloudflare:api_token", Value: req.CloudflareAPIToken, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "cloudflare:zone_id", Value: req.CloudflareZoneID, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "cloudflare:base_domain", Value: req.CloudflareBaseDomain, UpdatedAt: time.Now().UTC()})
		s.db.Save(&models.SystemSetting{Key: "cloudflare:enabled", Value: "true", UpdatedAt: time.Now().UTC()})
	}

	// 4. Step 4: Root Admin Account (defaulting to Springi_SFM if requested or specified)
	adminUsername := req.AdminUsername
	if adminUsername == "" {
		adminUsername = "Springi_SFM"
	}

	roleID := uint(1)
	var user models.User
	if err := s.db.Where("username = ?", adminUsername).First(&user).Error; err != nil {
		user = models.User{
			Username:  adminUsername,
			Email:     req.AdminEmail,
			NameFirst: req.AdminFirst,
			NameLast:  req.AdminLast,
			RootAdmin: true,
			RoleID:    &roleID,
		}
		if user.NameFirst == "" {
			user.NameFirst = "Springi"
		}
		if user.NameLast == "" {
			user.NameLast = "SFM"
		}
		if err := user.SetPassword(req.AdminPassword); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Hashen des Passworts: " + err.Error()})
			return
		}
		if err := s.db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Fehler beim Anlegen des Root-Admins: " + err.Error()})
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

	// 5. Compute Node Initialization
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

	// Step 5: Lockfile setzen und in DB persistieren
	s.db.Save(&models.SystemSetting{
		Key:       "setup:completed",
		Value:     "true",
		UpdatedAt: time.Now().UTC(),
	})
	_ = os.WriteFile(SetupLockfilePath, []byte(fmt.Sprintf("SETUP_LOCKED_AT=%s\nADMIN=%s\n", time.Now().UTC().Format(time.RFC3339), adminUsername)), 0600)
	// Ebenfalls im Panel-Root falls abweichend
	_ = os.WriteFile(filepath.Join("..", SetupLockfilePath), []byte(fmt.Sprintf("SETUP_LOCKED_AT=%s\nADMIN=%s\n", time.Now().UTC().Format(time.RFC3339), adminUsername)), 0600)

	token, err := s.authService.GenerateJWT(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed generating token: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Setup erfolgreich abgeschlossen. Das Setup ist nun dauerhaft gesperrt.",
		"token":        token,
		"user":         user,
		"setup_locked": true,
	})
}
