package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Backup represents a server archive snapshot created by Wings or panel.
type Backup struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ServerID     uint           `gorm:"index;not null" json:"server_id"`
	Server       *Server        `gorm:"foreignKey:ServerID" json:"server,omitempty"`
	UUID         string         `gorm:"type:varchar(36);uniqueIndex;not null" json:"uuid"`
	Name         string         `gorm:"type:varchar(191);not null" json:"name"`
	IsSuccessful   bool           `gorm:"default:false" json:"is_successful"`
	IsLocked       bool           `gorm:"default:false" json:"is_locked"`
	IsEncrypted    bool           `gorm:"default:false" json:"is_encrypted"`
	EncryptionSalt string         `gorm:"type:varchar(64)" json:"encryption_salt,omitempty"`
	Checksum       string         `gorm:"type:varchar(255)" json:"checksum"`
	Bytes          int64          `gorm:"default:0" json:"bytes"`
	UploadID       string         `gorm:"type:text" json:"upload_id"`
	CompletedAt    *time.Time     `json:"completed_at"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate hook generates a UUID.
func (b *Backup) BeforeCreate(tx *gorm.DB) error {
	if b.UUID == "" {
		b.UUID = uuid.New().String()
	}
	return nil
}
