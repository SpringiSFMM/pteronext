package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// UserAdminController manages administrative CRUD operations on user accounts,
// RBAC roles, and granular Beta Tester access controls.
type UserAdminController struct {
	db           *gorm.DB
	auditService *services.AuditService
}

// NewUserAdminController creates a new UserAdminController instance.
func NewUserAdminController(db *gorm.DB, auditService *services.AuditService) *UserAdminController {
	return &UserAdminController{db: db, auditService: auditService}
}

// AdminUserListItem represents a user account decorated with subuser status, server stats, and parsed beta configuration.
type AdminUserListItem struct {
	models.User
	RoleName         string   `json:"role_name"`
	IsSubuser        bool     `json:"is_subuser"`
	SubuserServers   []string `json:"subuser_servers"`
	ServersCount     int64    `json:"servers_count"`
	BetaFeaturesList []string `json:"beta_features_list"`
	BetaServersList  []string `json:"beta_servers_list"`
	BetaDiscordList  []string `json:"beta_discord_list"`
}

// BetaFeatureCatalogItem defines an available experimental feature gate.
type BetaFeatureCatalogItem struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	NameDE      string `json:"name_de"`
	Description string `json:"description"`
	DescDE      string `json:"description_de"`
	Category    string `json:"category"`
	Icon        string `json:"icon"`
}

// AvailableBetaFeatures defines the official system catalog of granular preview features.
var AvailableBetaFeatures = []BetaFeatureCatalogItem{
	{
		Key:         "ai_diagnostics",
		Name:        "AI Server Diagnostics & Crash Analysis",
		NameDE:      "KI Server-Diagnose & Crash-Analyse",
		Description: "Interactive neural error triage and automatic log crash investigation",
		DescDE:      "Interaktive neuronale Fehleranalyse und automatisierte Crashlog-Prüfung",
		Category:    "Intelligence",
		Icon:        "Bot",
	},
	{
		Key:         "telemetry_v2",
		Name:        "Real-Time Telemetry & Daemon Heartbeat V2",
		NameDE:      "Echtzeit-Telemetrie & Daemon Heartbeat V2",
		Description: "Sub-millisecond socket telemetry and high-frequency resource metrics",
		DescDE:      "Sub-Millisekunden Socket-Telemetrie und hochfrequente Ressourcen-Metriken",
		Category:    "Infrastructure",
		Icon:        "Activity",
	},
	{
		Key:         "discord_bot_mgmt",
		Name:        "Discord Bot Panel Management & Deep Config",
		NameDE:      "Discord Bot Panel-Verwaltung & Konfiguration",
		Description: "Live management of commands, notifications and channel mappings from the panel",
		DescDE:      "Live-Verwaltung von Bot-Befehlen, Mitteilungen und Channel-Zuweisungen im Panel",
		Category:    "Integrations",
		Icon:        "Bot",
	},
	{
		Key:         "marketplace_beta",
		Name:        "Egg Marketplace Preview & 1-Click Staging",
		NameDE:      "Egg Marketplace Beta & 1-Klick Staging",
		Description: "Curated game template store with direct community egg importing",
		DescDE:      "Kuratierter Vorlagen-Store mit direktem Community-Egg-Import",
		Category:    "Templates",
		Icon:        "ShoppingBag",
	},
	{
		Key:         "drevix_pools",
		Name:        "Dynamic Resource Pools & Adaptive Slicing",
		NameDE:      "Dynamische Ressourcen-Pools & Adaptive Skalierung",
		Description: "Shared CPU/RAM cluster pooling and on-the-fly server slicing",
		DescDE:      "Geteilte CPU/RAM Cluster-Pools und On-The-Fly Server-Aufteilung",
		Category:    "Resources",
		Icon:        "Cpu",
	},
	{
		Key:         "custom_domains",
		Name:        "Custom Domains & DNS-Relay Gateway",
		NameDE:      "Eigene Domains & DNS-Relay Gateway",
		Description: "Automated SRV/CNAME records and reverse proxy relay ingress",
		DescDE:      "Automatisierte SRV/CNAME-Einträge und Reverse-Proxy Relay-Ingress",
		Category:    "Network",
		Icon:        "Globe",
	},
	{
		Key:         "file_editor_v2",
		Name:        "Cyber-Glass Multi-Tab File Editor",
		NameDE:      "Cyber-Glass Multi-Tab Datei-Editor",
		Description: "Monaco-powered multi-tab code editor with diff preview and syntax tree",
		DescDE:      "Monaco-basierter Multi-Tab Code-Editor mit Diff-Vorschau und Syntax-Tree",
		Category:    "Files",
		Icon:        "FileCode",
	},
	{
		Key:         "backup_remote_s3",
		Name:        "S3 Multi-Cloud Remote Backups",
		NameDE:      "S3 Multi-Cloud Remote Backups",
		Description: "Off-site geo-redundant S3/Wasabi snapshot replication",
		DescDE:      "Standort-unabhängige, georedundante S3/Wasabi Snapshot-Replikation",
		Category:    "Storage",
		Icon:        "HardDrive",
	},
}

