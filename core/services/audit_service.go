package services

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

// AuditService handles recording and querying audit logs.
type AuditService struct {
	db *gorm.DB
}

// NewAuditService creates a new AuditService.
func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

// Log records a single audit event.
func (a *AuditService) Log(actorID *uint, actorType string, serverID *uint, event string, properties interface{}, ip string) error {
	var propsStr string
	if properties != nil {
		if str, ok := properties.(string); ok {
			propsStr = str
		} else {
			bytes, err := json.Marshal(properties)
			if err == nil {
				propsStr = string(bytes)
			}
		}
	}

	if ip == "" {
		ip = "127.0.0.1"
	}

	entry := models.AuditLog{
		UUID:       uuid.New().String(),
		ActorID:    actorID,
		ActorType:  actorType,
		ServerID:   serverID,
		Event:      event,
		Properties: propsStr,
		IP:         ip,
		Timestamp:  time.Now().UTC(),
	}

	return a.db.Create(&entry).Error
}

// LogBatch records a batch of audit logs inside a single database transaction.
func (a *AuditService) LogBatch(logs []models.AuditLog) error {
	if len(logs) == 0 {
		return nil
	}
	return a.db.Transaction(func(tx *gorm.DB) error {
		return tx.Create(&logs).Error
	})
}
