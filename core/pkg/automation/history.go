package automation

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// HistoryStore defines the persistence contract for automation execution logs.
type HistoryStore interface {
	Save(ctx context.Context, log *ExecutionLog) error
	Get(ctx context.Context, id string) (*ExecutionLog, error)
	ListBySchedule(ctx context.Context, scheduleID string, limit, offset int) ([]*ExecutionLog, int64, error)
	ListByServer(ctx context.Context, serverID string, limit, offset int) ([]*ExecutionLog, int64, error)
	Prune(ctx context.Context, olderThan time.Duration) (int64, error)
}

// MemoryHistoryStore provides a thread-safe in-memory store for execution logs.
type MemoryHistoryStore struct {
	mu       sync.RWMutex
	logs     map[string]*ExecutionLog
	maxLimit int
}

// NewMemoryHistoryStore creates an initialized MemoryHistoryStore.
func NewMemoryHistoryStore(maxCapacity ...int) *MemoryHistoryStore {
	cap := 1000
	if len(maxCapacity) > 0 && maxCapacity[0] > 0 {
		cap = maxCapacity[0]
	}
	return &MemoryHistoryStore{
		logs:     make(map[string]*ExecutionLog),
		maxLimit: cap,
	}
}

// Save stores or updates an execution log.
func (m *MemoryHistoryStore) Save(ctx context.Context, log *ExecutionLog) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Clone to prevent external mutation
	cloned := cloneLog(log)
	m.logs[cloned.ID] = cloned

	// Enforce capacity bounds if exceeded
	if len(m.logs) > m.maxLimit {
		// Remove oldest
		var oldestID string
		var oldestTime time.Time
		for id, l := range m.logs {
			if oldestTime.IsZero() || l.StartedAt.Before(oldestTime) {
				oldestTime = l.StartedAt
				oldestID = id
			}
		}
		if oldestID != "" {
			delete(m.logs, oldestID)
		}
	}

	return nil
}

// Get retrieves an execution log by ID.
func (m *MemoryHistoryStore) Get(ctx context.Context, id string) (*ExecutionLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	log, ok := m.logs[id]
	if !ok {
		return nil, fmt.Errorf("execution log %q not found", id)
	}
	return cloneLog(log), nil
}

// ListBySchedule returns logs for a specific schedule ordered by StartedAt descending.
func (m *MemoryHistoryStore) ListBySchedule(ctx context.Context, scheduleID string, limit, offset int) ([]*ExecutionLog, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var matched []*ExecutionLog
	for _, l := range m.logs {
		if l.ScheduleID == scheduleID {
			matched = append(matched, cloneLog(l))
		}
	}

	// Sort descending by StartedAt
	sort.Slice(matched, func(i, j int) bool {
		return matched[i].StartedAt.After(matched[j].StartedAt)
	})

	total := int64(len(matched))
	if offset >= len(matched) {
		return []*ExecutionLog{}, total, nil
	}

	end := offset + limit
	if limit <= 0 || end > len(matched) {
		end = len(matched)
	}

	return matched[offset:end], total, nil
}

// ListByServer returns logs for a specific server ordered by StartedAt descending.
func (m *MemoryHistoryStore) ListByServer(ctx context.Context, serverID string, limit, offset int) ([]*ExecutionLog, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var matched []*ExecutionLog
	for _, l := range m.logs {
		if l.ServerID == serverID {
			matched = append(matched, cloneLog(l))
		}
	}

	sort.Slice(matched, func(i, j int) bool {
		return matched[i].StartedAt.After(matched[j].StartedAt)
	})

	total := int64(len(matched))
	if offset >= len(matched) {
		return []*ExecutionLog{}, total, nil
	}

	end := offset + limit
	if limit <= 0 || end > len(matched) {
		end = len(matched)
	}

	return matched[offset:end], total, nil
}

// Prune removes logs older than the specified duration.
func (m *MemoryHistoryStore) Prune(ctx context.Context, olderThan time.Duration) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cutoff := time.Now().Add(-olderThan)
	var count int64
	for id, l := range m.logs {
		if l.StartedAt.Before(cutoff) {
			delete(m.logs, id)
			count++
		}
	}
	return count, nil
}

func cloneLog(src *ExecutionLog) *ExecutionLog {
	dst := *src
	dst.StepResults = make([]StepResult, len(src.StepResults))
	copy(dst.StepResults, src.StepResults)
	return &dst
}
