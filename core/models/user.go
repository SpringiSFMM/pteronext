package models

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pteronext/panel-core/pkg/security"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User represents a panel user account.
type User struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	UUID             string         `gorm:"type:varchar(36);uniqueIndex;not null" json:"uuid"`
	Username         string         `gorm:"type:varchar(191);uniqueIndex;not null" json:"username"`
	Email            string         `gorm:"type:varchar(191);uniqueIndex;not null" json:"email"`
	NameFirst        string         `gorm:"type:varchar(191)" json:"name_first"`
	NameLast         string         `gorm:"type:varchar(191)" json:"name_last"`
	Password         string         `gorm:"type:varchar(255);not null" json:"-"`
	RootAdmin        bool           `gorm:"default:false;index" json:"root_admin"`
	TwoFactorSecret  string         `gorm:"type:varchar(255)" json:"-"`
	TwoFactorEnabled bool           `gorm:"default:false" json:"two_factor_enabled"`
	RecoveryCodes    string         `gorm:"type:text" json:"-"`
	AvatarURL        string         `gorm:"type:text" json:"avatar_url"`
	DiscordID        string         `gorm:"type:varchar(64);index" json:"discord_id"`
	DiscordUsername  string         `gorm:"type:varchar(191)" json:"discord_username"`
	DiscordLinkedAt  *time.Time     `json:"discord_linked_at"`
	RoleID           *uint          `gorm:"index" json:"role_id"`
	Role             *Role          `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	IsBetaTester     bool           `gorm:"default:false;index" json:"is_beta_tester"`
	BetaFeatures     string         `gorm:"type:text;default:'[]'" json:"beta_features"`       // JSON array of feature slugs
	BetaServerScope  string         `gorm:"type:text;default:'[]'" json:"beta_server_scope"`    // JSON array of server UUIDs or ["*"]
	BetaDiscordScope string         `gorm:"type:text;default:'[]'" json:"beta_discord_scope"`   // JSON array of Discord Guild IDs or ["*"]
	Theme            string         `gorm:"type:varchar(32);default:''" json:"theme"`
	CustomCSS        string         `gorm:"type:text" json:"custom_css"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate hook generates a UUID if not provided.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.UUID == "" {
		u.UUID = uuid.New().String()
	}
	return nil
}

// SetPassword hashes and sets the user's password using Argon2id.
func (u *User) SetPassword(plain string) error {
	pm := security.NewPasswordManager()
	hash, err := pm.HashPassword(plain)
	if err != nil {
		return err
	}
	u.Password = hash
	return nil
}

// SetPasswordBcrypt hashes and sets the user's password using bcrypt.
func (u *User) SetPasswordBcrypt(plain string) error {
	pm := security.NewPasswordManager()
	hash, err := pm.HashBcrypt(plain)
	if err != nil {
		return err
	}
	u.Password = hash
	return nil
}

// CheckPassword verifies the password hash (supports both Argon2id and bcrypt).
func (u *User) CheckPassword(plain string) bool {
	pm := security.NewPasswordManager()
	valid, err := pm.VerifyPassword(plain, u.Password)
	if err == nil {
		return valid
	}
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(plain)) == nil
}

// HasBetaFeature determines if the user is authorized to access a specific beta feature,
// optionally filtered by server UUID and/or Discord guild ID.
func (u *User) HasBetaFeature(featureSlug string, serverUUID string, discordGuildID string) bool {
	if u == nil {
		return false
	}
	if u.RootAdmin {
		return true
	}
	if !u.IsBetaTester {
		return false
	}

	// 1. Feature check
	var features []string
	if err := json.Unmarshal([]byte(u.BetaFeatures), &features); err == nil && len(features) > 0 {
		hasFeat := false
		for _, f := range features {
			f = strings.TrimSpace(f)
			if f == "*" || f == featureSlug {
				hasFeat = true
				break
			}
		}
		if !hasFeat {
			return false
		}
	}

	// 2. Server UUID Scope check (if server context is given)
	if serverUUID != "" {
		var servers []string
		if err := json.Unmarshal([]byte(u.BetaServerScope), &servers); err == nil && len(servers) > 0 {
			hasServer := false
			for _, s := range servers {
				s = strings.TrimSpace(s)
				if s == "*" || s == serverUUID {
					hasServer = true
					break
				}
			}
			if !hasServer {
				return false
			}
		}
	}

	// 3. Discord Guild Scope check (if guild context is given)
	if discordGuildID != "" {
		var guilds []string
		if err := json.Unmarshal([]byte(u.BetaDiscordScope), &guilds); err == nil && len(guilds) > 0 {
			hasGuild := false
			for _, g := range guilds {
				g = strings.TrimSpace(g)
				if g == "*" || g == discordGuildID {
					hasGuild = true
					break
				}
			}
			if !hasGuild {
				return false
			}
		}
	}

	return true
}