// ListBetaFeatures handles GET /api/admin/users/beta-features
// Returns the list of all experimental feature gates supported by the platform.
func (u *UserAdminController) ListBetaFeatures(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"features": AvailableBetaFeatures,
	})
}

// ListRoles handles GET /api/admin/roles
// Returns all RBAC roles configured in the system.
func (u *UserAdminController) ListRoles(c *gin.Context) {
	var roles []models.Role
	if err := u.db.Order("id asc").Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying roles: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"roles":   roles,
	})
}

// ListUsers handles GET /api/admin/users
// Returns all user accounts with enriched subuser status, server information, and beta permissions.
func (u *UserAdminController) ListUsers(c *gin.Context) {
	var users []models.User
	if err := u.db.Preload("Role").Order("id asc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying users: " + err.Error()})
		return
	}

	// Query all subuser mappings
	var subusers []models.Subuser
	u.db.Preload("User").Find(&subusers)
	subuserMap := make(map[uint][]string)
	for _, su := range subusers {
		var s models.Server
		sName := fmt.Sprintf("Server #%d", su.ServerID)
		if err := u.db.Select("name").First(&s, su.ServerID).Error; err == nil && s.Name != "" {
			sName = s.Name
		}
		subuserMap[su.UserID] = append(subuserMap[su.UserID], sName)
	}

	// Query server ownership counts
	type ServerCount struct {
		OwnerID uint
		Count   int64
	}
	var serverCounts []ServerCount
	u.db.Model(&models.Server{}).Select("owner_id, count(*) as count").Group("owner_id").Scan(&serverCounts)
	ownerCountMap := make(map[uint]int64)
	for _, sc := range serverCounts {
		ownerCountMap[sc.OwnerID] = sc.Count
	}

	result := make([]AdminUserListItem, len(users))
	for i, usr := range users {
		delegated := subuserMap[usr.ID]

		// Resolve role name
		roleName := "Member"
		if usr.Role != nil && usr.Role.Name != "" {
			roleName = usr.Role.Name
		} else if usr.RootAdmin {
			roleName = "Administrator"
		} else if usr.IsBetaTester {
			roleName = "Beta Tester"
		}

		var feats []string
		_ = json.Unmarshal([]byte(usr.BetaFeatures), &feats)
		if feats == nil {
			feats = []string{}
		}

		var servers []string
		_ = json.Unmarshal([]byte(usr.BetaServerScope), &servers)
		if servers == nil {
			servers = []string{}
		}

		var guilds []string
		_ = json.Unmarshal([]byte(usr.BetaDiscordScope), &guilds)
		if guilds == nil {
			guilds = []string{}
		}

		result[i] = AdminUserListItem{
			User:             usr,
			RoleName:         roleName,
			IsSubuser:        len(delegated) > 0,
			SubuserServers:   delegated,
			ServersCount:     ownerCountMap[usr.ID],
			BetaFeaturesList: feats,
			BetaServersList:  servers,
			BetaDiscordList:  guilds,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  result,
		"users": result,
	})
}

// CreateUserAdminRequest defines the payload for creating a user account.
type CreateUserAdminRequest struct {
	Username         string   `json:"username" binding:"required"`
	Email            string   `json:"email" binding:"required"`
	Password         string   `json:"password" binding:"required"`
	RootAdmin        bool     `json:"root_admin"`
	NameFirst        string   `json:"name_first"`
	NameLast         string   `json:"name_last"`
	RoleID           *uint    `json:"role_id"`
	RoleName         string   `json:"role_name"`
	IsBetaTester     bool     `json:"is_beta_tester"`
	BetaFeatures     []string `json:"beta_features"`
	BetaServerScope  []string `json:"beta_server_scope"`
	BetaDiscordScope []string `json:"beta_discord_scope"`
}

