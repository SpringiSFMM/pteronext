package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// ScheduleController manages automated schedules for servers.
type ScheduleController struct {
	db          *gorm.DB
	wingsClient *services.WingsClient
	wsHub       *services.WebSocketHub
}

// NewScheduleController creates a new ScheduleController.
func NewScheduleController(db *gorm.DB, wingsClient *services.WingsClient, wsHub *services.WebSocketHub) *ScheduleController {
	return &ScheduleController{
		db:          db,
		wingsClient: wingsClient,
		wsHub:       wsHub,
	}
}

// ListSchedules handles GET /api/servers/:uuid/schedules
func (s *ScheduleController) ListSchedules(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var schedules []models.Schedule
	if err := s.db.Preload("Tasks").Where("server_id = ?", server.ID).Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed querying schedules."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": schedules})
}

// CreateSchedule handles POST /api/servers/:uuid/schedules
func (s *ScheduleController) CreateSchedule(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)

	var schedule models.Schedule
	if err := c.ShouldBindJSON(&schedule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	schedule.ServerID = server.ID
	if err := s.db.Create(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed creating schedule."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"schedule": schedule})
}

// ToggleSchedule handles POST /api/servers/:uuid/schedules/:id/toggle
func (s *ScheduleController) ToggleSchedule(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	id := c.Param("id")

	var schedule models.Schedule
	if err := s.db.Where("id = ? AND server_id = ?", id, server.ID).First(&schedule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found."})
		return
	}

	schedule.IsActive = !schedule.IsActive
	if err := s.db.Save(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed updating schedule."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"schedule": schedule})
}

// ExecuteSchedule handles POST /api/servers/:uuid/schedules/:id/execute
func (s *ScheduleController) ExecuteSchedule(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	id := c.Param("id")

	var schedule models.Schedule
	if err := s.db.Preload("Tasks").Where("id = ? AND server_id = ?", id, server.ID).First(&schedule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found."})
		return
	}

	now := time.Now()
	schedule.LastRunAt = &now
	_ = s.db.Save(&schedule)

	executedTasks := 0
	if server.Node != nil && s.wingsClient != nil {
		for _, task := range schedule.Tasks {
			switch task.Action {
			case "command":
				_ = s.wingsClient.SendCommand(server.Node, server.UUID, task.Payload)
				if s.wsHub != nil {
					s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("[Schedule: %s] > %s", schedule.Name, task.Payload))
				}
				executedTasks++
			case "power":
				_ = s.wingsClient.SendPowerAction(server.Node, server.UUID, task.Payload)
				executedTasks++
			}
		}
	}

	if executedTasks == 0 && s.wsHub != nil {
		s.wsHub.Broadcast(server.UUID, "console output", fmt.Sprintf("[Schedule: %s] Triggered execution at %s", schedule.Name, now.Format("15:04:05")))
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Schedule executed successfully.",
		"schedule":       schedule,
		"executed_tasks": executedTasks,
	})
}

// DeleteSchedule handles DELETE /api/servers/:uuid/schedules/:id
func (s *ScheduleController) DeleteSchedule(c *gin.Context) {
	server, _ := middleware.GetRequestServer(c)
	id := c.Param("id")

	var schedule models.Schedule
	if err := s.db.Where("id = ? AND server_id = ?", id, server.ID).First(&schedule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found."})
		return
	}

	if err := s.db.Delete(&schedule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed deleting schedule."})
		return
	}

	c.Status(http.StatusNoContent)
}
