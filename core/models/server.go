package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Server status constants matching Pterodactyl daemon/panel states.
const (
	ServerStatusInstalling      = "installing"
	ServerStatusInstallFailed   = "install_failed"
	ServerStatusReinstallFailed = "reinstall_failed"
	ServerStatusRestoringBackup = "restoring_backup"
	ServerStatusSuspended       = "suspended"
)

// Server represents a game or application server container managed by the panel.
type Server struct {
	ID           uint             `gorm:"primaryKey" json:"id"`
	UUID         string           `gorm:"type:varchar(36);uniqueIndex;not null" json:"uuid"`
	Identifier   string           `gorm:"type:varchar(8);uniqueIndex;not null" json:"identifier"`
	Name         string           `gorm:"type:varchar(191);not null" json:"name"`
	Description  string           `gorm:"type:text" json:"description"`
	Suspended    bool             `gorm:"default:false;index" json:"suspended"`
	Status       *string          `gorm:"type:varchar(50)" json:"status"`
	OwnerID      uint             `gorm:"index;not null" json:"owner_id"`
	Owner        *User            `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	NodeID       uint             `gorm:"index;not null" json:"node_id"`
	Node         *Node            `gorm:"foreignKey:NodeID" json:"node,omitempty"`
	AllocationID uint             `gorm:"index;not null" json:"allocation_id"`
	Allocation   *Allocation      `gorm:"foreignKey:AllocationID" json:"allocation,omitempty"`
	Allocations  []Allocation     `gorm:"foreignKey:ServerID" json:"allocations,omitempty"`
	NestID       *uint            `gorm:"index" json:"nest_id,omitempty"`
	Nest         *Nest            `gorm:"foreignKey:NestID" json:"nest,omitempty"`
	EggID        *uint            `gorm:"index" json:"egg_id,omitempty"`
	Egg          *Egg             `gorm:"foreignKey:EggID" json:"egg,omitempty"`
	Variables    []ServerVariable `gorm:"foreignKey:ServerID;constraint:OnDelete:CASCADE" json:"variables,omitempty"`
	MemoryMB     int64            `gorm:"default:1024" json:"memory"`
	SwapMB       int64            `gorm:"default:0" json:"swap"`
	DiskMB       int64            `gorm:"default:5120" json:"disk"`
	CPU          int64            `gorm:"default:100" json:"cpu"`
	IO           int64            `gorm:"default:500" json:"io"`
	Threads      string           `gorm:"type:varchar(100)" json:"threads"`
	OOMDisabled  bool             `gorm:"default:true" json:"oom_disabled"`
	Startup      string           `gorm:"type:text;not null" json:"startup"`
	Image        string           `gorm:"type:varchar(255);not null" json:"image"`
	SkipScripts  bool             `gorm:"default:false" json:"skip_scripts"`
	IsFrozen            bool             `gorm:"default:false" json:"is_frozen"`
	FreezeReason        string           `gorm:"type:varchar(255)" json:"freeze_reason"`
	SleepModeEnabled    bool             `gorm:"default:false" json:"sleep_mode_enabled"`
	SleepTimeoutMinutes int              `gorm:"default:15" json:"sleep_timeout_minutes"`
	IsSleeping          bool             `gorm:"default:false" json:"is_sleeping"`
	InstalledAt         *time.Time       `json:"installed_at"`
	CreatedAt           time.Time        `json:"created_at"`
	UpdatedAt           time.Time        `json:"updated_at"`
	DeletedAt           gorm.DeletedAt   `gorm:"index" json:"-"`
}

// BeforeCreate hook assigns a UUID and short identifier.
func (s *Server) BeforeCreate(tx *gorm.DB) error {
	if s.UUID == "" {
		s.UUID = uuid.New().String()
	}
	if s.Identifier == "" {
		s.Identifier = strings.ReplaceAll(s.UUID, "-", "")[:8]
	}
	if s.Startup == "" {
		s.Startup = "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui"
	}
	if s.Image == "" {
		s.Image = "ghcr.io/pterodactyl/yolks:java_17"
	}
	if s.MemoryMB == 0 {
		s.MemoryMB = 1024
	}
	if s.DiskMB == 0 {
		s.DiskMB = 5120
	}
	if s.CPU == 0 {
		s.CPU = 100
	}
	if s.IO == 0 {
		s.IO = 500
	}
	return nil
}

// IsSuspended checks if the server is marked as suspended.
func (s *Server) IsSuspended() bool {
	return s.Suspended
}

// ServerVariable represents an environment variable provided to the server container.
type ServerVariable struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ServerID     uint      `gorm:"index;not null" json:"server_id"`
	EnvVariable  string    `gorm:"type:varchar(191);not null" json:"env_variable"`
	DefaultValue string    `gorm:"type:text" json:"server_value"`
	UserViewable bool      `gorm:"default:true" json:"user_viewable"`
	UserEditable bool      `gorm:"default:true" json:"user_editable"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