// CreateUser handles POST /api/admin/users
// Creates a new user account with specified credentials and administrative status.
func (u *UserAdminController) CreateUser(c *gin.Context) {
	var req CreateUserAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for unique username or email
	var existingCount int64
	u.db.Model(&models.User{}).Where("username = ? OR email = ?", req.Username, req.Email).Count(&existingCount)
	if existingCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "A user with that username or email already exists."})
		return
	}

	// Determine role
	var role models.Role
	targetRoleName := "Member"
	if req.RootAdmin || req.RoleName == "Administrator" {
		targetRoleName = "Administrator"
		req.RootAdmin = true
	} else if req.IsBetaTester || req.RoleName == "Beta Tester" {
		targetRoleName = "Beta Tester"
		req.IsBetaTester = true
	} else if req.RoleName != "" {
		targetRoleName = req.RoleName
	}
	u.db.Where("name = ?", targetRoleName).First(&role)

	betaFeatsJSON, _ := json.Marshal(req.BetaFeatures)
	if req.BetaFeatures == nil {
		betaFeatsJSON = []byte("[]")
	}
	betaServersJSON, _ := json.Marshal(req.BetaServerScope)
	if req.BetaServerScope == nil {
		betaServersJSON = []byte("[]")
	}
	betaDiscordJSON, _ := json.Marshal(req.BetaDiscordScope)
	if req.BetaDiscordScope == nil {
		betaDiscordJSON = []byte("[]")
	}

	user := models.User{
		UUID:             uuid.New().String(),
		Username:         req.Username,
		Email:            req.Email,
		NameFirst:        req.NameFirst,
		NameLast:         req.NameLast,
		RootAdmin:        req.RootAdmin,
		IsBetaTester:     req.IsBetaTester,
		BetaFeatures:     string(betaFeatsJSON),
		BetaServerScope:  string(betaServersJSON),
		BetaDiscordScope: string(betaDiscordJSON),
	}

	if role.ID > 0 {
		user.RoleID = &role.ID
		user.Role = &role
	}

	if err := user.SetPassword(req.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed hashing password."})
		return
	}

	if err := u.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating user: " + err.Error()})
		return
	}

	// Audit Log
	if u.auditService != nil {
		currentUser, _ := middleware.GetRequestUser(c)
		var actorID *uint
		if currentUser != nil {
			actorID = &currentUser.ID
		}
		_ = u.auditService.Log(actorID, "user", nil, "admin:user.create", map[string]interface{}{
			"user_id":        user.ID,
			"username":       user.Username,
			"email":          user.Email,
			"root_admin":     user.RootAdmin,
			"is_beta_tester": user.IsBetaTester,
			"role":           targetRoleName,
		}, c.ClientIP())
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": user,
		"user": user,
	})
}

// UpdateUserAdminRequest defines fields that can be updated on a user account.
type UpdateUserAdminRequest struct {
	Username         *string   `json:"username"`
	Email            *string   `json:"email"`
	Password         *string   `json:"password"`
	RootAdmin        *bool     `json:"root_admin"`
	NameFirst        *string   `json:"name_first"`
	NameLast         *string   `json:"name_last"`
	RoleID           *uint     `json:"role_id"`
	RoleName         *string   `json:"role_name"`
	IsBetaTester     *bool     `json:"is_beta_tester"`
	BetaFeatures     *[]string `json:"beta_features"`
	BetaServerScope  *[]string `json:"beta_server_scope"`
	BetaDiscordScope *[]string `json:"beta_discord_scope"`
}

