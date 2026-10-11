package controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// APIKeyController manages account API keys.
type APIKeyController struct {
	db *gorm.DB
}

// NewAPIKeyController creates a new APIKeyController.
func NewAPIKeyController(db *gorm.DB) *APIKeyController {
	return &APIKeyController{db: db}
}

// ListAPIKeys handles GET /api/account/api-keys
func (k *APIKeyController) ListAPIKeys(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)

	var keys []models.APIKey
	if err := k.db.Where("user_id = ?", user.ID).Find(&keys).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying API keys."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": keys})
}

type CreateAPIKeyRequest struct {
	Memo          string   `json:"memo"`
	Description   string   `json:"description"`
	AllowedIPs    string   `json:"allowed_ips"`
	Permissions   []string `json:"permissions"`
	ExpiresInDays *int     `json:"expires_in_days"`
}

// CreateAPIKey handles POST /api/account/api-keys
func (k *APIKeyController) CreateAPIKey(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)

	var req CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	memo := req.Memo
	if memo == "" && req.Description != "" {
		memo = req.Description
	}

	var expiresAt *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, *req.ExpiresInDays)
		expiresAt = &exp
	}

	apiKey, rawKey, err := models.GenerateNewAPIKey(user.ID, models.KeyTypeAccount, memo, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed generating API key."})
		return
	}
	apiKey.AllowedIPs = req.AllowedIPs

	if err := k.db.Create(apiKey).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed storing API key."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"api_key": apiKey,
		"secret":  rawKey, // Only shown once
	})
}

// DeleteAPIKey handles DELETE /api/account/api-keys/:id
func (k *APIKeyController) DeleteAPIKey(c *gin.Context) {
	user, _ := middleware.GetRequestUser(c)
	id := c.Param("id")

	var apiKey models.APIKey
	if err := k.db.Where("id = ? AND user_id = ?", id, user.ID).First(&apiKey).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found."})
		return
	}

	if err := k.db.Delete(&apiKey).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting API key."})
		return
	}

	c.Status(http.StatusNoContent)
}
