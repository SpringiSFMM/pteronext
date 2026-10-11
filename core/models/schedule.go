package models

import (
	"time"

	"gorm.io/gorm"
)

// Schedule represents an automated cron schedule for a server.
type Schedule struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	ServerID       uint           `gorm:"index;not null" json:"server_id"`
	Name           string         `gorm:"type:varchar(191);not null" json:"name"`
	CronDayOfWeek  string         `gorm:"type:varchar(50);default:'*'" json:"cron_day_of_week"`
	CronMonth      string         `gorm:"type:varchar(50);default:'*'" json:"cron_month"`
	CronDayOfMonth string         `gorm:"type:varchar(50);default:'*'" json:"cron_day_of_month"`
	CronHour       string         `gorm:"type:varchar(50);default:'*'" json:"cron_hour"`
	CronMinute     string         `gorm:"type:varchar(50);default:'*'" json:"cron_minute"`
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	OnlyWhenOnline bool           `gorm:"default:true" json:"only_when_online"`
	LastRunAt      *time.Time     `json:"last_run_at"`
	NextRunAt      *time.Time     `json:"next_run_at"`
	Tasks          []Task         `gorm:"foreignKey:ScheduleID;constraint:OnDelete:CASCADE" json:"tasks,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// Task represents a step inside an automated schedule.
type Task struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	ScheduleID        uint      `gorm:"index;not null" json:"schedule_id"`
	SequenceID        int       `gorm:"not null" json:"sequence_id"`
	Action            string    `gorm:"type:varchar(50);not null" json:"action"` // "command", "power", "backup"
	Payload           string    `gorm:"type:text;not null" json:"payload"`
	TimeOffset        int       `gorm:"default:0" json:"time_offset"`
	ContinueOnFailure bool      `gorm:"default:false" json:"continue_on_failure"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
