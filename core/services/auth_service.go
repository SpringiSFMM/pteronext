package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// JWTClaims represents the claims structure embedded inside the JWT.
type JWTClaims struct {
	UserID    uint   `json:"user_id"`
	UUID      string `json:"uuid"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	RootAdmin bool   `json:"root_admin"`
	jwt.RegisteredClaims
}

// AuthService handles authentication logic, password verification, and JWT generation.
type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

// NewAuthService creates a new AuthService instance.
func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{
		db:  db,
		cfg: cfg,
	}
}

// Authenticate verifies user credentials and returns the user object.
func (s *AuthService) Authenticate(identity, password string) (*models.User, error) {
	identity = strings.TrimSpace(identity)
	if identity == "" || password == "" {
		return nil, errors.New("identity and password are required")
	}

	var user models.User
	err := s.db.Preload("Role.Permissions").
		Where("LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)", identity, identity).
		First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Fallback: If identity is "admin" and no user literally named "admin" exists, check first root_admin
			if strings.EqualFold(identity, "admin") || strings.EqualFold(identity, "admin@pteronext.internal") {
				if fErr := s.db.Preload("Role.Permissions").Where("root_admin = ?", true).Order("id asc").First(&user).Error; fErr == nil {
					if user.CheckPassword(password) {
						return &user, nil
					}
				}
			}
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	if !user.CheckPassword(password) {
		return nil, errors.New("invalid credentials")
	}

	return &user, nil
}

// GenerateJWT creates a signed JWT token for a given user.
func (s *AuthService) GenerateJWT(user *models.User) (string, error) {
	now := time.Now().UTC()
	claims := JWTClaims{
		UserID:    user.ID,
		UUID:      user.UUID,
		Username:  user.Username,
		Email:     user.Email,
		RootAdmin: user.RootAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("%d", user.ID),
			Issuer:    "pteronext-panel",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.JWTTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// ValidateJWT verifies a raw JWT token and returns the claims and corresponding User.
func (s *AuthService) ValidateJWT(tokenStr string) (*JWTClaims, *models.User, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, nil, errors.New("invalid or expired token")
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, nil, errors.New("invalid token claims")
	}

	var user models.User
	if err := s.db.Preload("Role.Permissions").First(&user, claims.UserID).Error; err != nil {
		return nil, nil, errors.New("user not found")
	}

	return claims, &user, nil
}

// ValidateAPIKey verifies a raw API key (ptl_...) and returns the associated User.
func (s *AuthService) ValidateAPIKey(rawKey string) (*models.APIKey, *models.User, error) {
	if !strings.HasPrefix(rawKey, "ptl_") || len(rawKey) < 20 {
		return nil, nil, errors.New("invalid api key format")
	}

	identifier := rawKey[4:20]
	var apiKey models.APIKey
	if err := s.db.Preload("User.Role.Permissions").Where("identifier = ?", identifier).First(&apiKey).Error; err != nil {
		return nil, nil, errors.New("api key not found")
	}

	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		return nil, nil, errors.New("api key has expired")
	}

	if !apiKey.ValidateRawKey(rawKey) {
		return nil, nil, errors.New("invalid api key secret")
	}

	// Update last used time
	now := time.Now().UTC()
	s.db.Model(&apiKey).Update("last_used_at", &now)

	return &apiKey, apiKey.User, nil
}
