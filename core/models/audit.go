package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuditLog tracks system, user, and daemon activity events for auditing.
type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UUID      string    `gorm:"type:varchar(36);uniqueIndex;not null" json:"uuid"`
	ActorID   *uint     `gorm:"index" json:"actor_id"`
	ActorType string    `gorm:"type:varchar(100)" json:"actor_type"`
	ServerID  *uint     `gorm:"index" json:"server_id"`
	Event     string    `gorm:"type:varchar(191);index;not null" json:"event"`
	Properties string   `gorm:"type:text" json:"properties"` // JSON encoded payload
	IP        string    `gorm:"type:varchar(45);default:'127.0.0.1'" json:"ip"`
	Timestamp time.Time `gorm:"index;not null" json:"timestamp"`
	CreatedAt time.Time `json:"created_at"`
}

// BeforeCreate hook generates a UUID and sets default timestamp.
func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.UUID == "" {
		a.UUID = uuid.New().String()
	}
	if a.Timestamp.IsZero() {
		a.Timestamp = time.Now().UTC()
	}
	return nil
}

// MetadataMap parses JSON properties into a generic map.
func (a *AuditLog) MetadataMap() map[string]interface{} {
	m := make(map[string]interface{})
	if a.Properties != "" {
		_ = json.Unmarshal([]byte(a.Properties), &m)
	}
	return m
}
