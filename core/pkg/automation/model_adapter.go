package automation

import (
	"fmt"
	"strconv"
	"time"

	"github.com/pteronext/panel-core/models"
)

// FromModel converts a GORM models.Schedule entity into an automation.Schedule.
func FromModel(m *models.Schedule) *Schedule {
	if m == nil {
		return nil
	}

	visual := VisualCron{
		Minute:     m.CronMinute,
		Hour:       m.CronHour,
		DayOfMonth: m.CronDayOfMonth,
		Month:      m.CronMonth,
		DayOfWeek:  m.CronDayOfWeek,
	}

	sched := &Schedule{
		ID:             fmt.Sprintf("%d", m.ID),
		ServerID:       fmt.Sprintf("%d", m.ServerID),
		Name:           m.Name,
		CronExpr:       visual.Expression(),
		VisualFields:   visual,
		IsActive:       m.IsActive,
		OnlyWhenOnline: m.OnlyWhenOnline,
		LastRunAt:      m.LastRunAt,
		NextRunAt:      m.NextRunAt,
		CreatedAt:      m.CreatedAt,
		UpdatedAt:      m.UpdatedAt,
		Steps:          make([]ActionStep, 0, len(m.Tasks)),
	}

	for _, t := range m.Tasks {
		sched.Steps = append(sched.Steps, ActionStep{
			ID:                fmt.Sprintf("%d", t.ID),
			ScheduleID:        fmt.Sprintf("%d", t.ScheduleID),
			Sequence:          t.SequenceID,
			Action:            ActionType(t.Action),
			Payload:           t.Payload,
			TimeOffset:        time.Duration(t.TimeOffset) * time.Second,
			ContinueOnFailure: t.ContinueOnFailure,
		})
	}

	return sched
}

// ToModel converts an automation.Schedule back to a GORM models.Schedule and its associated tasks.
func ToModel(s *Schedule) (*models.Schedule, []models.Task) {
	if s == nil {
		return nil, nil
	}

	schedID, _ := strconv.ParseUint(s.ID, 10, 64)
	serverID, _ := strconv.ParseUint(s.ServerID, 10, 64)

	m := &models.Schedule{
		ID:             uint(schedID),
		ServerID:       uint(serverID),
		Name:           s.Name,
		CronMinute:     s.VisualFields.Minute,
		CronHour:       s.VisualFields.Hour,
		CronDayOfMonth: s.VisualFields.DayOfMonth,
		CronMonth:      s.VisualFields.Month,
		CronDayOfWeek:  s.VisualFields.DayOfWeek,
		IsActive:       s.IsActive,
		OnlyWhenOnline: s.OnlyWhenOnline,
		LastRunAt:      s.LastRunAt,
		NextRunAt:      s.NextRunAt,
		CreatedAt:      s.CreatedAt,
		UpdatedAt:      s.UpdatedAt,
	}

	tasks := make([]models.Task, 0, len(s.Steps))
	for _, step := range s.Steps {
		tID, _ := strconv.ParseUint(step.ID, 10, 64)
		tasks = append(tasks, models.Task{
			ID:                uint(tID),
			ScheduleID:        uint(schedID),
			SequenceID:        step.Sequence,
			Action:            string(step.Action),
			Payload:           step.Payload,
			TimeOffset:        int(step.TimeOffset / time.Second),
			ContinueOnFailure: step.ContinueOnFailure,
		})
	}
	m.Tasks = tasks

	return m, tasks
}
