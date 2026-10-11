package models

import "time"

// ServerCustomDomain represents a Cloudflare-managed A & SRV record for a server.
type ServerCustomDomain struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ServerUUID  string    `gorm:"index;type:varchar(64)" json:"server_uuid"`
	Subdomain   string    `gorm:"type:varchar(128)" json:"subdomain"`
	FullDomain  string    `gorm:"type:varchar(255)" json:"full_domain"`
	RecordIDA   string    `gorm:"type:varchar(64)" json:"record_id_a"`
	RecordIDSRV string    `gorm:"type:varchar(64)" json:"record_id_srv"`
	Port        int       `json:"port"`
	TargetIP    string    `gorm:"type:varchar(64)" json:"target_ip"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
