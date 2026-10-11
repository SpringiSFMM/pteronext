package models

import (
	"time"

	"gorm.io/gorm"
)

// ServerTrigger represents a Smart Event-Chain or Automation Trigger rule stored in the database.
type ServerTrigger struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	TriggerID      string         `gorm:"size:64;uniqueIndex" json:"trigger_id"`
	ServerID       uint           `gorm:"index;not null" json:"server_id"`
	ServerUUID     string         `gorm:"size:36;index;not null" json:"server_uuid"`
	Name           string         `gorm:"size:191;not null" json:"name"`
	EventType      string         `gorm:"size:64;not null" json:"event_type"`
	ConditionText  string         `gorm:"size:255" json:"condition_text"`
	WebhookURL     string         `gorm:"size:512" json:"webhook_url"`
	IsEnabled      bool           `gorm:"default:true" json:"is_enabled"`
	ExecutionCount int            `gorm:"default:0" json:"execution_count"`
	LastTriggered  string         `gorm:"size:64" json:"last_triggered"`
	ActionsJSON    string         `gorm:"type:text" json:"actions_json"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
