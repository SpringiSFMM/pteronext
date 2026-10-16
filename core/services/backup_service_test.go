package services_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

func TestBackupRotationAndLockProtection(t *testing.T) {
	// Setup in-memory SQLite DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed opening sqlite: %v", err)
	}

	if err := db.AutoMigrate(&models.Server{}, &models.Backup{}); err != nil {
		t.Fatalf("auto migrate failed: %v", err)
	}

	tempDir, err := os.MkdirTemp("", "ptl-backup-test-*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	fileService := services.NewFileService(db, tempDir)
	webhookService := services.NewWebhookService(db)
	backupService := services.NewBackupService(db, fileService, webhookService, tempDir)

	serverUUID := "11111111-2222-3333-4444-555555555555"
	server := models.Server{
		UUID:        serverUUID,
		Name:        "Test Rotation Server",
		BackupLimit: 3, // retention max 3
	}
	if err := db.Create(&server).Error; err != nil {
		t.Fatalf("failed creating server: %v", err)
	}

	// Create 5 backup records: 1 locked (oldest), 4 unlocked
	// Backup 1 (oldest, LOCKED)
	b1 := models.Backup{
		ServerID:     server.ID,
		UUID:         "backup-1-locked",
		Name:         "B1 Locked",
		IsLocked:     true,
		IsSuccessful: true,
		CreatedAt:    time.Now().Add(-5 * time.Hour),
	}
	// Backup 2 (unlocked)
	b2 := models.Backup{
		ServerID:     server.ID,
		UUID:         "backup-2-unlocked",
		Name:         "B2",
		IsLocked:     false,
		IsSuccessful: true,
		CreatedAt:    time.Now().Add(-4 * time.Hour),
	}
	// Backup 3 (unlocked)
	b3 := models.Backup{
		ServerID:     server.ID,
		UUID:         "backup-3-unlocked",
		Name:         "B3",
		IsLocked:     false,
		IsSuccessful: true,
		CreatedAt:    time.Now().Add(-3 * time.Hour),
	}
	// Backup 4 (unlocked)
	b4 := models.Backup{
		ServerID:     server.ID,
		UUID:         "backup-4-unlocked",
		Name:         "B4",
		IsLocked:     false,
		IsSuccessful: true,
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}
	// Backup 5 (unlocked)
	b5 := models.Backup{
		ServerID:     server.ID,
		UUID:         "backup-5-unlocked",
		Name:         "B5",
		IsLocked:     false,
		IsSuccessful: true,
		CreatedAt:    time.Now().Add(-1 * time.Hour),
	}

	for _, b := range []models.Backup{b1, b2, b3, b4, b5} {
		if err := db.Create(&b).Error; err != nil {
			t.Fatalf("failed inserting backup: %v", err)
		}
		// Write dummy backup file
		filePath := backupService.GetBackupFilePath(&b, serverUUID)
		_ = os.MkdirAll(filepath.Dir(filePath), 0755)
		_ = os.WriteFile(filePath, []byte("dummy archive content"), 0644)
	}

	// Total backups before rotation = 5
	// Retention limit = 3
	// Oldest unlocked backups should be deleted, but LOCKED backup MUST NOT be deleted!
	deleted, err := backupService.RotateBackups(serverUUID, 3)
	if err != nil {
		t.Fatalf("RotateBackups failed: %v", err)
	}

	// Should delete 2 backups (B2 and B3)
	if deleted != 2 {
		t.Errorf("Expected 2 backups deleted, got %d", deleted)
	}

	// Verify locked backup B1 still exists!
	var remainingB1 models.Backup
	if err := db.Where("uuid = ?", "backup-1-locked").First(&remainingB1).Error; err != nil {
		t.Fatalf("CRITICAL: Locked backup was deleted! It must NEVER be deleted: %v", err)
	}

	// Verify B2 and B3 were deleted from DB
	var remainingB2, remainingB3 models.Backup
	if err := db.Where("uuid = ?", "backup-2-unlocked").First(&remainingB2).Error; err == nil {
		t.Errorf("Expected backup-2 to be pruned, but still found")
	}
	if err := db.Where("uuid = ?", "backup-3-unlocked").First(&remainingB3).Error; err == nil {
		t.Errorf("Expected backup-3 to be pruned, but still found")
	}

	// Verify B4 and B5 still exist
	var remainingB4, remainingB5 models.Backup
	if err := db.Where("uuid = ?", "backup-4-unlocked").First(&remainingB4).Error; err != nil {
		t.Errorf("Expected backup-4 to still exist, but got error: %v", err)
	}
	if err := db.Where("uuid = ?", "backup-5-unlocked").First(&remainingB5).Error; err != nil {
		t.Errorf("Expected backup-5 to still exist, but got error: %v", err)
	}

	// Total remaining should be 3 (B1 locked, B4, B5)
	var count int64
	db.Model(&models.Backup{}).Where("server_id = ?", server.ID).Count(&count)
	if count != 3 {
		t.Errorf("Expected exactly 3 remaining backups, got %d", count)
	}
}
