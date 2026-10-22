package database

import (
	"fmt"
	"log"

	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// AutoMigrate migrates all schema tables for the Next-Gen Pterodactyl Panel.
func AutoMigrate(db *gorm.DB) error {
	log.Printf("[DB] Running auto-migrations for Users, Roles, Permissions, Servers, Nodes, Schedules, AuditLogs, Databases, APIKeys...")

	// Temporarily disable foreign keys during schema migrations in SQLite
	db.Exec("PRAGMA foreign_keys = OFF;")
	defer db.Exec("PRAGMA foreign_keys = ON;")

	tables := []interface{}{
		&models.Role{},
		&models.Permission{},
		&models.User{},
		&models.Subuser{},
		&models.Node{},
		&models.Allocation{},
		&models.Nest{},
		&models.Egg{},
		&models.Server{},
		&models.ServerVariable{},
		&models.Schedule{},
		&models.Task{},
		&models.AuditLog{},
		&models.DatabaseHost{},
		&models.Database{},
		&models.APIKey{},
		&models.Backup{},
		&models.Webhook{},
		&models.Sidecar{},
		&models.SystemSetting{},
		&models.DiscordLinkVerification{},
		&models.DiscordUserXP{},
		&models.DiscordGiveaway{},
		&models.DiscordPoll{},
		&models.DiscordLevelRole{},
		&models.FileRevision{},
		&models.ServerCustomDomain{},
		&models.ServerNotification{},
		&models.ServerTrigger{},
		&models.SftpAccessKey{},
	}

	for _, table := range tables {
		if err := db.AutoMigrate(table); err != nil {
			return fmt.Errorf("failed migrating table %T: %w", table, err)
		}
	}

	log.Printf("[DB] Auto-migrations completed successfully.")
	return nil
}
