package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Allocation represents an IP and port combination assigned to a node and optionally a server.
type Allocation struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	NodeID    uint           `gorm:"index;not null" json:"node_id"`
	ServerID  *uint          `gorm:"index" json:"server_id"`
	IP        string         `gorm:"type:varchar(191);not null" json:"ip"`
	Port      int            `gorm:"not null" json:"port"`
	Alias     string         `gorm:"type:varchar(191)" json:"alias"`
	Notes     string         `gorm:"type:text" json:"notes"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ConnectionString returns the display host:port string.
func (a *Allocation) ConnectionString() string {
	host := a.IP
	if a.Alias != "" {
		host = a.Alias
	}
	return fmt.Sprintf("%s:%d", host, a.Port)
}
