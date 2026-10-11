package controllers

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type AdminPresenceInfo struct {
	UserID    uint      `json:"user_id"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatar_url"`
	Activity  string    `json:"activity"` // e.g. "Viewing Console", "Editing server.properties"
	LastSeen  time.Time `json:"last_seen"`
}

type IncidentController struct {
	db          *gorm.DB
	wingsClient *services.WingsClient
	wsHub       *services.WebSocketHub
	webhook     *services.WebhookService
	presenceMu  sync.RWMutex
	presence    map[string]map[uint]*AdminPresenceInfo // serverUUID -> userID -> AdminPresenceInfo
}

func NewIncidentController(db *gorm.DB, wingsClient *services.WingsClient, wsHub *services.WebSocketHub, webhook *services.WebhookService) *IncidentController {
	return &IncidentController{
		db:          db,
		wingsClient: wingsClient,
		wsHub:       wsHub,
		webhook:     webhook,
		presence:    make(map[string]map[uint]*AdminPresenceInfo),
	}
}

// GetStatus handles GET /api/servers/:uuid/incident/status
func (in *IncidentController) GetStatus(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	c.JSON(http.StatusOK, gin.H{
		"is_frozen":     server.IsFrozen,
		"freeze_reason": server.FreezeReason,
	})
}

// ToggleFreeze handles POST /api/servers/:uuid/incident/freeze
func (in *IncidentController) ToggleFreeze(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	var req struct {
		Freeze bool   `json:"freeze"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server.IsFrozen = req.Freeze
	server.FreezeReason = req.Reason
	if server.IsFrozen && server.FreezeReason == "" {
		server.FreezeReason = "Administrative investigation / exploit isolation"
	}

	if err := in.db.Model(&server).Updates(map[string]interface{}{
		"is_frozen":     server.IsFrozen,
		"freeze_reason": server.FreezeReason,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if server.IsFrozen {
		// Enforce server whitelist & broadcast hazard warning
		_ = in.wingsClient.SendCommand(server.Node, server.UUID, "whitelist on")
		_ = in.wingsClient.SendCommand(server.Node, server.UUID, "say [INCIDENT MODE] Server locked in Safe Mode by staff.")
		in.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[41m\x1b[37m[INCIDENT MODE ENGAGED]\x1b[0m Server isolated in Safe Mode by %s. Reason: %s", user.Username, server.FreezeReason))

		// Webhook notification
		if in.webhook != nil {
			in.webhook.TriggerEvent(server.UUID, "server.incident", "⚠️ INCIDENT MODE ENGAGED",
				fmt.Sprintf("Admin %s engaged Safe Mode Freeze on %s.", user.Username, server.Name),
				map[string]string{"Reason": server.FreezeReason, "Isolation": "Whitelist Enforced"},
				fmt.Sprintf("https://panel.springisfm.de/servers/%s", server.UUID),
			)
		}
	} else {
		in.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("\x1b[42m\x1b[37m[SAFE MODE RELEASED]\x1b[0m Server restored to normal operational state by %s.", user.Username))
	}

	c.JSON(http.StatusOK, gin.H{
		"is_frozen":     server.IsFrozen,
		"freeze_reason": server.FreezeReason,
		"message":       fmt.Sprintf("Safe Mode %s.", map[bool]string{true: "activated", false: "deactivated"}[server.IsFrozen]),
	})
}

// PostPresence handles POST /api/servers/:uuid/presence
func (in *IncidentController) PostPresence(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	user, _ := middleware.GetRequestUser(c)

	var req struct {
		Activity string `json:"activity"`
	}
	_ = c.ShouldBindJSON(&req)

	activity := req.Activity
	if activity == "" {
		activity = "Active in Server Workspace"
	}

	in.presenceMu.Lock()
	if in.presence[server.UUID] == nil {
		in.presence[server.UUID] = make(map[uint]*AdminPresenceInfo)
	}

	in.presence[server.UUID][user.ID] = &AdminPresenceInfo{
		UserID:    user.ID,
		Username:  user.Username,
		AvatarURL: fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%s", user.Username),
		Activity:  activity,
		LastSeen:  time.Now(),
	}
	in.presenceMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GetPresence handles GET /api/servers/:uuid/presence
func (in *IncidentController) GetPresence(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	in.presenceMu.Lock()
	defer in.presenceMu.Unlock()

	var active []AdminPresenceInfo
	now := time.Now()

	if m, ok := in.presence[server.UUID]; ok {
		for uID, p := range m {
			if now.Sub(p.LastSeen) < 30*time.Second {
				active = append(active, *p)
			} else {
				delete(m, uID)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": active})
}
