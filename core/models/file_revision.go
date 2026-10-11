package models

import "time"

// FileRevision represents a micro-snapshot revision in the File-Time-Machine.
type FileRevision struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ServerUUID string    `gorm:"index;type:varchar(64)" json:"server_uuid"`
	FilePath   string    `gorm:"index;type:varchar(255)" json:"file_path"`
	Content    string    `gorm:"type:longtext" json:"content"`
	Size       int64     `json:"size"`
	CreatedBy  string    `gorm:"type:varchar(64)" json:"created_by"`
	CreatedAt  time.Time `json:"created_at"`
}
