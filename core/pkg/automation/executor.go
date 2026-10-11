package automation

import (
	"context"
	"fmt"
	"sync"
)

// ServerExecutor defines the abstraction for sending actions to game server daemons (e.g. Wings).
type ServerExecutor interface {
	// SendCommand sends a console command to the specified server and returns daemon output if any.
	SendCommand(ctx context.Context, serverID string, command string) (string, error)

	// SendPowerAction transitions the power state of the server (start, stop, restart, kill).
	SendPowerAction(ctx context.Context, serverID string, action PowerAction) error

	// CreateBackup initiates a backup on the daemon and returns the generated backup ID.
	CreateBackup(ctx context.Context, serverID string, ignoredFiles []string) (string, error)

	// IsServerOnline returns true if the server is in a starting or running state.
	IsServerOnline(ctx context.Context, serverID string) (bool, error)
}

// MockServerExecutor is an in-memory thread-safe implementation of ServerExecutor for testing and local runs.
type MockServerExecutor struct {
	mu            sync.RWMutex
	CommandsSent  []string
	PowerActions  []PowerAction
	BackupsMade   [][]string
	OnlineServers map[string]bool

	// Custom error hooks
	CommandError error
	PowerError   error
	BackupError  error
	OnlineError  error

	// Custom responses
	CommandOutput string
	BackupID      string
}

// NewMockServerExecutor creates an initialized MockServerExecutor.
func NewMockServerExecutor() *MockServerExecutor {
	return &MockServerExecutor{
		CommandsSent:  make([]string, 0),
		PowerActions:  make([]PowerAction, 0),
		BackupsMade:   make([][]string, 0),
		OnlineServers: make(map[string]bool),
		BackupID:      "backup-mock-123",
	}
}

// SetServerOnline configures whether a server is reported as online.
func (m *MockServerExecutor) SetServerOnline(serverID string, online bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OnlineServers[serverID] = online
}

func (m *MockServerExecutor) SendCommand(ctx context.Context, serverID string, command string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.CommandError != nil {
		return "", m.CommandError
	}
	m.CommandsSent = append(m.CommandsSent, fmt.Sprintf("%s:%s", serverID, command))
	if m.CommandOutput != "" {
		return m.CommandOutput, nil
	}
	return fmt.Sprintf("Command %q executed on %s", command, serverID), nil
}

func (m *MockServerExecutor) SendPowerAction(ctx context.Context, serverID string, action PowerAction) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.PowerError != nil {
		return m.PowerError
	}
	m.PowerActions = append(m.PowerActions, action)
	return nil
}

func (m *MockServerExecutor) CreateBackup(ctx context.Context, serverID string, ignoredFiles []string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.BackupError != nil {
		return "", m.BackupError
	}
	m.BackupsMade = append(m.BackupsMade, ignoredFiles)
	return m.BackupID, nil
}

func (m *MockServerExecutor) IsServerOnline(ctx context.Context, serverID string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.OnlineError != nil {
		return false, m.OnlineError
	}
	online, ok := m.OnlineServers[serverID]
	if !ok {
		// Default to true unless explicitly marked offline
		return true, nil
	}
	return online, nil
}
