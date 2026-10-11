package security

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Actor Types
const (
	ActorTypeUser   = "user"
	ActorTypeSystem = "system"
	ActorTypeDaemon = "daemon"
	ActorTypeAPIKey = "api_key"
)

// Action Status
const (
	AuditStatusSuccess = "success"
	AuditStatusFailed  = "failed"
	AuditStatusDenied  = "denied"
)

// AuditEntry represents a recorded administrative or server-level action.
type AuditEntry struct {
	ID             string         `json:"id"`
	UserID         string         `json:"user_id"`
	Username       string         `json:"username,omitempty"`
	ActorType      string         `json:"actor_type"` // user, system, daemon, api_key
	IP             string         `json:"ip"`
	UserAgent      string         `json:"user_agent,omitempty"`
	Action         string         `json:"action"` // e.g. server.power, admin.users.create
	Target         string         `json:"target"` // e.g. server:UUID, user:ID
	TargetType     string         `json:"target_type,omitempty"`
	TargetID       string         `json:"target_id,omitempty"`
	Timestamp      time.Time      `json:"timestamp"`
	PayloadSummary map[string]any `json:"payload_summary,omitempty"`
	Status         string         `json:"status"` // success, failed, denied
	ErrorMessage   string         `json:"error_message,omitempty"`
}

// AuditFilter contains criteria for querying recorded audit logs.
type AuditFilter struct {
	UserID       string
	Target       string
	TargetType   string
	TargetID     string
	ActionPrefix string
	Status       string
	Since        time.Time
	Until        time.Time
	Limit        int
	Offset       int
}

// AuditSink is the storage interface for audit log entries.
type AuditSink interface {
	Write(ctx context.Context, entry *AuditEntry) error
	Query(ctx context.Context, filter AuditFilter) ([]*AuditEntry, int64, error)
	GetByID(ctx context.Context, id string) (*AuditEntry, error)
}

// MemoryAuditStore is a thread-safe, bounded in-memory audit store.
type MemoryAuditStore struct {
	mu       sync.RWMutex
	capacity int
	entries  []*AuditEntry
	indexMap map[string]*AuditEntry
}

// NewMemoryAuditStore creates an in-memory audit log sink with a max capacity.
func NewMemoryAuditStore(capacity int) *MemoryAuditStore {
	if capacity <= 0 {
		capacity = 50000
	}
	return &MemoryAuditStore{
		capacity: capacity,
		entries:  make([]*AuditEntry, 0, 1000),
		indexMap: make(map[string]*AuditEntry),
	}
}

// Write records an audit log entry.
func (s *MemoryAuditStore) Write(ctx context.Context, entry *AuditEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cp := *entry
	if cp.ID == "" {
		cp.ID = "aud_" + uuid.NewString()
	}
	if cp.Timestamp.IsZero() {
		cp.Timestamp = time.Now().UTC()
	}

	// Trim oldest if exceeded capacity
	if len(s.entries) >= s.capacity {
		evicted := s.entries[0]
		delete(s.indexMap, evicted.ID)
		s.entries = s.entries[1:]
	}

	s.entries = append(s.entries, &cp)
	s.indexMap[cp.ID] = &cp
	return nil
}

// GetByID looks up an audit entry by its ID.
func (s *MemoryAuditStore) GetByID(ctx context.Context, id string) (*AuditEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entry, ok := s.indexMap[id]
	if !ok {
		return nil, fmt.Errorf("audit log %q not found", id)
	}
	cp := *entry
	return &cp, nil
}

// Query filters and paginates audit log entries.
func (s *MemoryAuditStore) Query(ctx context.Context, filter AuditFilter) ([]*AuditEntry, int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var matched []*AuditEntry
	for _, e := range s.entries {
		if filter.UserID != "" && e.UserID != filter.UserID {
			continue
		}
		if filter.Target != "" && e.Target != filter.Target {
			continue
		}
		if filter.TargetType != "" && e.TargetType != filter.TargetType {
			continue
		}
		if filter.TargetID != "" && e.TargetID != filter.TargetID {
			continue
		}
		if filter.ActionPrefix != "" && !strings.HasPrefix(e.Action, filter.ActionPrefix) {
			continue
		}
		if filter.Status != "" && e.Status != filter.Status {
			continue
		}
		if !filter.Since.IsZero() && e.Timestamp.Before(filter.Since) {
			continue
		}
		if !filter.Until.IsZero() && e.Timestamp.After(filter.Until) {
			continue
		}

		cp := *e
		matched = append(matched, &cp)
	}

	// Sort descending by timestamp (newest first)
	sort.Slice(matched, func(i, j int) bool {
		return matched[i].Timestamp.After(matched[j].Timestamp)
	})

	total := int64(len(matched))

	start := filter.Offset
	if start > len(matched) {
		return []*AuditEntry{}, total, nil
	}

	end := len(matched)
	if filter.Limit > 0 && start+filter.Limit < end {
		end = start + filter.Limit
	}

	return matched[start:end], total, nil
}

// AuditLogger manages writing audit entries both synchronously and asynchronously.
type AuditLogger struct {
	sink    AuditSink
	asyncCh chan *AuditEntry
	wg      sync.WaitGroup
	closed  bool
	mu      sync.Mutex
}

