package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB initializes the SQLite database with WAL mode and high-performance pragmas.
func InitDB(dbPath string, debug bool) (*gorm.DB, error) {
	// Ensure parent directory exists
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	logLevel := logger.Warn
	if debug {
		logLevel = logger.Info
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database at %s: %w", dbPath, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Optimize connection pooling for SQLite WAL mode
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Apply critical performance PRAGMAs:
	// WAL mode allows concurrent readers and non-blocking writes.
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA foreign_keys = ON;",
		"PRAGMA cache_size = -20000;", // 20MB cache
		"PRAGMA temp_store = MEMORY;",
	}

	for _, pragma := range pragmas {
		if _, err := sqlDB.Exec(pragma); err != nil {
			log.Printf("[DB WARN] Failed to execute %s: %v", pragma, err)
		}
	}

	// Verify WAL mode is active
	var journalMode string
	if err := sqlDB.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err == nil {
		log.Printf("[DB] SQLite initialized at %s with journal_mode=%s", dbPath, journalMode)
	}

	return db, nil
}

// Close gracefully closes the SQLite database connection.
func Close(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// CheckHealth checks if the database is responding.
func CheckHealth(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}
