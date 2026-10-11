package databasemgr

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

// SQLExecutor defines the contract for executing raw DDL/DCL queries against database hosts.
type SQLExecutor interface {
	Execute(ctx context.Context, host *DatabaseHost, statements []string) error
	ExecuteOnDB(ctx context.Context, host *DatabaseHost, dbName string, statements []string) error
	Ping(ctx context.Context, host *DatabaseHost) error
}

// DriverSQLExecutor executes queries against real database engines using database/sql.
type DriverSQLExecutor struct {
	timeout time.Duration
}

// NewDriverSQLExecutor creates a new DriverSQLExecutor with default timeout.
func NewDriverSQLExecutor(timeout ...time.Duration) *DriverSQLExecutor {
	t := 15 * time.Second
	if len(timeout) > 0 && timeout[0] > 0 {
		t = timeout[0]
	}
	return &DriverSQLExecutor{timeout: t}
}

// Execute runs multiple SQL statements on the default/admin database of the host.
func (e *DriverSQLExecutor) Execute(ctx context.Context, host *DatabaseHost, statements []string) error {
	return e.ExecuteOnDB(ctx, host, "", statements)
}

// ExecuteOnDB executes statements targeting a specific database on the host.
func (e *DriverSQLExecutor) ExecuteOnDB(ctx context.Context, host *DatabaseHost, dbName string, statements []string) error {
	db, err := e.open(host, dbName)
	if err != nil {
		return fmt.Errorf("failed to connect to database host %q: %w", host.Host, err)
	}
	defer db.Close()

	execCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	for _, stmt := range statements {
		if stmt == "" {
			continue
		}
		if _, err := db.ExecContext(execCtx, stmt); err != nil {
			return fmt.Errorf("failed executing statement %q on %s: %w", stmt, host.Host, err)
		}
	}
	return nil
}

// Ping checks if the database host is reachable.
func (e *DriverSQLExecutor) Ping(ctx context.Context, host *DatabaseHost) error {
	db, err := e.open(host, "")
	if err != nil {
		return err
	}
	defer db.Close()

	pingCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	return db.PingContext(pingCtx)
}

func (e *DriverSQLExecutor) open(host *DatabaseHost, dbName string) (*sql.DB, error) {
	switch host.Type {
	case DatabaseTypePostgres:
		targetDB := "postgres"
		if dbName != "" {
			targetDB = dbName
		}
		dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable&connect_timeout=10",
			url.QueryEscape(host.AdminUsername),
			url.QueryEscape(host.AdminPassword),
			host.Host,
			host.Port,
			targetDB,
		)
		return sql.Open("postgres", dsn)

	case DatabaseTypeMariaDB, DatabaseTypeMySQL:
		fallthrough
	default:
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?timeout=10s",
			host.AdminUsername,
			host.AdminPassword,
			host.Host,
			host.Port,
			dbName,
		)
		return sql.Open("mysql", dsn)
	}
}

// MockSQLExecutor provides an in-memory recorder of executed statements for testing.
type MockSQLExecutor struct {
	mu            sync.RWMutex
	ExecutedSQL   []string
	HostCalls     map[string][]string
	FailOnIndex   int
	FailError     error
	PingError     error
	statementCount int
}

// NewMockSQLExecutor creates a new MockSQLExecutor.
func NewMockSQLExecutor() *MockSQLExecutor {
	return &MockSQLExecutor{
		ExecutedSQL: make([]string, 0),
		HostCalls:   make(map[string][]string),
		FailOnIndex: -1,
	}
}

func (m *MockSQLExecutor) Execute(ctx context.Context, host *DatabaseHost, statements []string) error {
	return m.ExecuteOnDB(ctx, host, "", statements)
}

func (m *MockSQLExecutor) ExecuteOnDB(ctx context.Context, host *DatabaseHost, dbName string, statements []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, stmt := range statements {
		if stmt == "" {
			continue
		}
		m.statementCount++
		if m.FailOnIndex >= 0 && m.statementCount == m.FailOnIndex && m.FailError != nil {
			return m.FailError
		}

		m.ExecutedSQL = append(m.ExecutedSQL, stmt)
		m.HostCalls[host.ID] = append(m.HostCalls[host.ID], stmt)
	}
	return nil
}

func (m *MockSQLExecutor) Ping(ctx context.Context, host *DatabaseHost) error {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.PingError
}

func (m *MockSQLExecutor) GetExecuted() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]string, len(m.ExecutedSQL))
	copy(res, m.ExecutedSQL)
	return res
}

func (m *MockSQLExecutor) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ExecutedSQL = make([]string, 0)
	m.HostCalls = make(map[string][]string)
	m.statementCount = 0
	m.FailOnIndex = -1
	m.FailError = nil
	m.PingError = nil
}
