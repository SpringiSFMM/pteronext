package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type AutomationController struct {
	db     *gorm.DB
	client *http.Client
}

type EventActionStep struct {
	Type        string `json:"type"` // "command" | "delay" | "power" | "backup" | "discord" | "heapdump"
	Target      string `json:"target"`
	Description string `json:"description"`
}

type EventTriggerRuleDTO struct {
	ID             string            `json:"id"`
	ServerUUID     string            `json:"server_uuid"`
	Name           string            `json:"name"`
	EventType      string            `json:"event_type"` // "server_crash" | "ram_exceeded" | "players_zero" | "tps_drop"
	ConditionText  string            `json:"condition_text"`
	WebhookURL     string            `json:"webhook_url"`
	IsEnabled      bool              `json:"is_enabled"`
	ExecutionCount int               `json:"execution_count"`
	LastTriggered  string            `json:"last_triggered,omitempty"`
	CreatedAt      string            `json:"created_at"`
	Actions        []EventActionStep `json:"actions"`
}

func NewAutomationController(db *gorm.DB) *AutomationController {
	return &AutomationController{
		db: db,
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (ac *AutomationController) seedDefaultsIfEmpty(server *models.Server) {
	var count int64
	ac.db.Unscoped().Model(&models.ServerTrigger{}).Where("server_id = ?", server.ID).Count(&count)
	if count > 0 {
		return
	}

	defaults := []struct {
		TriggerID     string
		Name          string
		EventType     string
		ConditionText string
		Actions       []EventActionStep
	}{
		{
			TriggerID:     "rule-crash-autorecover",
			Name:          "Crash-Auto-Recovery & Discord Incident Alert",
			EventType:     "server_crash",
			ConditionText: "Wenn Server unerwartet stoppt (Exit-Code ≠ 0)",
			Actions: []EventActionStep{
				{Type: "discord", Target: "Crash-Incident", Description: "Alert an Discord"},
				{Type: "delay", Target: "3", Description: "Warte 3 Sekunden"},
				{Type: "power", Target: "restart", Description: "Container automatisch neu starten"},
			},
		},
		{
			TriggerID:     "rule-idle-hibernate",
			Name:          "Ruhezustand & Auto-Backup bei 0 Spielern",
			EventType:     "players_zero",
			ConditionText: "Wenn Spielerzahl für länger als 15 Minuten 0 beträgt",
			Actions: []EventActionStep{
				{Type: "command", Target: "save-all", Description: "Welt speichern (save-all)"},
				{Type: "delay", Target: "5", Description: "Warte 5 Sekunden"},
				{Type: "backup", Target: "Idle-Auto-Backup", Description: "Sicherheits-Backup erstellen"},
				{Type: "power", Target: "stop", Description: "Container in Sleep/Ruhezustand versetzen"},
			},
		},
	}

	for _, d := range defaults {
		actionsJSON, _ := json.Marshal(d.Actions)
		rule := models.ServerTrigger{
			TriggerID:      d.TriggerID,
			ServerID:       server.ID,
			ServerUUID:     server.UUID,
			Name:           d.Name,
			EventType:      d.EventType,
			ConditionText:  d.ConditionText,
			ActionsJSON:    string(actionsJSON),
			IsEnabled:      true,
			ExecutionCount: 0,
			CreatedAt:      time.Now(),
		}
		_ = ac.db.Create(&rule).Error
	}
}

// ListTriggers handles GET /api/servers/:uuid/automation/triggers
func (ac *AutomationController) ListTriggers(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	ac.seedDefaultsIfEmpty(server)

	var triggers []models.ServerTrigger
	ac.db.Where("server_id = ?", server.ID).Order("created_at asc").Find(&triggers)

	dtos := make([]EventTriggerRuleDTO, 0, len(triggers))
	for _, t := range triggers {
		var actions []EventActionStep
		_ = json.Unmarshal([]byte(t.ActionsJSON), &actions)
		dtos = append(dtos, EventTriggerRuleDTO{
			ID:             t.TriggerID,
			ServerUUID:     t.ServerUUID,
			Name:           t.Name,
			EventType:      t.EventType,
			ConditionText:  t.ConditionText,
			WebhookURL:     t.WebhookURL,
			IsEnabled:      t.IsEnabled,
			ExecutionCount: t.ExecutionCount,
			LastTriggered:  t.LastTriggered,
			CreatedAt:      t.CreatedAt.Format("02.01.2006 15:04"),
			Actions:        actions,
		})
	}

	c.JSON(http.StatusOK, gin.H{"triggers": dtos})
}

// CreateTrigger handles POST /api/servers/:uuid/automation/triggers
func (ac *AutomationController) CreateTrigger(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req EventTriggerRuleDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	triggerID := fmt.Sprintf("rule-%d", time.Now().UnixNano())
	actionsJSON, _ := json.Marshal(req.Actions)

	rule := models.ServerTrigger{
		TriggerID:      triggerID,
		ServerID:       server.ID,
		ServerUUID:     server.UUID,
		Name:           req.Name,
		EventType:      req.EventType,
		ConditionText:  req.ConditionText,
		WebhookURL:     req.WebhookURL,
		IsEnabled:      true,
		ExecutionCount: 0,
		ActionsJSON:    string(actionsJSON),
		CreatedAt:      time.Now(),
	}

	if err := ac.db.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create trigger: " + err.Error()})
		return
	}

	req.ID = triggerID
	req.ServerUUID = server.UUID
	req.CreatedAt = rule.CreatedAt.Format("02.01.2006 15:04")

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"trigger": req,
		"message": "Smart Event-Trigger erfolgreich erstellt.",
	})
}

