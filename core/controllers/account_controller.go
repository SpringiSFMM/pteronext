package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/pkg/security"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// AccountController manages user account profile, passwords, and 2FA settings.
type AccountController struct {
	db              *gorm.DB
	auditService    *services.AuditService
	totp            *security.TOTPHelper
	passwordManager *security.PasswordManager
}

// NewAccountController creates a new AccountController.
func NewAccountController(db *gorm.DB, auditService *services.AuditService) *AccountController {
	return &AccountController{
		db:              db,
		auditService:    auditService,
		totp:            security.NewTOTPHelper("PteroNext"),
		passwordManager: security.NewPasswordManager(),
	}
}

// GetAccount handles GET /api/account
func (a *AccountController) GetAccount(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var freshUser models.User
	if err := a.db.Preload("Role").First(&freshUser, user.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                 freshUser.ID,
			"uuid":               freshUser.UUID,
			"username":           freshUser.Username,
			"email":              freshUser.Email,
			"name_first":         freshUser.NameFirst,
			"name_last":          freshUser.NameLast,
			"avatar_url":         freshUser.AvatarURL,
			"discord_id":         freshUser.DiscordID,
			"discord_username":   freshUser.DiscordUsername,
			"discord_linked_at":  freshUser.DiscordLinkedAt,
			"root_admin":         freshUser.RootAdmin,
			"two_factor_enabled": freshUser.TwoFactorEnabled,
			"role":               freshUser.Role,
		},
	})
}

type UpdateProfileRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	NameFirst string `json:"name_first"`
	NameLast  string `json:"name_last"`
	AvatarURL *string `json:"avatar_url"`
}

// UpdateProfile handles PUT /api/account/profile
// Changes email and names.
func (a *AccountController) UpdateProfile(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.User
	if err := a.db.First(&existing, user.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	updates := make(map[string]interface{})

	if req.Username != "" && req.Username != existing.Username {
		var count int64
		a.db.Model(&models.User{}).Where("username = ? AND id != ?", req.Username, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Username is already taken by another account."})
			return
		}
		updates["username"] = req.Username
		existing.Username = req.Username
	}

	if req.Email != "" && req.Email != existing.Email {
		if !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid email address is required."})
			return
		}
		var count int64
		a.db.Model(&models.User{}).Where("email = ? AND id != ?", req.Email, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Email is already taken by another account."})
			return
		}
		updates["email"] = req.Email
		existing.Email = req.Email
	}

	if req.NameFirst != "" {
		updates["name_first"] = req.NameFirst
		existing.NameFirst = req.NameFirst
	}
	if req.NameLast != "" {
		updates["name_last"] = req.NameLast
		existing.NameLast = req.NameLast
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = *req.AvatarURL
		existing.AvatarURL = *req.AvatarURL
	}

	if len(updates) > 0 {
		if err := a.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating profile"})
			return
		}
	}

	if a.auditService != nil {
		_ = a.auditService.Log(&user.ID, "user", nil, "account:profile.update", updates, c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"user": gin.H{
			"id":                 existing.ID,
			"uuid":               existing.UUID,
			"username":           existing.Username,
			"email":              existing.Email,
			"name_first":         existing.NameFirst,
			"name_last":          existing.NameLast,
			"avatar_url":         existing.AvatarURL,
			"discord_id":         existing.DiscordID,
			"discord_username":   existing.DiscordUsername,
			"root_admin":         existing.RootAdmin,
			"two_factor_enabled": existing.TwoFactorEnabled,
		},
	})
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password"`
	Password        string `json:"password"`
	Algorithm       string `json:"algorithm"` // optional: "argon2id" or "bcrypt"
}

