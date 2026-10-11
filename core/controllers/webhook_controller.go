package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type WebhookController struct {
	db             *gorm.DB
	webhookService *services.WebhookService
}

func NewWebhookController(db *gorm.DB, webhookService *services.WebhookService) *WebhookController {
	return &WebhookController{
		db:             db,
		webhookService: webhookService,
	}
}

// ListWebhooks handles GET /api/servers/:uuid/webhooks
func (w *WebhookController) ListWebhooks(c *gin.Context) {
	uuid := c.Param("uuid")

	var server models.Server
	if err := w.db.Where("uuid = ?", uuid).First(&server).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	var webhooks []models.Webhook
	w.db.Where("server_id = ?", server.ID).Order("created_at desc").Find(&webhooks)

	c.JSON(http.StatusOK, gin.H{"data": webhooks})
}

// CreateWebhook handles POST /api/servers/:uuid/webhooks
func (w *WebhookController) CreateWebhook(c *gin.Context) {
	uuid := c.Param("uuid")

	var server models.Server
	if err := w.db.Where("uuid = ?", uuid).First(&server).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	var req struct {
		Name     string   `json:"name" binding:"required"`
		URL      string   `json:"url" binding:"required"`
		Platform string   `json:"platform"`
		Events   []string `json:"events"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Platform == "" {
		req.Platform = "discord"
	}
	if len(req.Events) == 0 {
		req.Events = []string{"server.crash", "backup.completed", "server.high_cpu"}
	}

	eventsJSON, _ := json.Marshal(req.Events)

	hook := models.Webhook{
		ServerID: &server.ID,
		Name:     req.Name,
		URL:      req.URL,
		Platform: req.Platform,
		Events:   string(eventsJSON),
		IsActive: true,
	}

	if err := w.db.Create(&hook).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": hook, "message": "Webhook created successfully."})
}

// DeleteWebhook handles DELETE /api/servers/:uuid/webhooks/:id
func (w *WebhookController) DeleteWebhook(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID."})
		return
	}

	if err := w.db.Delete(&models.Webhook{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Webhook removed."})
}

// TestWebhook handles POST /api/servers/:uuid/webhooks/:id/test
func (w *WebhookController) TestWebhook(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID."})
		return
	}

	if err := w.webhookService.SendTestWebhook(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Test ping delivered to Discord / Slack!"})
}
