package services

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pteronext/panel-core/models"
	"golang.org/x/crypto/pbkdf2"
	"gorm.io/gorm"
)

type BackupService struct {
	db          *gorm.DB
	fileService *FileService
	webhook     *WebhookService
	backupDir   string
}

func NewBackupService(db *gorm.DB, fileService *FileService, webhook *WebhookService, dataDir string) *BackupService {
	if dataDir == "" {
		dataDir = "/var/lib/pteronext"
	}
	bDir := filepath.Join(dataDir, "backups")
	_ = os.MkdirAll(bDir, 0755)

	return &BackupService{
		db:          db,
		fileService: fileService,
		webhook:     webhook,
		backupDir:   bDir,
	}
}

// DeriveKey generates a 32-byte AES-256 key from a password and salt using PBKDF2.
func deriveKey(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)
}

// EncryptArchive encrypts plaintext bytes with AES-256-GCM.
func encryptArchive(plaintext []byte, password string) ([]byte, string, error) {
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, "", err
	}

	key := deriveKey(password, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, "", err
	}

	// Output format: salt (16 bytes) || nonce (12 bytes) || ciphertext
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	final := append(salt, append(nonce, ciphertext...)...)

	return final, hex.EncodeToString(salt), nil
}

// DecryptArchive decrypts ciphertext using AES-256-GCM.
func decryptArchive(data []byte, password string) ([]byte, error) {
	if len(data) < 28 { // 16 salt + 12 nonce
		return nil, errors.New("invalid encrypted backup archive: header too short")
	}

	salt := data[:16]
	nonce := data[16:28]
	ciphertext := data[28:]

	key := deriveKey(password, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed: incorrect password or corrupted backup")
	}

	return plaintext, nil
}

