package controllers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// UserAdminController manages administrative CRUD operations on user accounts.
type UserAdminController struct {
	db *gorm.DB
}

// NewUserAdminController creates a new UserAdminController instance.
func NewUserAdminController(db *gorm.DB) *UserAdminController {
	return &UserAdminController{db: db}
}

// AdminUserListItem represents a user account decorated with subuser status and server stats.
type AdminUserListItem struct {
	models.User
	IsSubuser      bool     `json:"is_subuser"`
	SubuserServers []string `json:"subuser_servers"`
	ServersCount   int64    `json:"servers_count"`
}

// ListUsers handles GET /api/admin/users
// Returns all user accounts with enriched subuser status and server information.
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
		// fetch server name if possible
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
		result[i] = AdminUserListItem{
			User:           usr,
			IsSubuser:      len(delegated) > 0,
			SubuserServers: delegated,
			ServersCount:   ownerCountMap[usr.ID],
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  result,
		"users": result,
	})
}

// CreateUserAdminRequest defines the payload for creating a user account.
type CreateUserAdminRequest struct {
	Username  string `json:"username" binding:"required"`
	Email     string `json:"email" binding:"required"`
	Password  string `json:"password" binding:"required"`
	RootAdmin bool   `json:"root_admin"`
	NameFirst string `json:"name_first"`
	NameLast  string `json:"name_last"`
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
	if req.RootAdmin {
		u.db.Where("name = ?", "Administrator").First(&role)
	} else {
		u.db.Where("name = ?", "Member").First(&role)
	}

	user := models.User{
		UUID:      uuid.New().String(),
		Username:  req.Username,
		Email:     req.Email,
		NameFirst: req.NameFirst,
		NameLast:  req.NameLast,
		RootAdmin: req.RootAdmin,
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

	c.JSON(http.StatusCreated, gin.H{
		"data": user,
		"user": user,
	})
}

// UpdateUserAdminRequest defines fields that can be updated on a user account.
type UpdateUserAdminRequest struct {
	Username  *string `json:"username"`
	Email     *string `json:"email"`
	Password  *string `json:"password"`
	RootAdmin *bool   `json:"root_admin"`
	NameFirst *string `json:"name_first"`
	NameLast  *string `json:"name_last"`
}

// UpdateUser handles PUT /api/admin/users/:id
// Updates an existing user account.
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

	// Verify username uniqueness if updated
	if req.Username != nil && *req.Username != user.Username {
		var count int64
		u.db.Model(&models.User{}).Where("username = ? AND id != ?", *req.Username, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Username is already taken."})
			return
		}
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
		user.Email = *req.Email
	}

	// Update password if provided
	if req.Password != nil && *req.Password != "" {
		if err := user.SetPassword(*req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed hashing updated password."})
			return
		}
	}

	// Update admin status & role if provided
	if req.RootAdmin != nil {
		user.RootAdmin = *req.RootAdmin
		var role models.Role
		if *req.RootAdmin {
			u.db.Where("name = ?", "Administrator").First(&role)
		} else {
			u.db.Where("name = ?", "Member").First(&role)
		}
		if role.ID > 0 {
			user.RoleID = &role.ID
			user.Role = &role
		}
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

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully."})
}
