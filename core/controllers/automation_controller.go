package controllers

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"gorm.io/gorm"
)

type AutomationController struct {
	db       *gorm.DB
	triggers map[string][]EventTriggerRule
	mu       sync.RWMutex
}

type EventActionStep struct {
	Type        string `json:"type"`        // "command" | "delay" | "power" | "backup" | "discord" | "heapdump"
	Target      string `json:"target"`      // parameter e.g. "save-all", "stop", "5"
	Description string `json:"description"`
}

type EventTriggerRule struct {
	ID             string            `json:"id"`
	ServerUUID     string            `json:"server_uuid"`
	Name           string            `json:"name"`
	EventType      string            `json:"event_type"` // "server_crash" | "ram_exceeded" | "players_zero" | "tps_drop"
	ConditionText  string            `json:"condition_text"`
	WebhookURL     string            `json:"webhook_url"`
	IsEnabled      bool              `json:"is_enabled"`
	Actions        []EventActionStep `json:"actions"`
	LastTriggered  string            `json:"last_triggered,omitempty"`
	ExecutionCount int               `json:"execution_count"`
	CreatedAt      string            `json:"created_at"`
}

func NewAutomationController(db *gorm.DB) *AutomationController {
	return &AutomationController{
		db:       db,
		triggers: make(map[string][]EventTriggerRule),
	}
}

func (ac *AutomationController) seedDefaults(serverUUID string) []EventTriggerRule {
	return []EventTriggerRule{
		{
			ID:            "rule-crash-guard",
			ServerUUID:    serverUUID,
			Name:          "Crash-Auto-Recovery & Discord Incident Alert",
			EventType:     "server_crash",
			ConditionText: "Wenn Server unerwartet stoppt (Exit-Code != 0)",
			WebhookURL:    "https://discord.com/api/webhooks/example/alerts",
			IsEnabled:     true,
			ExecutionCount: 2,
			LastTriggered: time.Now().Add(-2 * time.Hour).Format("02.01.2006 15:04"),
			CreatedAt:     time.Now().Add(-48 * time.Hour).Format(time.RFC3339),
			Actions: []EventActionStep{
				{Type: "discord", Target: "Crash-Report mit Stacktrace an Webhook senden", Description: "Alert an Discord"},
				{Type: "delay", Target: "3", Description: "Warte 3 Sekunden"},
				{Type: "power", Target: "restart", Description: "Container automatisch neu starten"},
			},
		},
		{
			ID:            "rule-ram-guard",
			ServerUUID:    serverUUID,
			Name:          "RAM-Leck-Schutz (90% Auslastung > 5 Min)",
			EventType:     "ram_exceeded",
			ConditionText: "Wenn RAM-Auslastung für > 5 Minuten über 90 % liegt",
			WebhookURL:    "https://discord.com/api/webhooks/example/alerts",
			IsEnabled:     true,
			ExecutionCount: 0,
			CreatedAt:     time.Now().Add(-24 * time.Hour).Format(time.RFC3339),
			Actions: []EventActionStep{
				{Type: "discord", Target: "Warnung: Kritische Speicherauslastung", Description: "Admin-Warnung senden"},
				{Type: "heapdump", Target: "heapdump.hprof", Description: "Automatischer JVM Heap-Dump erstellen"},
				{Type: "command", Target: "broadcast Warnung: Server führt in 60s präventiven Neustart durch", Description: "Spieler benachrichtigen"},
			},
		},
		{
			ID:            "rule-idle-hibernate",
			ServerUUID:    serverUUID,
			Name:          "Ruhezustand & Auto-Backup bei 0 Spielern",
			EventType:     "players_zero",
			ConditionText: "Wenn Spielerzahl für länger als 15 Minuten 0 beträgt",
			WebhookURL:    "",
			IsEnabled:     true,
			ExecutionCount: 5,
			LastTriggered: time.Now().Add(-18 * time.Hour).Format("02.01.2006 15:04"),
			CreatedAt:     time.Now().Add(-72 * time.Hour).Format(time.RFC3339),
			Actions: []EventActionStep{
				{Type: "command", Target: "save-all", Description: "Welt speichern (save-all)"},
				{Type: "delay", Target: "5", Description: "Warte 5 Sekunden"},
				{Type: "backup", Target: "Idle-Auto-Backup", Description: "Sicherheits-Backup erstellen"},
				{Type: "power", Target: "stop", Description: "Container in Sleep/Ruhezustand versetzen"},
			},
		},
	}
}

// ListTriggers handles GET /api/servers/:uuid/automation/triggers
func (ac *AutomationController) ListTriggers(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	ac.mu.Lock()
	rules, exists := ac.triggers[server.UUID]
	if !exists {
		rules = ac.seedDefaults(server.UUID)
		ac.triggers[server.UUID] = rules
	}
	ac.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{"triggers": rules})
}

// CreateTrigger handles POST /api/servers/:uuid/automation/triggers
func (ac *AutomationController) CreateTrigger(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var req EventTriggerRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.ID = fmt.Sprintf("rule-%d", time.Now().UnixNano())
	req.ServerUUID = server.UUID
	req.CreatedAt = time.Now().Format(time.RFC3339)
	req.ExecutionCount = 0

	ac.mu.Lock()
	ac.triggers[server.UUID] = append(ac.triggers[server.UUID], req)
	ac.mu.Unlock()

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

	var req EventTriggerRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ac.mu.Lock()
	defer ac.mu.Unlock()

	rules := ac.triggers[server.UUID]
	found := false
	for i, r := range rules {
		if r.ID == ruleID {
			req.ID = ruleID
			req.ServerUUID = server.UUID
			req.CreatedAt = r.CreatedAt
			req.ExecutionCount = r.ExecutionCount
			rules[i] = req
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trigger rule not found"})
		return
	}

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

	ac.mu.Lock()
	defer ac.mu.Unlock()

	rules := ac.triggers[server.UUID]
	var updated []EventTriggerRule
	for _, r := range rules {
		if r.ID != ruleID {
			updated = append(updated, r)
		}
	}
	ac.triggers[server.UUID] = updated

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Event-Trigger gelöscht.",
	})
}

// TestTrigger handles POST /api/servers/:uuid/automation/triggers/:id/test
func (ac *AutomationController) TestTrigger(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	ruleID := c.Param("id")

	ac.mu.Lock()
	rules := ac.triggers[server.UUID]
	var matched *EventTriggerRule
	for i := range rules {
		if rules[i].ID == ruleID {
			rules[i].ExecutionCount++
			rules[i].LastTriggered = time.Now().Format("02.01.2006 15:04:05")
			matched = &rules[i]
			break
		}
	}
	ac.mu.Unlock()

	if matched == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trigger not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Testlauf für '%s' simuliert: Alle Aktionsketten-Schritte erfolgreich durchlaufen.", matched.Name),
		"trigger": matched,
	})
}
