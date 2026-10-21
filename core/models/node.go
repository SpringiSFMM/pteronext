package models

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Node represents a physical or virtual machine running the Wings daemon.
type Node struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	UUID               string         `gorm:"type:varchar(36);uniqueIndex;not null" json:"uuid"`
	Name               string         `gorm:"type:varchar(191);not null" json:"name"`
	Description        string         `gorm:"type:text" json:"description"`
	Public             bool           `gorm:"default:true" json:"public"`
	FQDN               string         `gorm:"type:varchar(191);not null" json:"fqdn"`
	Scheme             string         `gorm:"type:varchar(10);default:'https'" json:"scheme"`
	BehindProxy        bool           `gorm:"default:false" json:"behind_proxy"`
	MaintenanceMode    bool           `gorm:"default:false" json:"maintenance_mode"`
	MemoryMB           int64          `gorm:"default:1024" json:"memory"`
	MemoryOverallocate int            `gorm:"default:0" json:"memory_overallocate"`
	DiskMB             int64          `gorm:"default:10240" json:"disk"`
	DiskOverallocate   int            `gorm:"default:0" json:"disk_overallocate"`
	UploadSizeMB       int            `gorm:"default:100" json:"upload_size"`
	DaemonListenPort   int            `gorm:"default:8080" json:"daemon_listen"`
	DaemonSFTPPort     int            `gorm:"default:2022" json:"daemon_sftp"`
	DaemonBaseDir      string         `gorm:"default:'/var/lib/pterodactyl/volumes'" json:"daemon_base"`
	DaemonTokenID      string         `gorm:"type:varchar(36);uniqueIndex;not null" json:"daemon_token_id"`
	DaemonToken        string         `gorm:"type:varchar(255);not null" json:"daemon_token"`
	Allocations        []Allocation   `gorm:"foreignKey:NodeID;constraint:OnDelete:CASCADE" json:"allocations,omitempty"`
	Servers            []Server       `gorm:"foreignKey:NodeID" json:"servers,omitempty"`
	AllocatedMemory    int64          `gorm:"-" json:"allocated_memory"`
	AllocatedDisk      int64          `gorm:"-" json:"allocated_disk"`
	ServersCount       int64          `gorm:"-" json:"servers_count"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate hook generates UUID and tokens.
func (n *Node) BeforeCreate(tx *gorm.DB) error {
	if n.UUID == "" {
		n.UUID = uuid.New().String()
	}
	if n.DaemonTokenID == "" {
		n.DaemonTokenID = generateRandomString(16)
	}
	if n.DaemonToken == "" {
		n.DaemonToken = generateRandomString(32)
	}
	if n.Scheme == "" {
		n.Scheme = "https"
	}
	if n.DaemonListenPort == 0 {
		n.DaemonListenPort = 8080
	}
	if n.DaemonSFTPPort == 0 {
		n.DaemonSFTPPort = 2022
	}
	if n.DaemonBaseDir == "" {
		n.DaemonBaseDir = "/var/lib/pterodactyl/volumes"
	}
	return nil
}

// ValidateDaemonToken verifies a Bearer token in the format "token_id.secret".
func (n *Node) ValidateDaemonToken(bearer string) bool {
	parts := strings.Split(bearer, ".")
	if len(parts) != 2 {
		return false
	}
	if parts[0] != n.DaemonTokenID {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(parts[1]), []byte(n.DaemonToken)) == 1
}

// FullDaemonURL returns the base URL to reach the Wings daemon.
func (n *Node) FullDaemonURL() string {
	return fmt.Sprintf("%s://%s:%d", n.Scheme, n.FQDN, n.DaemonListenPort)
}

// GenerateWingsConfiguration returns the YAML string expected in Wings config.yml.
func (n *Node) GenerateWingsConfiguration(panelURL string) string {
	return fmt.Sprintf(`debug: false
uuid: %s
token_id: %s
token: %s
api:
  host: 0.0.0.0
  port: %d
  ssl:
    enabled: %t
    cert: /etc/letsencrypt/live/%s/fullchain.pem
    key: /etc/letsencrypt/live/%s/privkey.pem
  upload_limit: %d
system:
  root_directory: %s
  log_directory: /var/log/pterodactyl
  data: /var/lib/pterodactyl
  archive_directory: /var/lib/pterodactyl/archives
  backup_directory: /var/lib/pterodactyl/backups
  sftp:
    bind_port: %d
remote: '%s'
allowed_mounts: []
remote_query:
  timeout: 30
  boot_servers_per_page: 50
`,
		n.UUID,
		n.DaemonTokenID,
		n.DaemonToken,
		n.DaemonListenPort,
		n.Scheme == "https",
		n.FQDN,
		n.FQDN,
		n.UploadSizeMB,
		n.DaemonBaseDir,
		n.DaemonSFTPPort,
		panelURL,
	)
}

func generateRandomString(n int) string {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return uuid.New().String()
	}
	return hex.EncodeToString(bytes)
}
