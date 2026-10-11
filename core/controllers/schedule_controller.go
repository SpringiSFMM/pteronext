package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// ScheduleController manages automated schedules for servers.
type ScheduleController struct {
	db *gorm.DB
}

// NewScheduleController creates a new ScheduleController.
func NewScheduleController(db *gorm.DB) *ScheduleController {
	return &ScheduleController{db: db}
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
