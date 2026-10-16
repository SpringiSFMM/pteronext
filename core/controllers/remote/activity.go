package remote

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

type WingsActivityEvent struct {
	Server    string                 `json:"server"`
	User      string                 `json:"user"`
	Event     string                 `json:"event"`
	Metadata  map[string]interface{} `json:"metadata"`
	Timestamp string                 `json:"timestamp"`
	IP        string                 `json:"ip"`
}

type WingsActivityPayload struct {
	Data []WingsActivityEvent `json:"data"`
}

// ActivityRemoteController handles daemon activity events.
type ActivityRemoteController struct {
	db             *gorm.DB
	auditService   *services.AuditService
	webhookService *services.WebhookService
}

// NewActivityRemoteController creates a new ActivityRemoteController.
func NewActivityRemoteController(db *gorm.DB, auditService *services.AuditService, webhookService ...*services.WebhookService) *ActivityRemoteController {
	var wh *services.WebhookService
	if len(webhookService) > 0 {
		wh = webhookService[0]
	}
	return &ActivityRemoteController{
		db:             db,
		auditService:   auditService,
		webhookService: wh,
	}
}

// PostActivity handles POST /api/remote/activity
func (c *ActivityRemoteController) PostActivity(ctx *gin.Context) {
	node, ok := middleware.GetRequestNode(ctx)
	if !ok || node == nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized node."})
		return
	}

	var payload WingsActivityPayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload."})
		return
	}

	if len(payload.Data) == 0 {
		ctx.Status(http.StatusNoContent)
		return
	}

	// Collect server and user UUIDs to lookup IDs efficiently
	serverUUIDs := make([]string, 0, len(payload.Data))
	userUUIDs := make([]string, 0, len(payload.Data))
	for _, datum := range payload.Data {
		if datum.Server != "" {
			serverUUIDs = append(serverUUIDs, datum.Server)
		}
		if datum.User != "" {
			userUUIDs = append(userUUIDs, datum.User)
		}
	}

	serverMap := make(map[string]uint)
	if len(serverUUIDs) > 0 {
		var servers []models.Server
		c.db.Where("uuid IN (?) AND node_id = ?", serverUUIDs, node.ID).Find(&servers)
		for _, s := range servers {
			serverMap[s.UUID] = s.ID
		}
	}

	userMap := make(map[string]uint)
	if len(userUUIDs) > 0 {
		var users []models.User
		c.db.Where("uuid IN (?)", userUUIDs).Find(&users)
		for _, u := range users {
			userMap[u.UUID] = u.ID
		}
	}

	logs := make([]models.AuditLog, 0, len(payload.Data))
	for _, datum := range payload.Data {
		sID, hasServer := serverMap[datum.Server]
		if !hasServer {
			continue
		}

		var uID *uint
		if id, hasUser := userMap[datum.User]; hasUser {
			uID = &id
		}

		t, err := time.Parse(time.RFC3339, datum.Timestamp)
		if err != nil {
			t = time.Now().UTC()
		}

		metaJSON, _ := json.Marshal(datum.Metadata)

		ip := datum.IP
		if ip == "" {
			ip = "127.0.0.1"
		}

		logs = append(logs, models.AuditLog{
			UUID:       uuid.New().String(),
			ActorID:    uID,
			ActorType:  "user",
			ServerID:   &sID,
			Event:      datum.Event,
			Properties: string(metaJSON),
			IP:         ip,
			Timestamp:  t,
		})

		// Trigger webhook events for daemon signals (server.start, server.stop, server.oom, server.crash)
		if c.webhookService != nil {
			evLower := strings.ToLower(datum.Event)
			if strings.Contains(evLower, "oom") {
				c.webhookService.TriggerEvent(
					datum.Server,
					"server.oom",
					"💥 Out of Memory (OOM Killer)",
					fmt.Sprintf("Daemon signal: Container for server %s was terminated by Linux kernel OOM killer.", datum.Server),
					map[string]string{"Event": datum.Event, "Node": node.Name},
					fmt.Sprintf("https://panel.springisfm.de/server/%s", datum.Server),
				)
			} else if strings.Contains(evLower, "crash") || strings.Contains(evLower, "killed") {
				c.webhookService.TriggerEvent(
					datum.Server,
					"server.crash",
					"⚠️ Server Crash / Unexpected Exit",
					fmt.Sprintf("Daemon signal: Container for server %s exited unexpectedly (%s).", datum.Server, datum.Event),
					map[string]string{"Event": datum.Event, "Node": node.Name},
					fmt.Sprintf("https://panel.springisfm.de/server/%s", datum.Server),
				)
			} else if strings.Contains(evLower, "power.start") || strings.Contains(evLower, "daemon.start") {
				c.webhookService.TriggerEvent(
					datum.Server,
					"server.start",
					"🚀 Server Started",
					fmt.Sprintf("Daemon signal: Container for server %s has started and is running.", datum.Server),
					map[string]string{"Event": datum.Event, "Node": node.Name},
					fmt.Sprintf("https://panel.springisfm.de/server/%s", datum.Server),
				)
			} else if strings.Contains(evLower, "power.stop") || strings.Contains(evLower, "daemon.stop") {
				c.webhookService.TriggerEvent(
					datum.Server,
					"server.stop",
					"🛑 Server Stopped",
					fmt.Sprintf("Daemon signal: Container for server %s has stopped.", datum.Server),
					map[string]string{"Event": datum.Event, "Node": node.Name},
					fmt.Sprintf("https://panel.springisfm.de/server/%s", datum.Server),
				)
			}
		}
	}

	if err := c.auditService.LogBatch(logs); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed recording activity logs."})
		return
	}

	ctx.Status(http.StatusNoContent)
}
