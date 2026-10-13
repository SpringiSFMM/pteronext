package models

import "time"

// ServerCustomDomain represents a Cloudflare-managed A & SRV record for a server.
type ServerCustomDomain struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	ServerUUID       string     `gorm:"index;type:varchar(64)" json:"server_uuid"`
	Subdomain        string     `gorm:"type:varchar(128)" json:"subdomain"`
	FullDomain       string     `gorm:"type:varchar(255)" json:"full_domain"`
	RecordIDA        string     `gorm:"type:varchar(64)" json:"record_id_a"`
	RecordIDSRV      string     `gorm:"type:varchar(64)" json:"record_id_srv"`
	Port             int        `json:"port"`
	TargetIP         string     `gorm:"type:varchar(64)" json:"target_ip"`
	IsActive         bool       `json:"is_active"`
	Status           string     `gorm:"type:varchar(32);default:'active'" json:"status"` // active, revoked
	RevocationReason string     `gorm:"type:text" json:"revocation_reason"`
	RevokedAt        *time.Time `json:"revoked_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ServerNotification stores incident alerts and moderation popups for server owners.
type ServerNotification struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ServerUUID  string    `gorm:"index;type:varchar(64)" json:"server_uuid"`
	Type        string    `gorm:"type:varchar(64)" json:"type"` // e.g. "dns_revoked"
	Title       string    `gorm:"type:varchar(255)" json:"title"`
	Message     string    `gorm:"type:text" json:"message"`
	Reason      string    `gorm:"type:text" json:"reason"`
	Subdomain   string    `gorm:"type:varchar(128)" json:"subdomain"`
	FullDomain  string    `gorm:"type:varchar(255)" json:"full_domain"`
	IsDismissed bool      `gorm:"default:false" json:"is_dismissed"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

