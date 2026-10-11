package databasemgr

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// HostRepository defines persistence for DatabaseHost records.
type HostRepository interface {
	Save(ctx context.Context, host *DatabaseHost) error
	Get(ctx context.Context, id string) (*DatabaseHost, error)
	List(ctx context.Context) ([]*DatabaseHost, error)
	Delete(ctx context.Context, id string) error
	IncrementDatabaseCount(ctx context.Context, hostID string) error
	DecrementDatabaseCount(ctx context.Context, hostID string) error
}

// MemoryHostRepository provides a thread-safe in-memory HostRepository.
type MemoryHostRepository struct {
	mu    sync.RWMutex
	hosts map[string]*DatabaseHost
}

// NewMemoryHostRepository creates an initialized MemoryHostRepository.
func NewMemoryHostRepository() *MemoryHostRepository {
	return &MemoryHostRepository{
		hosts: make(map[string]*DatabaseHost),
	}
}

func (r *MemoryHostRepository) Save(ctx context.Context, host *DatabaseHost) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	if host.CreatedAt.IsZero() {
		host.CreatedAt = now
	}
	host.UpdatedAt = now

	cloned := cloneHost(host)
	r.hosts[cloned.ID] = cloned
	return nil
}

func (r *MemoryHostRepository) Get(ctx context.Context, id string) (*DatabaseHost, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	host, ok := r.hosts[id]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrHostNotFound, id)
	}
	return cloneHost(host), nil
}

func (r *MemoryHostRepository) List(ctx context.Context) ([]*DatabaseHost, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]*DatabaseHost, 0, len(r.hosts))
	for _, h := range r.hosts {
		res = append(res, cloneHost(h))
	}
	return res, nil
}

func (r *MemoryHostRepository) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.hosts[id]; !ok {
		return fmt.Errorf("%w: %s", ErrHostNotFound, id)
	}
	delete(r.hosts, id)
	return nil
}

func (r *MemoryHostRepository) IncrementDatabaseCount(ctx context.Context, hostID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	host, ok := r.hosts[hostID]
	if !ok {
		return fmt.Errorf("%w: %s", ErrHostNotFound, hostID)
	}
	host.CurrentDatabases++
	host.UpdatedAt = time.Now()
	return nil
}

func (r *MemoryHostRepository) DecrementDatabaseCount(ctx context.Context, hostID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	host, ok := r.hosts[hostID]
	if !ok {
		return fmt.Errorf("%w: %s", ErrHostNotFound, hostID)
	}
	if host.CurrentDatabases > 0 {
		host.CurrentDatabases--
	}
	host.UpdatedAt = time.Now()
	return nil
}

// HostSelector defines the strategy interface for selecting the best DatabaseHost.
type HostSelector interface {
	SelectHost(ctx context.Context, criteria SelectionCriteria) (*DatabaseHost, error)
}

// DefaultHostSelector implements intelligent host mapping considering node affinity and capacity limits.
type DefaultHostSelector struct {
	repo HostRepository
}

// NewDefaultHostSelector creates a new DefaultHostSelector.
func NewDefaultHostSelector(repo HostRepository) *DefaultHostSelector {
	return &DefaultHostSelector{repo: repo}
}

// SelectHost chooses the most suitable DatabaseHost matching the criteria.
func (s *DefaultHostSelector) SelectHost(ctx context.Context, criteria SelectionCriteria) (*DatabaseHost, error) {
	// If explicit host requested
	if criteria.RequestedHostID != "" {
		host, err := s.repo.Get(ctx, criteria.RequestedHostID)
		if err != nil {
			return nil, err
		}
		if !host.IsActive {
			return nil, fmt.Errorf("requested database host %q is inactive", host.ID)
		}
		if host.MaxDatabases > 0 && host.CurrentDatabases >= host.MaxDatabases {
			return nil, fmt.Errorf("%w: host %s (%d/%d)", ErrHostAtCapacity, host.ID, host.CurrentDatabases, host.MaxDatabases)
		}
		return host, nil
	}

	hosts, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	targetType := criteria.Type
	if targetType == "" {
		targetType = DatabaseTypeMySQL
	}

	// Filter viable candidates
	var candidates []*DatabaseHost
	for _, h := range hosts {
		if !h.IsActive {
			continue
		}

		// Dialect matching
		if targetType == DatabaseTypeMySQL || targetType == DatabaseTypeMariaDB {
			if h.Type != DatabaseTypeMySQL && h.Type != DatabaseTypeMariaDB {
				continue
			}
		} else if h.Type != targetType {
			continue
		}

		// Capacity check
		if h.MaxDatabases > 0 && h.CurrentDatabases >= h.MaxDatabases {
			continue
		}

		candidates = append(candidates, h)
	}

	if len(candidates) == 0 {
		return nil, ErrNoSuitableDatabaseHost
	}

	// Score candidates based on node affinity and current load
	type scoredHost struct {
		host           *DatabaseHost
		hasNodeAffinity bool
		load           int
	}

	scored := make([]scoredHost, len(candidates))
	for i, c := range candidates {
		hasAffinity := false
		if criteria.NodeID != "" {
			for _, nodeID := range c.NodeAffinity {
				if nodeID == criteria.NodeID {
					hasAffinity = true
					break
				}
			}
		}
		scored[i] = scoredHost{
			host:           c,
			hasNodeAffinity: hasAffinity,
			load:           c.CurrentDatabases,
		}
	}

	// Sort candidates:
	// 1. Hosts with matching Node Affinity first
	// 2. Hosts with lower CurrentDatabases load
	sort.Slice(scored, func(i, j int) bool {
		if scored[i].hasNodeAffinity != scored[j].hasNodeAffinity {
			return scored[i].hasNodeAffinity // true comes before false
		}
		return scored[i].load < scored[j].load
	})

	return scored[0].host, nil
}

func cloneHost(h *DatabaseHost) *DatabaseHost {
	dst := *h
	if len(h.NodeAffinity) > 0 {
		dst.NodeAffinity = make([]string, len(h.NodeAffinity))
		copy(dst.NodeAffinity, h.NodeAffinity)
	}
	if len(h.Metadata) > 0 {
		dst.Metadata = make(map[string]string)
		for k, v := range h.Metadata {
			dst.Metadata[k] = v
		}
	}
	return &dst
}
