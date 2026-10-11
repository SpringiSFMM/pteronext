package models

import (
	"time"

	"gorm.io/gorm"
)

// DatabaseHost represents an external database server host (MySQL/PostgreSQL) managed by the panel.
type DatabaseHost struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"type:varchar(191);not null" json:"name"`
	Host         string         `gorm:"type:varchar(191);not null" json:"host"`
	Port         int            `gorm:"default:3306" json:"port"`
	Username     string         `gorm:"type:varchar(191);not null" json:"username"`
	Password     string         `gorm:"type:varchar(255);not null" json:"-"`
	NodeID       *uint          `gorm:"index" json:"node_id"`
	MaxDatabases *int           `json:"max_databases"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Database represents a database provisioned for a server on a DatabaseHost.
type Database struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	ServerID       uint           `gorm:"index;not null" json:"server_id"`
	DatabaseHostID uint           `gorm:"index;not null" json:"database_host_id"`
	DatabaseHost   *DatabaseHost  `gorm:"foreignKey:DatabaseHostID" json:"host,omitempty"`
	Database       string         `gorm:"type:varchar(191);not null" json:"name"`
	Username       string         `gorm:"type:varchar(191);not null" json:"username"`
	Password       string         `gorm:"type:varchar(255);not null" json:"-"`
	Remote         string         `gorm:"type:varchar(191);default:'%'" json:"remote"`
	MaxConnections int            `gorm:"default:0" json:"max_connections"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
