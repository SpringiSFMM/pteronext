package models

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Standard permission enum keys matching the requirement catalog.
const (
	PermConsoleView    = "console.view"
	PermConsoleSend    = "console.send"
	PermFileRead       = "file.read"
	PermFileWrite      = "file.write"
	PermFileDelete     = "file.delete"
	PermFileUpload     = "file.upload"
	PermPowerStart     = "power.start"
	PermPowerStop      = "power.stop"
	PermPowerRestart   = "power.restart"
	PermPowerKill      = "power.kill"
	PermBackupCreate   = "backup.create"
	PermBackupRestore  = "backup.restore"
	PermBackupDelete   = "backup.delete"
	PermDatabaseManage = "database.manage"
	PermNetworkManage  = "network.manage"
	PermPlayersManage  = "players.manage"
	PermSidecarManage  = "sidecar.manage"
	PermSettingsManage = "settings.manage"
)

// PathRule defines an ALLOW or DENY glob rule for filesystem access.
type PathRule struct {
	Type    string `json:"type"`    // "ALLOW" or "DENY"
	Pattern string `json:"pattern"` // e.g. "/world/**", "**/server.properties"
}

// CommandRule defines an ALLOW or DENY rule for console command execution.
type CommandRule struct {
	Type    string `json:"type"`    // "ALLOW" (whitelist) or "DENY" (blacklist)
	Command string `json:"command"` // e.g. "say", "kick", "op", "stop"
}