// CreateBackup generates a fast, optionally encrypted snapshot archive of the server volume.
// If maxBackups or server.BackupLimit is set, automatic backup rotation is triggered:
// The oldest unlocked backups are removed to stay within the limit. Backups with is_locked=true are NEVER deleted!
func (b *BackupService) CreateBackup(serverUUID, name, encryptPassword string, isLocked bool, ignored []string, maxBackups ...int) (*models.Backup, error) {
	var server models.Server
	if err := b.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		return nil, fmt.Errorf("server not found: %w", err)
	}

	// Automatic Backup Rotation before snapshot creation if limit configured
	limit := 0
	if len(maxBackups) > 0 && maxBackups[0] > 0 {
		limit = maxBackups[0]
	} else if server.BackupLimit > 0 {
		limit = server.BackupLimit
	}
	if limit > 0 {
		targetBefore := limit - 1
		if targetBefore < 1 {
			targetBefore = 1
		}
		_, _ = b.RotateBackups(serverUUID, targetBefore)
	}

	baseDir, err := b.fileService.GetServerBaseDir(serverUUID)
	if err != nil {
		return nil, err
	}

	backupUUID := uuid.New().String()
	if name == "" {
		name = fmt.Sprintf("Backup-%s-%s", server.Name, time.Now().Format("2006-01-02-150405"))
	}

	destDir := filepath.Join(b.backupDir, serverUUID)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, err
	}

	archiveExt := ".tar.gz"
	if encryptPassword != "" {
		archiveExt = ".tar.gz.enc"
	}
	destPath := filepath.Join(destDir, backupUUID+archiveExt)

	// In-memory buffer for compression
	var tarBuf bytes.Buffer
	gw, _ := gzip.NewWriterLevel(&tarBuf, gzip.BestSpeed)
	tw := tar.NewWriter(gw)

	ignoredSet := make(map[string]bool)
	for _, ign := range ignored {
		ignoredSet[strings.Trim(ign, "/")] = true
	}

	// Walk server files
	err = filepath.Walk(baseDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		relPath, _ := filepath.Rel(baseDir, path)
		if relPath == "." {
			return nil
		}

		cleanRel := strings.TrimPrefix(filepath.ToSlash(relPath), "/")
		if ignoredSet[cleanRel] {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		header, hErr := tar.FileInfoHeader(info, info.Name())
		if hErr != nil {
			return nil
		}
		header.Name = cleanRel

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		if !info.IsDir() {
			file, fErr := os.Open(path)
			if fErr != nil {
				return nil
			}
			defer file.Close()
			_, _ = io.Copy(tw, file)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed bundling server files: %w", err)
	}

	tw.Close()
	gw.Close()

	compressedBytes := tarBuf.Bytes()
	var finalBytes []byte
	var salt string
	isEncrypted := false

	if encryptPassword != "" {
		isEncrypted = true
		encBytes, s, encErr := encryptArchive(compressedBytes, encryptPassword)
		if encErr != nil {
			return nil, fmt.Errorf("failed encrypting backup: %w", encErr)
		}
		finalBytes = encBytes
		salt = s
	} else {
		finalBytes = compressedBytes
	}

	if err := os.WriteFile(destPath, finalBytes, 0600); err != nil {
		return nil, fmt.Errorf("failed writing backup file: %w", err)
	}

	hash := sha256.Sum256(finalBytes)
	checksum := hex.EncodeToString(hash[:])
	now := time.Now()

	backupRecord := models.Backup{
		ServerID:       server.ID,
		UUID:           backupUUID,
		Name:           name,
		IsSuccessful:   true,
		IsLocked:       isLocked,
		IsEncrypted:    isEncrypted,
		EncryptionSalt: salt,
		Checksum:       checksum,
		Bytes:          int64(len(finalBytes)),
		CompletedAt:    &now,
	}

	if err := b.db.Create(&backupRecord).Error; err != nil {
		return nil, err
	}

	// Automatic Backup Rotation after snapshot creation to ensure limit is not exceeded
	if limit > 0 {
		_, _ = b.RotateBackups(serverUUID, limit)
	}

	// Trigger automation webhook
	if b.webhook != nil {
		sizeMB := fmt.Sprintf("%.2f MB", float64(len(finalBytes))/(1024*1024))
		b.webhook.TriggerEvent(
			serverUUID,
			"backup.completed",
			fmt.Sprintf("💾 Backup Created: %s", name),
			fmt.Sprintf("Snapshot archived successfully (%s).", sizeMB),
			map[string]string{
				"Backup Name": name,
				"Size":        sizeMB,
				"Encrypted":   fmt.Sprintf("%v", isEncrypted),
			},
			fmt.Sprintf("https://panel.springisfm.de/server/%s/backups", serverUUID),
		)
	}

	return &backupRecord, nil
}

// RotateBackups enforces backup retention by automatically deleting the oldest unlocked backups.
// Crucial: Backups with is_locked = true (Sicherheits-Lock) are NEVER deleted automatically!
func (b *BackupService) RotateBackups(serverUUID string, maxBackups int) (int, error) {
	if maxBackups <= 0 {
		return 0, nil
	}
	var server models.Server
	if err := b.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		return 0, fmt.Errorf("server not found: %w", err)
	}

	var backups []models.Backup
	if err := b.db.Where("server_id = ?", server.ID).Order("created_at asc").Find(&backups).Error; err != nil {
		return 0, err
	}

	if len(backups) <= maxBackups {
		return 0, nil
	}

	toDeleteCount := len(backups) - maxBackups
	deleted := 0

	for _, bkp := range backups {
		if deleted >= toDeleteCount {
			break
		}
		// Security lock protection: NEVER delete locked backups!
		if bkp.IsLocked {
			continue
		}

		filePath := b.GetBackupFilePath(&bkp, serverUUID)
		_ = os.Remove(filePath)
		if err := b.db.Delete(&bkp).Error; err == nil {
			deleted++
		}
	}

	return deleted, nil
}

// GetBackupLimit returns the configured backup limit for a server.
func (b *BackupService) GetBackupLimit(serverUUID string) (int, error) {
	var server models.Server
	if err := b.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		return 0, err
	}
	return server.BackupLimit, nil
}

// SetBackupLimit updates the configured backup limit for a server.
func (b *BackupService) SetBackupLimit(serverUUID string, limit int) error {
	var server models.Server
	if err := b.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		return err
	}
	return b.db.Model(&server).Update("backup_limit", limit).Error
}

// ListBackups returns all backups for a server.
func (b *BackupService) ListBackups(serverUUID string) ([]models.Backup, error) {
	var server models.Server
	if err := b.db.Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		return nil, err
	}

	var backups []models.Backup
	err := b.db.Where("server_id = ?", server.ID).Order("created_at desc").Find(&backups).Error
	return backups, err
}