// NewAuditLogger creates a new audit logger.
// If bufferSize > 0, an asynchronous background worker handles log writes to eliminate request latency.
func NewAuditLogger(sink AuditSink, bufferSize int) *AuditLogger {
	if sink == nil {
		sink = NewMemoryAuditStore(10000)
	}

	al := &AuditLogger{
		sink: sink,
	}

	if bufferSize > 0 {
		al.asyncCh = make(chan *AuditEntry, bufferSize)
		al.wg.Add(1)
		go al.worker()
	}

	return al
}

func (al *AuditLogger) worker() {
	defer al.wg.Done()
	for entry := range al.asyncCh {
		_ = al.sink.Write(context.Background(), entry)
	}
}

// Log records an audit entry. If an async buffer is active, it enqueues the entry.
func (al *AuditLogger) Log(ctx context.Context, entry *AuditEntry) error {
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	if entry.ID == "" {
		entry.ID = "aud_" + uuid.NewString()
	}
	if entry.Status == "" {
		entry.Status = AuditStatusSuccess
	}
	if entry.ActorType == "" {
		entry.ActorType = ActorTypeUser
	}

	al.mu.Lock()
	isClosed := al.closed
	al.mu.Unlock()

	if isClosed {
		return fmt.Errorf("audit logger is closed")
	}

	if al.asyncCh != nil {
		select {
		case al.asyncCh <- entry:
			return nil
		default:
			// Buffer full: write synchronously to prevent dropped audit entries
			return al.sink.Write(ctx, entry)
		}
	}

	return al.sink.Write(ctx, entry)
}

// LogServerAction is a convenience helper for server-scoped actions.
func (al *AuditLogger) LogServerAction(ctx context.Context, userID, ip, action, serverID, status string, payload map[string]any) error {
	return al.Log(ctx, &AuditEntry{
		UserID:         userID,
		ActorType:      ActorTypeUser,
		IP:             ip,
		Action:         action,
		Target:         "server:" + serverID,
		TargetType:     "server",
		TargetID:       serverID,
		Status:         status,
		PayloadSummary: payload,
	})
}

// LogAdminAction is a convenience helper for administrative operations.
func (al *AuditLogger) LogAdminAction(ctx context.Context, userID, ip, action, targetType, targetID, status string, payload map[string]any) error {
	return al.Log(ctx, &AuditEntry{
		UserID:         userID,
		ActorType:      ActorTypeUser,
		IP:             ip,
		Action:         action,
		Target:         fmt.Sprintf("%s:%s", targetType, targetID),
		TargetType:     targetType,
		TargetID:       targetID,
		Status:         status,
		PayloadSummary: payload,
	})
}

// LogAuthAction is a convenience helper for authentication events (login, 2fa, token generation).
func (al *AuditLogger) LogAuthAction(ctx context.Context, userID, ip, action, status string, payload map[string]any) error {
	return al.Log(ctx, &AuditEntry{
		UserID:         userID,
		ActorType:      ActorTypeUser,
		IP:             ip,
		Action:         action,
		Target:         "user:" + userID,
		TargetType:     "user",
		TargetID:       userID,
		Status:         status,
		PayloadSummary: payload,
	})
}

// Query proxies queries to the underlying sink.
func (al *AuditLogger) Query(ctx context.Context, filter AuditFilter) ([]*AuditEntry, int64, error) {
	return al.sink.Query(ctx, filter)
}

// GetByID retrieves a single audit entry by ID.
func (al *AuditLogger) GetByID(ctx context.Context, id string) (*AuditEntry, error) {
	return al.sink.GetByID(ctx, id)
}

// Close flushes the async buffer and shuts down the worker.
func (al *AuditLogger) Close() {
	al.mu.Lock()
	if al.closed {
		al.mu.Unlock()
		return
	}
	al.closed = true
	al.mu.Unlock()

	if al.asyncCh != nil {
		close(al.asyncCh)
		al.wg.Wait()
	}
}

// --- Gin HTTP Middleware Interceptor ---

// GinAuditMiddleware returns a Gin middleware that automatically creates audit entries
// for executed requests matching the specified action or automatically deduced action.
func GinAuditMiddleware(logger *AuditLogger, defaultAction string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now().UTC()
		c.Next()

		userID := c.GetString("user_id")
		if userID == "" {
			userID = "anonymous"
		}

		serverID := c.Param("server")
		if serverID == "" {
			serverID = c.Param("server_id")
		}

		action := defaultAction
		if action == "" {
			action = fmt.Sprintf("http.%s.%s", strings.ToLower(c.Request.Method), strings.ReplaceAll(c.FullPath(), "/", "."))
		}

		status := AuditStatusSuccess
		if c.Writer.Status() >= 400 {
			if c.Writer.Status() == 403 {
				status = AuditStatusDenied
			} else {
				status = AuditStatusFailed
			}
		}

		target := "system"
		targetType := "system"
		targetID := ""
		if serverID != "" {
			target = "server:" + serverID
			targetType = "server"
			targetID = serverID
		} else if uID := c.Param("user_id"); uID != "" {
			target = "user:" + uID
			targetType = "user"
			targetID = uID
		}

		payload := map[string]any{
			"method":      c.Request.Method,
			"path":        c.Request.URL.Path,
			"status_code": c.Writer.Status(),
			"duration_ms": time.Since(start).Milliseconds(),
		}

		_ = logger.Log(c.Request.Context(), &AuditEntry{
			UserID:         userID,
			IP:             c.ClientIP(),
			UserAgent:      c.Request.UserAgent(),
			Action:         action,
			Target:         target,
			TargetType:     targetType,
			TargetID:       targetID,
			Timestamp:      start,
			Status:         status,
			PayloadSummary: payload,
		})
	}
}
