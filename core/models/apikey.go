package models

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// KeyType constants
const (
	KeyTypeAccount     = "account"
	KeyTypeApplication = "application"
)

// APIKey allows automated programmatic access for users or external scripts.
type APIKey struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	UserID      uint           `gorm:"index;not null" json:"user_id"`
	User        *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	KeyType     string         `gorm:"type:varchar(20);default:'account';index" json:"key_type"`
	Identifier  string         `gorm:"type:varchar(16);uniqueIndex;not null" json:"identifier"`
	TokenHash   string         `gorm:"type:varchar(64);not null" json:"-"`
	AllowedIPs  string         `gorm:"type:text" json:"allowed_ips"`
	Memo        string         `gorm:"type:varchar(500)" json:"memo"`
	LastUsedAt  *time.Time     `json:"last_used_at"`
	ExpiresAt   *time.Time     `json:"expires_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// GenerateNewAPIKey creates a new APIKey struct and returns the raw secret token to display once to the user.
func GenerateNewAPIKey(userID uint, keyType, memo string, expiresAt *time.Time) (*APIKey, string, error) {
	identifier := generateRandomString(16)
	secret := generateRandomString(32)
	rawKey := fmt.Sprintf("ptl_%s%s", identifier, secret)

	hash := sha256.Sum256([]byte(secret))
	tokenHash := hex.EncodeToString(hash[:])

	apiKey := &APIKey{
		UserID:     userID,
		KeyType:    keyType,
		Identifier: identifier,
		TokenHash:  tokenHash,
		Memo:       memo,
		ExpiresAt:  expiresAt,
	}

	return apiKey, rawKey, nil
}

// ValidateRawKey checks if a raw API key (e.g. "ptl_xxxx...") matches this APIKey.
func (k *APIKey) ValidateRawKey(rawKey string) bool {
	if !strings.HasPrefix(rawKey, "ptl_") {
		return false
	}
	body := strings.TrimPrefix(rawKey, "ptl_")
	if len(body) <= len(k.Identifier) {
		return false
	}
	if !strings.HasPrefix(body, k.Identifier) {
		return false
	}
	secret := body[len(k.Identifier):]
	hash := sha256.Sum256([]byte(secret))
	calculatedHash := hex.EncodeToString(hash[:])
	return subtle.ConstantTimeCompare([]byte(calculatedHash), []byte(k.TokenHash)) == 1
}