// GetBackup returns a single backup record.
func (b *BackupService) GetBackup(serverUUID, backupUUID string) (*models.Backup, error) {
	var backup models.Backup
	err := b.db.Joins("JOIN servers ON servers.id = backups.server_id").
		Where("servers.uuid = ? AND backups.uuid = ?", serverUUID, backupUUID).
		First(&backup).Error
	if err != nil {
		return nil, fmt.Errorf("backup not found: %w", err)
	}
	return &backup, nil
}

// DeleteBackup deletes the backup record and physical archive file.
func (b *BackupService) DeleteBackup(serverUUID, backupUUID string) error {
	backup, err := b.GetBackup(serverUUID, backupUUID)
	if err != nil {
		return err
	}

	if backup.IsLocked {
		return errors.New("cannot delete a locked backup snapshot")
	}

	filePath := b.GetBackupFilePath(backup, serverUUID)
	_ = os.Remove(filePath)

	return b.db.Delete(backup).Error
}

// getServerEncryptionKey returns a derived server key for automated lock encryption
func getServerEncryptionKey(serverUUID string) string {
	return fmt.Sprintf("pteronext_server_locked_%s", serverUUID)
}

// ToggleLock changes the lock status of a backup.
// When locked, the snapshot is marked locked against deletion and encrypted server-side with AES-256-GCM.
func (b *BackupService) ToggleLock(serverUUID, backupUUID string) (*models.Backup, error) {
	backup, err := b.GetBackup(serverUUID, backupUUID)
	if err != nil {
		return nil, err
	}

	targetLocked := !backup.IsLocked
	serverKey := getServerEncryptionKey(serverUUID)

	if targetLocked {
		// LOCKING: Encrypt server-side if currently plain tar.gz
		if !backup.IsEncrypted {
			oldPath := filepath.Join(b.backupDir, serverUUID, backup.UUID+".tar.gz")
			if rawData, rErr := os.ReadFile(oldPath); rErr == nil && len(rawData) > 0 {
				encBytes, salt, encErr := encryptArchive(rawData, serverKey)
				if encErr == nil {
					newPath := filepath.Join(b.backupDir, serverUUID, backup.UUID+".tar.gz.enc")
					if wErr := os.WriteFile(newPath, encBytes, 0600); wErr == nil {
						_ = os.Remove(oldPath)
						backup.IsEncrypted = true
						backup.EncryptionSalt = salt
						backup.Bytes = int64(len(encBytes))
						hash := sha256.Sum256(encBytes)
						backup.Checksum = hex.EncodeToString(hash[:])
					}
				}
			}
		}
		backup.IsLocked = true
	} else {
		// UNLOCKING: If encrypted with the server lock key, decrypt back to plain tar.gz
		if backup.IsEncrypted {
			encPath := filepath.Join(b.backupDir, serverUUID, backup.UUID+".tar.gz.enc")
			if encData, rErr := os.ReadFile(encPath); rErr == nil && len(encData) > 0 {
				if decBytes, dErr := decryptArchive(encData, serverKey); dErr == nil {
					plainPath := filepath.Join(b.backupDir, serverUUID, backup.UUID+".tar.gz")
					if wErr := os.WriteFile(plainPath, decBytes, 0600); wErr == nil {
						_ = os.Remove(encPath)
						backup.IsEncrypted = false
						backup.EncryptionSalt = ""
						backup.Bytes = int64(len(decBytes))
						hash := sha256.Sum256(decBytes)
						backup.Checksum = hex.EncodeToString(hash[:])
					}
				}
			}
		}
		backup.IsLocked = false
	}

	if err := b.db.Save(backup).Error; err != nil {
		return nil, err
	}
	return backup, nil
}

// GetBackupFilePath resolves the on-disk storage path of a backup.
func (b *BackupService) GetBackupFilePath(backup *models.Backup, serverUUID string) string {
	ext := ".tar.gz"
	if backup.IsEncrypted {
		ext = ".tar.gz.enc"
	}
	return filepath.Join(b.backupDir, serverUUID, backup.UUID+ext)
}