// Role represents an RBAC role in the system.
type Role struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	Description string         `gorm:"type:varchar(255)" json:"description"`
	Permissions []Permission   `gorm:"foreignKey:RoleID;constraint:OnDelete:CASCADE" json:"permissions,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// Permission represents a single permission entry for an RBAC role.
type Permission struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RoleID    uint      `gorm:"index;not null" json:"role_id"`
	Resource  string    `gorm:"type:varchar(100);index;not null" json:"resource"`
	Action    string    `gorm:"type:varchar(50);not null" json:"action"`
	CreatedAt time.Time `json:"created_at"`
}

// Subuser represents a user delegated access to a specific server with granular permissions, path rules, and command rules.
type Subuser struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	UserID       uint           `gorm:"uniqueIndex:idx_subuser_server;not null" json:"user_id"`
	ServerID     uint           `gorm:"uniqueIndex:idx_subuser_server;not null" json:"server_id"`
	User         *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	RoleName     string         `gorm:"type:varchar(50);default:'Custom'" json:"role_name"` // "Moderator", "Builder", "Support", "Custom"
	Permissions  string         `gorm:"type:text" json:"permissions"`                       // JSON or comma list of permission keys
	PathRules    string         `gorm:"type:text" json:"path_rules"`                         // JSON array of PathRule
	CommandRules string         `gorm:"type:text" json:"command_rules"`                      // JSON array of CommandRule
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// HasPermission checks if the subuser has a given permission string.
func (s *Subuser) HasPermission(perm string) bool {
	if s == nil {
		return false
	}
	// Try parsing JSON list first
	var list []string
	if err := json.Unmarshal([]byte(s.Permissions), &list); err == nil {
		for _, p := range list {
			p = strings.TrimSpace(p)
			if p == "*" || p == perm {
				return true
			}
			if strings.HasSuffix(p, ".*") {
				prefix := strings.TrimSuffix(p, ".*")
				if strings.HasPrefix(perm, prefix+".") {
					return true
				}
			}
		}
		return false
	}

	// Fallback to comma-separated
	perms := strings.Split(s.Permissions, ",")
	for _, p := range perms {
		p = strings.TrimSpace(p)
		if p == "*" || p == perm {
			return true
		}
		if strings.HasSuffix(p, ".*") {
			prefix := strings.TrimSuffix(p, ".*")
			if strings.HasPrefix(perm, prefix+".") {
				return true
			}
		}
	}
	return false
}

// GetPathRules parses and returns configured PathRules.
func (s *Subuser) GetPathRules() []PathRule {
	if s == nil || s.PathRules == "" {
		return nil
	}
	var rules []PathRule
	_ = json.Unmarshal([]byte(s.PathRules), &rules)
	return rules
}

// GetCommandRules parses and returns configured CommandRules.
func (s *Subuser) GetCommandRules() []CommandRule {
	if s == nil || s.CommandRules == "" {
		return nil
	}
	var rules []CommandRule
	_ = json.Unmarshal([]byte(s.CommandRules), &rules)
	return rules
}

// CheckPathAccess verifies if the subuser is permitted to access a relative path based on DENY/ALLOW rules.
// Order of evaluation:
// 1. Explicit DENY matches -> Block immediately
// 2. Explicit ALLOW matches -> Permit access
// 3. If no rules defined -> Default ALLOW if user has general file permission.
func (s *Subuser) CheckPathAccess(relPath string) bool {
	if s == nil {
		return false
	}
	rules := s.GetPathRules()
	if len(rules) == 0 {
		return true // No specific path restrictions
	}

	cleanTarget := "/" + strings.TrimPrefix(filepath.ToSlash(filepath.Clean(relPath)), "/")

	// Check DENY rules first
	for _, r := range rules {
		if strings.ToUpper(r.Type) == "DENY" && matchGlobPattern(r.Pattern, cleanTarget) {
			return false
		}
	}

	// Check ALLOW rules
	hasAllowRules := false
	for _, r := range rules {
		if strings.ToUpper(r.Type) == "ALLOW" {
			hasAllowRules = true
			if matchGlobPattern(r.Pattern, cleanTarget) {
				return true
			}
		}
	}

	// If there were ALLOW rules, but none matched, deny (Zero-Trust)
	if hasAllowRules {
		return false
	}

	return true
}

// CheckCommandAccess validates if a given console command is permitted.
// If CommandRules contain ALLOW rules (whitelist), command must match an ALLOW rule.
// If CommandRules contain DENY rules (blacklist), command matching DENY is blocked.
func (s *Subuser) CheckCommandAccess(commandLine string) bool {
	if s == nil {
		return false
	}
	rules := s.GetCommandRules()
	if len(rules) == 0 {
		return true
	}

	parts := strings.Fields(strings.TrimSpace(commandLine))
	if len(parts) == 0 {
		return true
	}
	rootCmd := strings.ToLower(parts[0])

	// Check explicit DENY rules
	for _, r := range rules {
		if strings.ToUpper(r.Type) == "DENY" && strings.EqualFold(r.Command, rootCmd) {
			return false
		}
	}

	// Check ALLOW rules (if whitelist exists)
	hasAllow := false
	for _, r := range rules {
		if strings.ToUpper(r.Type) == "ALLOW" {
			hasAllow = true
			if strings.EqualFold(r.Command, rootCmd) || r.Command == "*" {
				return true
			}
		}
	}

	if hasAllow {
		return false // Whitelist active and command not on it
	}

	return true
}

// Helper: matchGlobPattern supports standard glob matching and recursive **
func matchGlobPattern(pattern, target string) bool {
	pattern = "/" + strings.TrimPrefix(filepath.ToSlash(strings.TrimSpace(pattern)), "/")
	target = "/" + strings.TrimPrefix(filepath.ToSlash(strings.TrimSpace(target)), "/")

	// Direct match
	if pattern == target || pattern == "/**" || pattern == "/*" {
		return true
	}

	// Prefix match with /**
	if strings.HasSuffix(pattern, "/**") {
		prefix := strings.TrimSuffix(pattern, "/**")
		if strings.HasPrefix(target, prefix) {
			return true
		}
	}

	// Basename pattern (e.g. **/server.properties or *.properties)
	if strings.HasPrefix(pattern, "**/") {
		basePattern := strings.TrimPrefix(pattern, "**/")
		baseTarget := filepath.Base(target)
		if matched, _ := filepath.Match(basePattern, baseTarget); matched {
			return true
		}
		if matched, _ := filepath.Match(basePattern, target); matched {
			return true
		}
	}

	matched, _ := filepath.Match(pattern, target)
	return matched
}
