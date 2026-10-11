package databasemgr

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// DatabaseRepository defines persistence operations for ServerDatabase records.
type DatabaseRepository interface {
	Save(ctx context.Context, db *ServerDatabase) error
	Get(ctx context.Context, id string) (*ServerDatabase, error)
	FindByServerAndName(ctx context.Context, serverID, dbName string) (*ServerDatabase, error)
	ListByServer(ctx context.Context, serverID string) ([]*ServerDatabase, error)
	Delete(ctx context.Context, id string) error
	UpdatePassword(ctx context.Context, id, newPassword string) error
}

// MemoryDatabaseRepository provides a thread-safe in-memory DatabaseRepository.
type MemoryDatabaseRepository struct {
	mu        sync.RWMutex
	databases map[string]*ServerDatabase
}

// NewMemoryDatabaseRepository creates an initialized MemoryDatabaseRepository.
func NewMemoryDatabaseRepository() *MemoryDatabaseRepository {
	return &MemoryDatabaseRepository{
		databases: make(map[string]*ServerDatabase),
	}
}

func (r *MemoryDatabaseRepository) Save(ctx context.Context, db *ServerDatabase) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	if db.CreatedAt.IsZero() {
		db.CreatedAt = now
	}
	db.UpdatedAt = now

	cloned := cloneDatabase(db)
	r.databases[cloned.ID] = cloned
	return nil
}

func (r *MemoryDatabaseRepository) Get(ctx context.Context, id string) (*ServerDatabase, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	db, ok := r.databases[id]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrDatabaseNotFound, id)
	}
	return cloneDatabase(db), nil
}

func (r *MemoryDatabaseRepository) FindByServerAndName(ctx context.Context, serverID, dbName string) (*ServerDatabase, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, db := range r.databases {
		if db.ServerID == serverID && db.Database == dbName {
			return cloneDatabase(db), nil
		}
	}
	return nil, nil
}

func (r *MemoryDatabaseRepository) ListByServer(ctx context.Context, serverID string) ([]*ServerDatabase, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var res []*ServerDatabase
	for _, db := range r.databases {
		if db.ServerID == serverID {
			res = append(res, cloneDatabase(db))
		}
	}
	return res, nil
}

func (r *MemoryDatabaseRepository) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.databases[id]; !ok {
		return fmt.Errorf("%w: %s", ErrDatabaseNotFound, id)
	}
	delete(r.databases, id)
	return nil
}

func (r *MemoryDatabaseRepository) UpdatePassword(ctx context.Context, id, newPassword string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	db, ok := r.databases[id]
	if !ok {
		return fmt.Errorf("%w: %s", ErrDatabaseNotFound, id)
	}
	db.Password = newPassword
	db.UpdatedAt = time.Now()
	return nil
}

// ProvisionManager coordinates end-to-end database provisioning, password generation,
// host selection, and transactional rollback on remote host errors.
type ProvisionManager struct {
	dbRepo       DatabaseRepository
	hostRepo     HostRepository
	hostSelector HostSelector
	executor     SQLExecutor
	passGen      *PasswordGenerator
}

// NewProvisionManager creates an initialized ProvisionManager.
func NewProvisionManager(
	dbRepo DatabaseRepository,
	hostRepo HostRepository,
	hostSelector HostSelector,
	executor SQLExecutor,
	passGen ...*PasswordGenerator,
) *ProvisionManager {
	pg := NewPasswordGenerator()
	if len(passGen) > 0 && passGen[0] != nil {
		pg = passGen[0]
	}
	return &ProvisionManager{
		dbRepo:       dbRepo,
		hostRepo:     hostRepo,
		hostSelector: hostSelector,
		executor:     executor,
		passGen:      pg,
	}
}

