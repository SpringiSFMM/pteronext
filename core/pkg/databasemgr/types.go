package databasemgr

import (
	"fmt"
	"time"
)

// DatabaseType represents the RDBMS dialect (MySQL, PostgreSQL, MariaDB).
type DatabaseType string

const (
	DatabaseTypeMySQL    DatabaseType = "mysql"
	DatabaseTypePostgres DatabaseType = "postgres"
	DatabaseTypeMariaDB  DatabaseType = "mariadb"
)

// DatabaseHost represents an external database server host managed by the panel.
type DatabaseHost struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Type             DatabaseType      `json:"type"` // mysql, postgres, mariadb
	Host             string            `json:"host"`
	Port             int               `json:"port"`
	AdminUsername    string            `json:"admin_username"`
	AdminPassword    string            `json:"-"`
	NodeAffinity     []string          `json:"node_affinity,omitempty"` // Node IDs with affinity to this host
	MaxDatabases     int               `json:"max_databases"`          // 0 = unlimited
	CurrentDatabases int               `json:"current_databases"`
	IsActive         bool              `json:"is_active"`
	Metadata         map[string]string `json:"metadata,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

// ServerDatabase represents a provisioned database tied to a specific game server.
type ServerDatabase struct {
	ID             string        `json:"id"`
	ServerID       string        `json:"server_id"`
	DatabaseHostID string        `json:"database_host_id"`
	Host           *DatabaseHost `json:"host,omitempty"`
	Database       string        `json:"database"` // e.g. "s10_luckperms"
	Username       string        `json:"username"` // e.g. "u10_a81f09b3"
	Password       string        `json:"password"` // Plaintext or decrypted password
	Remote         string        `json:"remote"`   // e.g. "%" or client IP
	MaxConnections int           `json:"max_connections"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

// ProvisionRequest defines the parameters required to provision a new server database.
type ProvisionRequest struct {
	ServerID       string       `json:"server_id"`
	Name           string       `json:"name"`                      // Base name requested, e.g. "luckperms"
	HostID         string       `json:"host_id,omitempty"`         // Optional: explicit host override
	NodeID         string       `json:"node_id,omitempty"`         // Optional: server's physical node ID for affinity
	Type           DatabaseType `json:"type,omitempty"`            // Optional: preferred dialect (defaults to MySQL)
	Remote         string       `json:"remote,omitempty"`          // e.g. "%" (default) or "127.0.0.1"
	MaxConnections int          `json:"max_connections,omitempty"` // 0 = unlimited
	CustomPassword string       `json:"custom_password,omitempty"` // Optional user-provided password
	PasswordLength int          `json:"password_length,omitempty"` // Default 24 chars
}

// SelectionCriteria defines constraints for picking an optimal DatabaseHost.
type SelectionCriteria struct {
	ServerID        string
	NodeID          string
	Type            DatabaseType
	RequestedHostID string
}

// Common errors
var (
	ErrNoSuitableDatabaseHost = fmt.Errorf("no suitable database host found matching criteria")
	ErrHostAtCapacity         = fmt.Errorf("selected database host has reached maximum capacity")
	ErrDatabaseAlreadyExists  = fmt.Errorf("a database with that name already exists for this server")
	ErrDatabaseNotFound       = fmt.Errorf("database record not found")
	ErrHostNotFound           = fmt.Errorf("database host not found")
	ErrInvalidIdentifier      = fmt.Errorf("database or user identifier contains invalid characters")
)