// UpdateUser handles PUT /api/admin/users/:id
// Updates an existing user account, roles, and granular Beta Tester access.
func (u *UserAdminController) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := u.db.Preload("Role").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
		return
	}

	var req UpdateUserAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	auditChanges := make(map[string]interface{})

	// Verify username uniqueness if updated
	if req.Username != nil && *req.Username != user.Username {
		var count int64
		u.db.Model(&models.User{}).Where("username = ? AND id != ?", *req.Username, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Username is already taken."})
			return
		}
		auditChanges["old_username"] = user.Username
		auditChanges["new_username"] = *req.Username
		user.Username = *req.Username
	}

	// Verify email uniqueness if updated
	if req.Email != nil && *req.Email != user.Email {
		var count int64
		u.db.Model(&models.User{}).Where("email = ? AND id != ?", *req.Email, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Email is already taken."})
			return
		}
		auditChanges["old_email"] = user.Email
		auditChanges["new_email"] = *req.Email
		user.Email = *req.Email
	}

	// Update password if provided
	if req.Password != nil && *req.Password != "" {
		if err := user.SetPassword(*req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed hashing updated password."})
			return
		}
		auditChanges["password_updated"] = true
	}

	// Handle Role Name / Role ID assignment
	if req.RoleName != nil && *req.RoleName != "" {
		var role models.Role
		if err := u.db.Where("name = ?", *req.RoleName).First(&role).Error; err == nil {
			user.RoleID = &role.ID
			user.Role = &role
			auditChanges["new_role"] = role.Name

			if role.Name == "Administrator" {
				user.RootAdmin = true
			} else if role.Name == "Beta Tester" {
				user.IsBetaTester = true
			}
		}
	} else if req.RoleID != nil {
		var role models.Role
		if err := u.db.First(&role, *req.RoleID).Error; err == nil {
			user.RoleID = &role.ID
			user.Role = &role
			auditChanges["new_role"] = role.Name
		}
	}

	// Update admin status if provided
	if req.RootAdmin != nil {
		if user.RootAdmin != *req.RootAdmin {
			auditChanges["root_admin"] = *req.RootAdmin
		}
		user.RootAdmin = *req.RootAdmin
		if *req.RootAdmin {
			var adminRole models.Role
			if err := u.db.Where("name = ?", "Administrator").First(&adminRole).Error; err == nil {
				user.RoleID = &adminRole.ID
				user.Role = &adminRole
			}
		} else if user.Role != nil && user.Role.Name == "Administrator" {
			var memberRole models.Role
			if err := u.db.Where("name = ?", "Member").First(&memberRole).Error; err == nil {
				user.RoleID = &memberRole.ID
				user.Role = &memberRole
			}
		}
	}

	// Update Beta Tester toggle
	if req.IsBetaTester != nil {
		if user.IsBetaTester != *req.IsBetaTester {
			auditChanges["is_beta_tester"] = *req.IsBetaTester
		}
		user.IsBetaTester = *req.IsBetaTester
		if *req.IsBetaTester && (user.Role == nil || user.Role.Name == "Member") {
			var betaRole models.Role
			if err := u.db.Where("name = ?", "Beta Tester").First(&betaRole).Error; err == nil {
				user.RoleID = &betaRole.ID
				user.Role = &betaRole
			}
		} else if !*req.IsBetaTester && user.Role != nil && user.Role.Name == "Beta Tester" {
			var memberRole models.Role
			if err := u.db.Where("name = ?", "Member").First(&memberRole).Error; err == nil {
				user.RoleID = &memberRole.ID
				user.Role = &memberRole
			}
		}
	}

	// Update Beta Features list
	if req.BetaFeatures != nil {
		featsBytes, _ := json.Marshal(*req.BetaFeatures)
		user.BetaFeatures = string(featsBytes)
		auditChanges["beta_features"] = *req.BetaFeatures
	}

	// Update Server Scope
	if req.BetaServerScope != nil {
		serversBytes, _ := json.Marshal(*req.BetaServerScope)
		user.BetaServerScope = string(serversBytes)
		auditChanges["beta_server_scope"] = *req.BetaServerScope
	}

	// Update Discord Guild Scope
	if req.BetaDiscordScope != nil {
		discordBytes, _ := json.Marshal(*req.BetaDiscordScope)
		user.BetaDiscordScope = string(discordBytes)
		auditChanges["beta_discord_scope"] = *req.BetaDiscordScope
	}

	if req.NameFirst != nil {
		user.NameFirst = *req.NameFirst
	}
	if req.NameLast != nil {
		user.NameLast = *req.NameLast
	}

	if err := u.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating user: " + err.Error()})
		return
	}

	// Write Audit Log
	if u.auditService != nil && len(auditChanges) > 0 {
		currentUser, _ := middleware.GetRequestUser(c)
		var actorID *uint
		if currentUser != nil {
			actorID = &currentUser.ID
		}
		auditChanges["target_user_id"] = user.ID
		auditChanges["target_username"] = user.Username
		_ = u.auditService.Log(actorID, "user", nil, "admin:user.update", auditChanges, c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{
		"data": user,
		"user": user,
	})
}

// DeleteUser handles DELETE /api/admin/users/:id
// Deletes a user account. Prevents self-deletion and deletion of users owning servers.
func (u *UserAdminController) DeleteUser(c *gin.Context) {
	currentUser, _ := middleware.GetRequestUser(c)
	id := c.Param("id")

	var user models.User
	if err := u.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found."})
		return
	}

	if currentUser != nil && currentUser.ID == user.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account."})
		return
	}

	var serverCount int64
	u.db.Model(&models.Server{}).Where("owner_id = ?", user.ID).Count(&serverCount)
	if serverCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete a user who owns active servers."})
		return
	}

	if err := u.db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting user: " + err.Error()})
		return
	}

	if u.auditService != nil {
		var actorID *uint
		if currentUser != nil {
			actorID = &currentUser.ID
		}
		_ = u.auditService.Log(actorID, "user", nil, "admin:user.delete", map[string]interface{}{
			"deleted_user_id":  user.ID,
			"deleted_username": user.Username,
			"deleted_email":    user.Email,
		}, c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully."})
}