// UpdatePassword handles PUT /api/account/password
// Changes user password (validates current password, updates with Argon2id/bcrypt).
func (a *AccountController) UpdatePassword(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is required."})
		return
	}

	newPassword := strings.TrimSpace(req.NewPassword)
	if newPassword == "" {
		newPassword = strings.TrimSpace(req.Password)
	}

	if newPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password is required."})
		return
	}

	if len(newPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be at least 8 characters long."})
		return
	}

	var existing models.User
	if err := a.db.First(&existing, user.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if !existing.CheckPassword(req.CurrentPassword) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect."})
		return
	}

	var newHash string
	var err error
	if strings.ToLower(req.Algorithm) == "bcrypt" {
		newHash, err = a.passwordManager.HashBcrypt(newPassword)
	} else {
		newHash, err = a.passwordManager.HashArgon2id(newPassword)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed hashing new password."})
		return
	}

	if err := a.db.Model(&models.User{}).Where("id = ?", user.ID).Update("password", newHash).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating password."})
		return
	}

	if a.auditService != nil {
		_ = a.auditService.Log(&user.ID, "user", nil, "account:password.update", nil, c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully."})
}

// Setup2FA handles POST /api/account/2fa/setup
// Generates new TOTP secret, returns base32 secret, otpauth URL, and base64 QR code image data.
func (a *AccountController) Setup2FA(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	accountName := user.Email
	if accountName == "" {
		accountName = user.Username
	}

	setup, err := a.totp.GenerateSetup(accountName, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed generating 2FA credentials."})
		return
	}

	// Save temporary secret to user model
	_ = a.db.Model(&models.User{}).Where("id = ?", user.ID).Update("two_factor_secret", setup.Secret)

	c.JSON(http.StatusOK, gin.H{
		"secret":           setup.Secret,
		"otpauth_url":      setup.KeyURI,
		"key_uri":          setup.KeyURI,
		"qr_code":          setup.QRCodeDataURL,
		"qr_code_data_url": setup.QRCodeDataURL,
	})
}

type Enable2FARequest struct {
	Code   string `json:"code" binding:"required"`
	Secret string `json:"secret"`
}

// Enable2FA handles POST /api/account/2fa/enable
// Accepts 6-digit TOTP code and temporary secret, validates it, marks two_factor_enabled = true on the User,
// generates and returns backup recovery codes.
func (a *AccountController) Enable2FA(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req Enable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A 6-digit TOTP code is required."})
		return
	}

	secret := strings.TrimSpace(req.Secret)
	if secret == "" {
		var u models.User
		if err := a.db.First(&u, user.ID).Error; err == nil {
			secret = u.TwoFactorSecret
		}
	}

	if secret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "TOTP secret is required. Please call setup first or provide secret."})
		return
	}

	code := strings.TrimSpace(req.Code)
	if !a.totp.VerifyCode(secret, code) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid 6-digit TOTP code. Please try again."})
		return
	}

	plainCodes, hashedCodes, err := security.GenerateBackupCodes(10, 8)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed generating backup recovery codes."})
		return
	}

	hashedJSON, err := json.Marshal(hashedCodes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed encoding recovery codes."})
		return
	}

	updates := map[string]interface{}{
		"two_factor_secret":  secret,
		"two_factor_enabled": true,
		"recovery_codes":     string(hashedJSON),
	}

	if err := a.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed enabling two-factor authentication."})
		return
	}

	if a.auditService != nil {
		_ = a.auditService.Log(&user.ID, "user", nil, "account:2fa.enable", nil, c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "Two-factor authentication successfully enabled.",
		"two_factor_enabled": true,
		"recovery_codes":     plainCodes,
		"backup_codes":       plainCodes,
	})
}

type Disable2FARequest struct {
	Password string `json:"password"`
	Code     string `json:"code"`
	TOTPCode string `json:"totp_code"`
}

// Disable2FA handles POST /api/account/2fa/disable
// Disables 2FA (requires current password or TOTP code).
func (a *AccountController) Disable2FA(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req Disable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password or 6-digit TOTP code is required."})
		return
	}

	code := strings.TrimSpace(req.Code)
	if code == "" {
		code = strings.TrimSpace(req.TOTPCode)
	}

	if req.Password == "" && code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password or 6-digit TOTP code is required."})
		return
	}

	var existing models.User
	if err := a.db.First(&existing, user.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if !existing.TwoFactorEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Two-factor authentication is not currently enabled."})
		return
	}

	verified := false

	// Verify via password if provided
	if req.Password != "" {
		if existing.CheckPassword(req.Password) {
			verified = true
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Incorrect password provided."})
			return
		}
	}

	// Verify via TOTP code if provided and not yet verified
	if !verified && code != "" {
		if a.totp.VerifyCode(existing.TwoFactorSecret, code) {
			verified = true
		} else {
			// Check backup codes
			if existing.RecoveryCodes != "" {
				var storedHashes []string
				if err := json.Unmarshal([]byte(existing.RecoveryCodes), &storedHashes); err == nil {
					if _, matched := security.VerifyBackupCode(code, storedHashes); matched {
						verified = true
					}
				}
			}
			if !verified {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid TOTP verification code."})
				return
			}
		}
	}

	if !verified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification failed."})
		return
	}

	updates := map[string]interface{}{
		"two_factor_secret":  "",
		"two_factor_enabled": false,
		"recovery_codes":     "",
	}

	if err := a.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed disabling 2FA."})
		return
	}

	if a.auditService != nil {
		_ = a.auditService.Log(&user.ID, "user", nil, "account:2fa.disable", nil, c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{
		"two_factor_enabled": false,
		"message":            "Two-factor authentication has been disabled.",
	})
}