// Provision handles the complete automated provisioning workflow:
// host selection -> identifier formatting -> secure credentials -> DDL execution -> rollback on failure.
func (m *ProvisionManager) Provision(ctx context.Context, req ProvisionRequest) (*ServerDatabase, error) {
	if strings.TrimSpace(req.ServerID) == "" {
		return nil, fmt.Errorf("server_id is required")
	}

	// 1. Format and sanitize database name
	dbName, err := m.passGen.GenerateDatabaseName(req.ServerID, req.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to format database name: %w", err)
	}

	// 2. Prevent duplicate database names for the same server
	existing, err := m.dbRepo.FindByServerAndName(ctx, req.ServerID, dbName)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("%w: %s", ErrDatabaseAlreadyExists, dbName)
	}

	// 3. Select optimal database host
	criteria := SelectionCriteria{
		ServerID:        req.ServerID,
		NodeID:          req.NodeID,
		Type:            req.Type,
		RequestedHostID: req.HostID,
	}
	host, err := m.hostSelector.SelectHost(ctx, criteria)
	if err != nil {
		return nil, fmt.Errorf("host selection failed: %w", err)
	}

	// 4. Generate secure username
	username, err := m.passGen.GenerateDatabaseUsername(req.ServerID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate username: %w", err)
	}

	// 5. Generate or validate password
	password := req.CustomPassword
	if password == "" {
		pwLen := req.PasswordLength
		if pwLen <= 0 {
			pwLen = DefaultPasswordLength
		}
		password, err = m.passGen.Generate(pwLen)
		if err != nil {
			return nil, fmt.Errorf("failed to generate password: %w", err)
		}
	} else {
		if err := m.passGen.ValidateStrength(password); err != nil {
			return nil, fmt.Errorf("invalid custom password: %w", err)
		}
	}

	remoteHost := defaultRemote(req.Remote, "%")
	dialect := GetDialect(host.Type)

	// 6. Build statements according to dialect
	var statements []string
	switch host.Type {
	case DatabaseTypePostgres:
		// Postgres creates user first, then creates database owned by user, then grants privileges
		statements = append(statements, dialect.CreateUserStatements(username, remoteHost, password, req.MaxConnections)...)
		statements = append(statements, dialect.CreateDatabaseStatements(dbName, username)...)
		statements = append(statements, dialect.GrantPrivilegesStatements(dbName, username, remoteHost)...)
	case DatabaseTypeMariaDB, DatabaseTypeMySQL:
		fallthrough
	default:
		// MySQL creates database, then creates user, then grants privileges, flushes
		statements = append(statements, dialect.CreateDatabaseStatements(dbName, username)...)
		statements = append(statements, dialect.CreateUserStatements(username, remoteHost, password, req.MaxConnections)...)
		statements = append(statements, dialect.GrantPrivilegesStatements(dbName, username, remoteHost)...)
	}

	// 7. Execute DDL on remote host with rollback on failure
	if err := m.executor.Execute(ctx, host, statements); err != nil {
		// Rollback attempt
		rollbackStmts := append(dialect.DropDatabaseStatements(dbName), dialect.DropUserStatements(username, remoteHost)...)
		_ = m.executor.Execute(ctx, host, rollbackStmts)
		return nil, fmt.Errorf("failed to execute provisioning statements on host %s (rolled back): %w", host.Host, err)
	}

	// 8. Create and persist record
	record := &ServerDatabase{
		ID:             uuid.New().String(),
		ServerID:       req.ServerID,
		DatabaseHostID: host.ID,
		Host:           cloneHost(host),
		Database:       dbName,
		Username:       username,
		Password:       password,
		Remote:         remoteHost,
		MaxConnections: req.MaxConnections,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := m.dbRepo.Save(ctx, record); err != nil {
		// Rollback remote host if metadata persistence fails
		rollbackStmts := append(dialect.DropDatabaseStatements(dbName), dialect.DropUserStatements(username, remoteHost)...)
		_ = m.executor.Execute(ctx, host, rollbackStmts)
		return nil, fmt.Errorf("failed to save database record (rolled back): %w", err)
	}

	// 9. Update host utilization
	_ = m.hostRepo.IncrementDatabaseCount(ctx, host.ID)

	return record, nil
}

// Deprovision removes a database and user from the remote host and deletes the database record.
func (m *ProvisionManager) Deprovision(ctx context.Context, databaseID string) error {
	db, err := m.dbRepo.Get(ctx, databaseID)
	if err != nil {
		return err
	}

	host, err := m.hostRepo.Get(ctx, db.DatabaseHostID)
	if err != nil {
		return fmt.Errorf("failed to find associated host %q: %w", db.DatabaseHostID, err)
	}

	dialect := GetDialect(host.Type)
	dropStmts := append(dialect.DropDatabaseStatements(db.Database), dialect.DropUserStatements(db.Username, db.Remote)...)

	if err := m.executor.Execute(ctx, host, dropStmts); err != nil {
		return fmt.Errorf("failed to drop database/user on host %s: %w", host.Host, err)
	}

	if err := m.dbRepo.Delete(ctx, databaseID); err != nil {
		return fmt.Errorf("failed to delete database record: %w", err)
	}

	_ = m.hostRepo.DecrementDatabaseCount(ctx, host.ID)
	return nil
}

// RotatePassword generates a new secure password, updates the remote host, and saves the new credential.
func (m *ProvisionManager) RotatePassword(ctx context.Context, databaseID string) (string, error) {
	db, err := m.dbRepo.Get(ctx, databaseID)
	if err != nil {
		return "", err
	}

	host, err := m.hostRepo.Get(ctx, db.DatabaseHostID)
	if err != nil {
		return "", fmt.Errorf("failed to find associated host %q: %w", db.DatabaseHostID, err)
	}

	newPassword, err := m.passGen.Generate(DefaultPasswordLength)
	if err != nil {
		return "", fmt.Errorf("failed to generate new password: %w", err)
	}

	dialect := GetDialect(host.Type)
	stmts := dialect.ChangePasswordStatements(db.Username, db.Remote, newPassword)

	if err := m.executor.Execute(ctx, host, stmts); err != nil {
		return "", fmt.Errorf("failed to update user password on host %s: %w", host.Host, err)
	}

	if err := m.dbRepo.UpdatePassword(ctx, databaseID, newPassword); err != nil {
		return "", fmt.Errorf("failed to update password in repository: %w", err)
	}

	return newPassword, nil
}

// ResetPrivileges reapplies the dialect's grant statements for the user.
func (m *ProvisionManager) ResetPrivileges(ctx context.Context, databaseID string) error {
	db, err := m.dbRepo.Get(ctx, databaseID)
	if err != nil {
		return err
	}

	host, err := m.hostRepo.Get(ctx, db.DatabaseHostID)
	if err != nil {
		return fmt.Errorf("failed to find associated host: %w", err)
	}

	dialect := GetDialect(host.Type)
	stmts := dialect.GrantPrivilegesStatements(db.Database, db.Username, db.Remote)

	return m.executor.Execute(ctx, host, stmts)
}

// GetDatabase retrieves a provisioned database by ID.
func (m *ProvisionManager) GetDatabase(ctx context.Context, databaseID string) (*ServerDatabase, error) {
	return m.dbRepo.Get(ctx, databaseID)
}

// ListDatabases lists all databases provisioned for a server.
func (m *ProvisionManager) ListDatabases(ctx context.Context, serverID string) ([]*ServerDatabase, error) {
	return m.dbRepo.ListByServer(ctx, serverID)
}

func cloneDatabase(db *ServerDatabase) *ServerDatabase {
	dst := *db
	if db.Host != nil {
		dst.Host = cloneHost(db.Host)
	}
	return &dst
}
