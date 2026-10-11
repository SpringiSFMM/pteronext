package models

import (
	"time"

	"gorm.io/gorm"
)

// Webhook stores webhook endpoints configured for servers or global cluster events.
type Webhook struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ServerID    *uint          `gorm:"index" json:"server_id,omitempty"`
	Server      *Server        `gorm:"foreignKey:ServerID" json:"server,omitempty"`
	Name        string         `gorm:"type:varchar(191);not null" json:"name"`
	URL         string         `gorm:"type:text;not null" json:"url"`
	Secret      string         `gorm:"type:varchar(191)" json:"secret,omitempty"`
	Platform    string         `gorm:"type:varchar(50);default:'discord'" json:"platform"` // "discord" or "slack"
	Events      string         `gorm:"type:text;not null" json:"events"`                  // JSON array of event names e.g. ["server.crash","backup.completed"]
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	LastTrigger *time.Time     `json:"last_trigger,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