// UpdateTrigger handles PUT /api/servers/:uuid/automation/triggers/:id
func (ac *AutomationController) UpdateTrigger(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	ruleID := c.Param("id")

	var rule models.ServerTrigger
	if err := ac.db.Where("server_id = ? AND trigger_id = ?", server.ID, ruleID).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trigger rule not found"})
		return
	}

	var req EventTriggerRuleDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actionsJSON, _ := json.Marshal(req.Actions)
	rule.Name = req.Name
	rule.EventType = req.EventType
	rule.ConditionText = req.ConditionText
	rule.WebhookURL = req.WebhookURL
	rule.IsEnabled = req.IsEnabled
	rule.ActionsJSON = string(actionsJSON)

	if err := ac.db.Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req.ID = ruleID
	req.ServerUUID = server.UUID
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"trigger": req,
		"message": "Trigger rule updated.",
	})
}

// DeleteTrigger handles DELETE /api/servers/:uuid/automation/triggers/:id
func (ac *AutomationController) DeleteTrigger(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	ruleID := c.Param("id")

	res := ac.db.Where("server_id = ? AND trigger_id = ?", server.ID, ruleID).Delete(&models.ServerTrigger{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": res.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Event-Trigger dauerhaft gelöscht.",
	})
}

// TestTrigger handles POST /api/servers/:uuid/automation/triggers/:id/test
func (ac *AutomationController) TestTrigger(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	ruleID := c.Param("id")

	var rule models.ServerTrigger
	if err := ac.db.Where("server_id = ? AND trigger_id = ?", server.ID, ruleID).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trigger not found"})
		return
	}

	rule.ExecutionCount++
	rule.LastTriggered = time.Now().Format("02.01.2006 15:04:05")
	_ = ac.db.Save(&rule)

	var actions []EventActionStep
	_ = json.Unmarshal([]byte(rule.ActionsJSON), &actions)

	webhookDelivered := false
	webhookStatusMsg := ""

	// Check if webhook dispatch is requested
	targetWebhook := strings.TrimSpace(rule.WebhookURL)
	if targetWebhook != "" && (strings.HasPrefix(targetWebhook, "http://") || strings.HasPrefix(targetWebhook, "https://")) {
		if strings.Contains(targetWebhook, "discord.com") {
			embed := gin.H{
				"title":       fmt.Sprintf("⚡ Testlauf: %s", rule.Name),
				"description": fmt.Sprintf("Event-Trigger **%s** wurde erfolgreich simuliert.\nServer: `%s` (%s)\nBedingung: *%s*", rule.Name, server.Name, server.UUID[:8], rule.ConditionText),
				"color":       0xf59e0b, // Amber
				"fields": []gin.H{
					{"name": "Ereignis-Typ", "value": rule.EventType, "inline": true},
					{"name": "Aktionen", "value": fmt.Sprintf("%d Schritte verkettet", len(actions)), "inline": true},
					{"name": "Status", "value": "Erfolgreich simuliert", "inline": true},
				},
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"footer": gin.H{
					"text": "PteroNext Smart Automation Engine",
				},
			}
			payload := gin.H{
				"username":   "PteroNext Automation",
				"avatar_url": "https://panel.springisfm.de/favicon.ico",
				"embeds":     []gin.H{embed},
			}

			bodyBytes, _ := json.Marshal(payload)
			req, rErr := http.NewRequest(http.MethodPost, targetWebhook, bytes.NewBuffer(bodyBytes))
			if rErr == nil {
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("User-Agent", "PteroNext-Automation-Bot/1.0")
				resp, doErr := ac.client.Do(req)
				if doErr == nil {
					resp.Body.Close()
					if resp.StatusCode >= 200 && resp.StatusCode < 300 {
						webhookDelivered = true
						webhookStatusMsg = "Discord Alert erfolgreich zugestellt!"
					} else {
						webhookStatusMsg = fmt.Sprintf("Discord Webhook gab Status %d zurück", resp.StatusCode)
					}
				} else {
					webhookStatusMsg = fmt.Sprintf("Fehler beim Senden: %v", doErr)
				}
			}
		} else {
			// Generic HTTP Webhook post
			bodyBytes, _ := json.Marshal(gin.H{
				"event":          rule.EventType,
				"trigger_name":   rule.Name,
				"server_uuid":    server.UUID,
				"server_name":    server.Name,
				"condition_text": rule.ConditionText,
				"simulated":      true,
			})
			req, _ := http.NewRequest(http.MethodPost, targetWebhook, bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			resp, doErr := ac.client.Do(req)
			if doErr == nil {
				resp.Body.Close()
				webhookDelivered = true
				webhookStatusMsg = "Webhook erfolgreich gesendet."
			} else {
				webhookStatusMsg = fmt.Sprintf("HTTP Webhook Fehler: %v", doErr)
			}
		}
	} else if targetWebhook != "" {
		webhookStatusMsg = "Hinweis: Keine gültige HTTP(S) Webhook-URL hinterlegt."
	}

	statusMsg := fmt.Sprintf("Testlauf für '%s' simuliert. Alle %d Schritte durchlaufen.", rule.Name, len(actions))
	if webhookStatusMsg != "" {
		statusMsg = fmt.Sprintf("%s (%s)", statusMsg, webhookStatusMsg)
	}

	dto := EventTriggerRuleDTO{
		ID:             rule.TriggerID,
		ServerUUID:     rule.ServerUUID,
		Name:           rule.Name,
		EventType:      rule.EventType,
		ConditionText:  rule.ConditionText,
		WebhookURL:     rule.WebhookURL,
		IsEnabled:      rule.IsEnabled,
		ExecutionCount: rule.ExecutionCount,
		LastTriggered:  rule.LastTriggered,
		CreatedAt:      rule.CreatedAt.Format("02.01.2006 15:04"),
		Actions:        actions,
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"message":           statusMsg,
		"webhook_delivered": webhookDelivered,
		"trigger":           dto,
	})
}
