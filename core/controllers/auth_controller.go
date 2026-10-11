package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/pkg/security"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// AuthController manages user login, registration, and session info.
type AuthController struct {
	db          *gorm.DB
	authService *services.AuthService
}

// NewAuthController creates a new AuthController.
func NewAuthController(db *gorm.DB, authService *services.AuthService) *AuthController {
	return &AuthController{
		db:          db,
		authService: authService,
	}
}

type LoginRequest struct {
	User     string `json:"user" binding:"required"`
	Password string `json:"password" binding:"required"`
	Code     string `json:"code"`
}

// Login handles POST /api/auth/login
func (a *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User and password are required."})
		return
	}

	user, err := a.authService.Authenticate(req.User, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials provided."})
		return
	}

	if user.TwoFactorEnabled {
		if req.Code == "" {
			c.JSON(http.StatusOK, gin.H{
				"two_factor_required": true,
				"message":             "Two-factor authentication code is required.",
			})
			return
		}

		totpHelper := security.NewTOTPHelper("PteroNext")
		valid := totpHelper.VerifyCode(user.TwoFactorSecret, req.Code)
		if !valid && user.RecoveryCodes != "" {
			var hashes []string
			if err := json.Unmarshal([]byte(user.RecoveryCodes), &hashes); err == nil {
				if idx, matched := security.VerifyBackupCode(req.Code, hashes); matched {
					valid = true
					// Consume single-use backup code
					hashes = append(hashes[:idx], hashes[idx+1:]...)
					newHashesJSON, _ := json.Marshal(hashes)
					_ = a.db.Model(&models.User{}).Where("id = ?", user.ID).Update("recovery_codes", string(newHashesJSON))
				}
			}
		}

		if !valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid two-factor authentication code."})
			return
		}
	}

	token, err := a.authService.GenerateJWT(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed generating authentication token."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":                 user.ID,
			"uuid":               user.UUID,
			"username":           user.Username,
			"email":              user.Email,
			"name_first":         user.NameFirst,
			"name_last":          user.NameLast,
			"root_admin":         user.RootAdmin,
			"two_factor_enabled": user.TwoFactorEnabled,
			"role":               user.Role,
		},
	})
}

type RegisterRequest struct {
	Username  string `json:"username" binding:"required"`
	Email     string `json:"email" binding:"required"`
	Password  string `json:"password" binding:"required"`
	NameFirst string `json:"name_first"`
	NameLast  string `json:"name_last"`
}

// Register handles POST /api/auth/register
func (a *AuthController) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username, email, and password are required."})
		return
	}

	// Check if user already exists
	var existing int64
	a.db.Model(&models.User{}).Where("username = ? OR email = ?", req.Username, req.Email).Count(&existing)
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "A user with that username or email already exists."})
		return
	}

	// Assign default member role
	var memberRole models.Role
	a.db.Where("name = ?", "Member").First(&memberRole)

	newUser := models.User{
		UUID:      uuid.New().String(),
		Username:  req.Username,
		Email:     req.Email,
		NameFirst: req.NameFirst,
		NameLast:  req.NameLast,
		RootAdmin: false,
		RoleID:    &memberRole.ID,
	}

	if err := newUser.SetPassword(req.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed hashing password."})
		return
	}

	if err := a.db.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating user account."})
		return
	}

	token, _ := a.authService.GenerateJWT(&newUser)
	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  newUser,
	})
}

// Me handles GET /api/auth/me
func (a *AuthController) Me(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}
