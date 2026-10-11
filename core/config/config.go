package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration parameters for the panel core backend.
type Config struct {
	AppEnv      string
	AppURL      string
	HTTPHost    string
	HTTPPort    int
	DBPath      string
	JWTSecret   string
	JWTTTL      time.Duration
	Debug       bool
	AllowOrigin string
}

// Load loads the configuration from environment variables with sensible defaults.
func Load() *Config {
	port := 8080
	if p, err := strconv.Atoi(os.Getenv("PORT")); err == nil && p > 0 {
		port = p
	} else if p, err := strconv.Atoi(os.Getenv("HTTP_PORT")); err == nil && p > 0 {
		port = p
	}

	ttlHours := 24
	if t, err := strconv.Atoi(os.Getenv("JWT_TTL_HOURS")); err == nil && t > 0 {
		ttlHours = t
	}

	host := os.Getenv("HOST")
	if host == "" {
		host = os.Getenv("HTTP_HOST")
	}
	if host == "" {
		host = "0.0.0.0"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./pteronext.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "pteronext-development-secret-key-change-in-production-32bytes"
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:8080"
	}

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	allowOrigin := os.Getenv("ALLOW_ORIGIN")
	if allowOrigin == "" {
		allowOrigin = "*"
	}

	debug := os.Getenv("DEBUG") == "true" || appEnv == "development"

	return &Config{
		AppEnv:      appEnv,
		AppURL:      appURL,
		HTTPHost:    host,
		HTTPPort:    port,
		DBPath:      dbPath,
		JWTSecret:   jwtSecret,
		JWTTTL:      time.Duration(ttlHours) * time.Hour,
		Debug:       debug,
		AllowOrigin: allowOrigin,
	}
}
