package models

import (
	"time"

	"gorm.io/gorm"
)

// Sidecar represents a companion container (Redis, Postgres, SQLite, MariaDB) attached to a server.
type Sidecar struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ServerID    uint           `gorm:"index;not null" json:"server_id"`
	UUID        string         `gorm:"type:varchar(36);uniqueIndex;not null" json:"uuid"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	Type        string         `gorm:"type:varchar(50);not null" json:"type"` // "redis", "postgres", "mariadb", "sqlite"
	Status      string         `gorm:"type:varchar(50);default:'running'" json:"status"`
	Host        string         `gorm:"type:varchar(191);default:'127.0.0.1'" json:"host"`
	Port        int            `gorm:"not null" json:"port"`
	Database    string         `gorm:"type:varchar(100)" json:"database"`
	Username    string         `gorm:"type:varchar(100)" json:"username"`
	Password    string         `gorm:"type:varchar(255)" json:"password"`
	DockerImage string         `gorm:"type:varchar(191)" json:"docker_image"`
	MemoryMB    int64          `gorm:"default:512" json:"memory_mb"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