// GetActivity handles GET /api/account/activity
// Returns recent audit logs for the authenticated user.
func (a *AccountController) GetActivity(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "25"))
	if perPage < 1 || perPage > 100 {
		perPage = 25
	}

	query := a.db.Model(&models.AuditLog{}).Where("actor_id = ?", user.ID).Order("timestamp DESC")

	if event := c.Query("event"); event != "" {
		query = query.Where("event LIKE ?", "%"+event+"%")
	}

	var total int64
	query.Count(&total)

	var logs []models.AuditLog
	offset := (page - 1) * perPage
	if err := query.Limit(perPage).Offset(offset).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying activity logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
	})
}

type UpdateThemeRequest struct {
	Theme       string `json:"theme"`
	GlobalTheme string `json:"global_theme"`
	CustomCSS   string `json:"custom_css"`
}

func (r *UpdateThemeRequest) GetTheme() string {
	if r.Theme != "" {
		return r.Theme
	}
	return r.GlobalTheme
}

// GetUserTheme handles GET /api/user/theme
func (a *AccountController) GetUserTheme(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var u models.User
	if err := a.db.First(&u, user.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Fetch global theme for fallback
	var globalThemeSetting models.SystemSetting
	a.db.Where("key = ?", "theme_global").First(&globalThemeSetting)
	globalTheme := globalThemeSetting.Value
	if globalTheme == "" {
		globalTheme = "zinc"
	}

	effectiveTheme := u.Theme
	if effectiveTheme == "" {
		effectiveTheme = globalTheme
	}

	c.JSON(http.StatusOK, gin.H{
		"theme":               effectiveTheme,
		"personal_theme":      u.Theme,
		"personal_custom_css": u.CustomCSS,
		"global_theme":        globalTheme,
		"effective_theme":     effectiveTheme,
	})
}

// UpdateUserTheme handles PUT /api/user/theme
func (a *AccountController) UpdateUserTheme(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	themeToSet := req.GetTheme()
	updates := map[string]interface{}{
		"theme": themeToSet,
	}
	if req.CustomCSS != "" || c.Request.ContentLength > 0 {
		updates["custom_css"] = req.CustomCSS
	}

	if err := a.db.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating user theme"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User theme preferences saved.",
		"theme":   themeToSet,
	})
}

// GetGlobalTheme handles GET /api/theme/global (Public, used before login & preloader)
func (a *AccountController) GetGlobalTheme(c *gin.Context) {
	var themeSetting models.SystemSetting
	a.db.Where("key = ?", "theme_global").First(&themeSetting)
	val := themeSetting.Value
	if val == "" {
		val = "zinc"
	}

	var cssSetting models.SystemSetting
	a.db.Where("key = ?", "theme_global_css").First(&cssSetting)

	c.JSON(http.StatusOK, gin.H{
		"global_theme": val,
		"global_css":   cssSetting.Value,
	})
}

// UpdateGlobalTheme handles PUT /api/admin/theme (Admin only)
func (a *AccountController) UpdateGlobalTheme(c *gin.Context) {
	user, ok := middleware.GetRequestUser(c)
	if !ok || user == nil || !user.RootAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only root administrators can modify global themes"})
		return
	}

	var req UpdateThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	themeToSet := req.GetTheme()
	if themeToSet != "" {
		var s models.SystemSetting
		a.db.Where("key = ?", "theme_global").FirstOrCreate(&s, models.SystemSetting{Key: "theme_global"})
		s.Value = themeToSet
		a.db.Save(&s)
	}

	var css models.SystemSetting
	a.db.Where("key = ?", "theme_global_css").FirstOrCreate(&css, models.SystemSetting{Key: "theme_global_css"})
	css.Value = req.CustomCSS
	a.db.Save(&css)

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      "Global theme updated successfully.",
		"global_theme": themeToSet,
	})
}
