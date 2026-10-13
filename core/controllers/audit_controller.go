package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// AuditController provides querying over the audit log trail.
type AuditController struct {
	db *gorm.DB
}

// NewAuditController creates a new AuditController.
func NewAuditController(db *gorm.DB) *AuditController {
	return &AuditController{db: db}
}

type EnrichedAuditLog struct {
	ID        uint      `json:"id"`
	UUID      string    `json:"uuid"`
	Timestamp time.Time `json:"timestamp"`
	CreatedAt time.Time `json:"created_at"`
	ActorID   *uint     `json:"actor_id"`
	ActorType string    `json:"actor_type"`
	Username  string    `json:"username"`
	ServerID  *uint     `json:"server_id"`
	Event     string    `json:"event"`
	Action    string    `json:"action"` // Aliased for UI compatibility
	Target    string    `json:"target"`
	Details   string    `json:"details"`
	IP        string    `json:"ip"`
	IPAddress string    `json:"ip_address"` // Aliased for UI compatibility
}

func (a *AuditController) enrichLogs(logs []models.AuditLog) []EnrichedAuditLog {
	if len(logs) == 0 {
		return []EnrichedAuditLog{}
	}

	// 1. Gather all unique actor IDs
	actorIDs := make([]uint, 0)
	actorSet := make(map[uint]bool)
	for _, l := range logs {
		if l.ActorID != nil && !actorSet[*l.ActorID] {
			actorSet[*l.ActorID] = true
			actorIDs = append(actorIDs, *l.ActorID)
		}
	}

	// 2. Fetch usernames in one query
	userMap := make(map[uint]string)
	if len(actorIDs) > 0 {
		var users []models.User
		a.db.Where("id IN ?", actorIDs).Find(&users)
		for _, u := range users {
			userMap[u.ID] = u.Username
		}
	}

	result := make([]EnrichedAuditLog, len(logs))
	for i, l := range logs {
		username := "System Daemon"
		if l.ActorID != nil {
			if uname, ok := userMap[*l.ActorID]; ok {
				username = uname
			} else {
				username = fmt.Sprintf("User #%d", *l.ActorID)
			}
		}

		target := ""
		details := ""

		if l.Properties != "" {
			var propMap map[string]interface{}
			if err := json.Unmarshal([]byte(l.Properties), &propMap); err == nil {
				if t, ok := propMap["target"].(string); ok && t != "" {
					target = t
				} else if p, ok := propMap["path"].(string); ok && p != "" {
					target = p
				} else if n, ok := propMap["name"].(string); ok && n != "" {
					target = n
				} else if act, ok := propMap["action"].(string); ok && act != "" {
					target = act
				}

				if d, ok := propMap["details"].(string); ok && d != "" {
					details = d
				} else if act, ok := propMap["action"].(string); ok && act != "" {
					details = fmt.Sprintf("Action: %s", act)
				} else if msg, ok := propMap["message"].(string); ok && msg != "" {
					details = msg
				} else {
					details = l.Properties
				}
			} else {
				details = l.Properties
			}
		}

		if target == "" {
			parts := strings.Split(l.Event, ":")
			if len(parts) > 1 {
				target = parts[0]
			} else {
				target = l.Event
			}
		}

		action := l.Event
		if action == "" {
			action = "audit_event"
		}

		ip := l.IP
		if ip == "" {
			ip = "127.0.0.1"
		}

		result[i] = EnrichedAuditLog{
			ID:        l.ID,
			UUID:      l.UUID,
			Timestamp: l.Timestamp,
			CreatedAt: l.CreatedAt,
			ActorID:   l.ActorID,
			ActorType: l.ActorType,
			Username:  username,
			ServerID:  l.ServerID,
			Event:     l.Event,
			Action:    action,
			Target:    target,
			Details:   details,
			IP:        ip,
			IPAddress: ip,
		}
	}

	return result
}

// ListAuditLogs handles GET /api/audit-logs
func (a *AuditController) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}

	query := a.db.Model(&models.AuditLog{}).Order("timestamp DESC")

	user, hasUser := middleware.GetRequestUser(c)
	if !hasUser || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if !user.RootAdmin {
		// Non-admins: only their own actions OR logs related to servers they own / have subuser access to
		var accessibleServerIDs []uint
		var ownedServers []models.Server
		a.db.Model(&models.Server{}).Where("owner_id = ?", user.ID).Pluck("id", &ownedServers)
		for _, s := range ownedServers {
			accessibleServerIDs = append(accessibleServerIDs, s.ID)
		}
		var subuserServers []uint
		a.db.Model(&models.Subuser{}).Where("user_id = ?", user.ID).Pluck("server_id", &subuserServers)
		accessibleServerIDs = append(accessibleServerIDs, subuserServers...)

		if len(accessibleServerIDs) > 0 {
			query = query.Where("actor_id = ? OR server_id IN (?)", user.ID, accessibleServerIDs)
		} else {
			query = query.Where("actor_id = ?", user.ID)
		}
	}

	if serverID := c.Query("server_id"); serverID != "" {
		query = query.Where("server_id = ?", serverID)
	}
	if actorID := c.Query("actor_id"); actorID != "" {
		query = query.Where("actor_id = ?", actorID)
	}
	if event := c.Query("event"); event != "" {
		query = query.Where("event LIKE ?", "%"+event+"%")
	}

	var total int64
	query.Count(&total)

	var logs []models.AuditLog
	offset := (page - 1) * perPage
	if err := query.Limit(perPage).Offset(offset).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying audit logs."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  a.enrichLogs(logs),
		"total": total,
		"page":  page,
	})
}

// ListServerAuditLogs handles GET /api/servers/:uuid/audit
func (a *AuditController) ListServerAuditLogs(c *gin.Context) {
	serverVal, exists := c.Get("server")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server context not found."})
		return
	}
	server := serverVal.(*models.Server)

	var logs []models.AuditLog
	a.db.Where("server_id = ?", server.ID).Order("timestamp DESC").Limit(100).Find(&logs)

	c.JSON(http.StatusOK, gin.H{"data": a.enrichLogs(logs)})
}