// readDecryptedTarBuffer opens and optionally decrypts the archive into a tar.Reader.
func (b *BackupService) readDecryptedTarReader(backup *models.Backup, serverUUID, decryptPassword string) (*tar.Reader, func(), error) {
	filePath := b.GetBackupFilePath(backup, serverUUID)
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("could not open backup archive: %w", err)
	}

	var gzData []byte
	if backup.IsEncrypted {
		var dec []byte
		var dErr error
		if decryptPassword != "" {
			dec, dErr = decryptArchive(raw, decryptPassword)
		}
		if dErr != nil || decryptPassword == "" {
			// Try server lock key
			serverKey := getServerEncryptionKey(serverUUID)
			if sDec, sErr := decryptArchive(raw, serverKey); sErr == nil {
				dec = sDec
				dErr = nil
			}
		}

		if dErr != nil {
			return nil, nil, fmt.Errorf("this backup is encrypted; password is required or invalid: %w", dErr)
		}
		gzData = dec
	} else {
		gzData = raw
	}

	gr, err := gzip.NewReader(bytes.NewReader(gzData))
	if err != nil {
		return nil, nil, fmt.Errorf("invalid gzip compression in backup: %w", err)
	}

	tr := tar.NewReader(gr)
	cleanup := func() {
		gr.Close()
	}

	return tr, cleanup, nil
}

// ListBackupContents returns all file paths contained within the backup archive.
func (b *BackupService) ListBackupContents(serverUUID, backupUUID, decryptPassword string) ([]string, error) {
	backup, err := b.GetBackup(serverUUID, backupUUID)
	if err != nil {
		return nil, err
	}

	tr, cleanup, err := b.readDecryptedTarReader(backup, serverUUID, decryptPassword)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	var files []string
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		files = append(files, hdr.Name)
	}

	return files, nil
}

// RestoreFull restores all files from the backup archive into the server directory.
func (b *BackupService) RestoreFull(serverUUID, backupUUID, decryptPassword string, truncate bool) error {
	backup, err := b.GetBackup(serverUUID, backupUUID)
	if err != nil {
		return err
	}

	baseDir, err := b.fileService.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	tr, cleanup, err := b.readDecryptedTarReader(backup, serverUUID, decryptPassword)
	if err != nil {
		return err
	}
	defer cleanup()

	// If truncate, clean volume directory
	if truncate {
		entries, _ := os.ReadDir(baseDir)
		for _, e := range entries {
			_ = os.RemoveAll(filepath.Join(baseDir, e.Name()))
		}
	}

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		targetPath := filepath.Join(baseDir, hdr.Name)
		if !strings.HasPrefix(targetPath, filepath.Clean(baseDir)) {
			continue // Prevent ZipSlip directory traversal
		}

		switch hdr.Typeflag {
		case tar.TypeDir:
			_ = os.MkdirAll(targetPath, 0755)
		case tar.TypeReg:
			_ = os.MkdirAll(filepath.Dir(targetPath), 0755)
			outFile, oErr := os.OpenFile(targetPath, os.O_CREATE|os.O_RDWR|os.O_TRUNC, hdr.FileInfo().Mode())
			if oErr == nil {
				_, _ = io.Copy(outFile, tr)
				outFile.Close()
			}
		}
	}

	return nil
}

// RestoreFile restores a specific file or folder from the backup archive.
func (b *BackupService) RestoreFile(serverUUID, backupUUID, decryptPassword, targetPath string) error {
	backup, err := b.GetBackup(serverUUID, backupUUID)
	if err != nil {
		return err
	}

	baseDir, err := b.fileService.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	tr, cleanup, err := b.readDecryptedTarReader(backup, serverUUID, decryptPassword)
	if err != nil {
		return err
	}
	defer cleanup()

	cleanTarget := strings.TrimPrefix(filepath.ToSlash(targetPath), "/")
	found := false

	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		headerName := strings.TrimPrefix(filepath.ToSlash(hdr.Name), "/")

		// Match exact file or directory prefix
		if headerName == cleanTarget || strings.HasPrefix(headerName, cleanTarget+"/") {
			found = true
			destPath := filepath.Join(baseDir, headerName)
			if !strings.HasPrefix(destPath, filepath.Clean(baseDir)) {
				continue
			}

			switch hdr.Typeflag {
			case tar.TypeDir:
				_ = os.MkdirAll(destPath, 0755)
			case tar.TypeReg:
				_ = os.MkdirAll(filepath.Dir(destPath), 0755)
				outFile, oErr := os.OpenFile(destPath, os.O_CREATE|os.O_RDWR|os.O_TRUNC, hdr.FileInfo().Mode())
				if oErr == nil {
					_, _ = io.Copy(outFile, tr)
					outFile.Close()
				}
			}
		}
	}

	if !found {
		return fmt.Errorf("item '%s' not found inside backup archive", targetPath)
	}

	return nil
}
