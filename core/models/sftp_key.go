package models

import (
	"time"
)

// SftpAccessKey represents a temporary or dedicated guest access key for SFTP
type SftpAccessKey struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ServerID    uint      `gorm:"index;not null" json:"server_id"`
	Server      *Server   `gorm:"foreignKey:ServerID" json:"server,omitempty"`
	Label       string    `gorm:"type:varchar(100);not null" json:"label"`
	Username    string    `gorm:"type:varchar(100);not null" json:"username"` // Format: guest_<random>
	Password    string    `gorm:"type:varchar(255);not null" json:"password"`
	AllowedIPs  string    `gorm:"type:varchar(255)" json:"allowed_ips"`       // Comma-separated CIDRs or IPs (empty = all)
	ExpiresAt   time.Time `json:"expires_at"`                                 // TTL expiration
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// IsExpired checks if the temporary guest key has passed its TTL
func (k *SftpAccessKey) IsExpired() bool {
	return !k.ExpiresAt.IsZero() && time.Now().UTC().After(k.ExpiresAt)
}
