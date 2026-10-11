package databasemgr_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/pteronext/panel-core/pkg/databasemgr"
)

func TestPasswordGenerator_SecurityAndEntropy(t *testing.T) {
	gen := databasemgr.NewPasswordGenerator()

	// Test generation and entropy
	passwords := make(map[string]bool)
	for i := 0; i < 50; i++ {
		pw, err := gen.Generate(24)
		if err != nil {
			t.Fatalf("Generate() failed: %v", err)
		}
		if len(pw) != 24 {
			t.Fatalf("Expected length 24, got %d", len(pw))
		}
		if passwords[pw] {
			t.Fatalf("Duplicate password generated: %s", pw)
		}
		passwords[pw] = true

		if err := gen.ValidateStrength(pw); err != nil {
			t.Fatalf("ValidateStrength failed for generated password %q: %v", pw, err)
		}
	}

	// Test short password fallback
	shortPw, err := gen.Generate(5)
	if err != nil {
		t.Fatalf("Generate(5) failed: %v", err)
	}
	if len(shortPw) < databasemgr.MinPasswordLength {
		t.Fatalf("Generate(5) should fallback to at least min length, got %d", len(shortPw))
	}
}

func TestPasswordGenerator_IdentifierFormattingAndSafety(t *testing.T) {
	gen := databasemgr.NewPasswordGenerator()

	// Format DB Name
	dbName, err := gen.GenerateDatabaseName("42", "luckperms")
	if err != nil {
		t.Fatalf("GenerateDatabaseName failed: %v", err)
	}
	if dbName != "s42_luckperms" {
		t.Fatalf("Expected s42_luckperms, got %s", dbName)
	}

	// Sanitizes special characters
	dbSanitized, err := gen.GenerateDatabaseName("42", "my-plugin.db")
	if err != nil {
		t.Fatalf("GenerateDatabaseName with special chars failed: %v", err)
	}
	if strings.ContainsAny(dbSanitized, "-.") {
		t.Fatalf("Database name should sanitize special chars, got %s", dbSanitized)
	}

	// Reject SQL injection attempts in identifier
	err = databasemgr.ValidateIdentifier("s42_db; DROP TABLE users;--")
	if err == nil {
		t.Fatalf("Expected error for SQL injection identifier, got nil")
	}

	// Username generation
	user, err := gen.GenerateDatabaseUsername("42")
	if err != nil {
		t.Fatalf("GenerateDatabaseUsername failed: %v", err)
	}
	if !strings.HasPrefix(user, "u42_") || len(user) != 12 {
		t.Fatalf("Unexpected username format: %s", user)
	}
}

func TestDialects_SQLGeneration(t *testing.T) {
	// MySQL Dialect
	mysqlDialect := databasemgr.GetDialect(databasemgr.DatabaseTypeMySQL)
	userStmts := mysqlDialect.CreateUserStatements("u42_abc", "%", "secret123", 10)
	if len(userStmts) != 1 || !strings.Contains(userStmts[0], "WITH MAX_USER_CONNECTIONS 10") {
		t.Fatalf("Unexpected MySQL user stmt: %v", userStmts)
	}

	dbStmts := mysqlDialect.CreateDatabaseStatements("s42_db", "u42_abc")
	if len(dbStmts) != 1 || !strings.Contains(dbStmts[0], "CREATE DATABASE IF NOT EXISTS `s42_db`") {
		t.Fatalf("Unexpected MySQL db stmt: %v", dbStmts)
	}

	grantStmts := mysqlDialect.GrantPrivilegesStatements("s42_db", "u42_abc", "%")
	if len(grantStmts) != 2 || !strings.Contains(grantStmts[0], "GRANT SELECT, INSERT") || grantStmts[1] != "FLUSH PRIVILEGES" {
		t.Fatalf("Unexpected MySQL grant stmts: %v", grantStmts)
	}

	// Postgres Dialect
	pgDialect := databasemgr.GetDialect(databasemgr.DatabaseTypePostgres)
	pgUserStmts := pgDialect.CreateUserStatements("u42_abc", "%", "secret123", 5)
	if len(pgUserStmts) != 1 || !strings.Contains(pgUserStmts[0], `CREATE USER "u42_abc" WITH ENCRYPTED PASSWORD 'secret123' CONNECTION LIMIT 5`) {
		t.Fatalf("Unexpected Postgres user stmt: %v", pgUserStmts)
	}

	pgDbStmts := pgDialect.CreateDatabaseStatements("s42_db", "u42_abc")
	if len(pgDbStmts) != 1 || !strings.Contains(pgDbStmts[0], `CREATE DATABASE "s42_db" WITH OWNER "u42_abc" ENCODING 'UTF8'`) {
		t.Fatalf("Unexpected Postgres db stmt: %v", pgDbStmts)
	}

	pgGrantStmts := pgDialect.GrantPrivilegesStatements("s42_db", "u42_abc", "%")
	if len(pgGrantStmts) != 1 || !strings.Contains(pgGrantStmts[0], `GRANT ALL PRIVILEGES ON DATABASE "s42_db" TO "u42_abc"`) {
		t.Fatalf("Unexpected Postgres grant stmt: %v", pgGrantStmts)
	}
}

func TestHostSelector_AffinityAndCapacity(t *testing.T) {
	ctx := context.Background()
	hostRepo := databasemgr.NewMemoryHostRepository()
	selector := databasemgr.NewDefaultHostSelector(hostRepo)

	// Setup hosts
	host1 := &databasemgr.DatabaseHost{
		ID:               "host-1",
		Name:             "Node 1 Local MySQL",
		Type:             databasemgr.DatabaseTypeMySQL,
		Host:             "10.0.0.1",
		Port:             3306,
		NodeAffinity:     []string{"node-1"},
		MaxDatabases:     10,
		CurrentDatabases: 5,
		IsActive:         true,
	}
	host2 := &databasemgr.DatabaseHost{
		ID:               "host-2",
		Name:             "General MySQL",
		Type:             databasemgr.DatabaseTypeMySQL,
		Host:             "10.0.0.2",
		Port:             3306,
		NodeAffinity:     []string{"node-2"},
		MaxDatabases:     10,
		CurrentDatabases: 2,
		IsActive:         true,
	}
	host3Full := &databasemgr.DatabaseHost{
		ID:               "host-3",
		Name:             "Full MySQL",
		Type:             databasemgr.DatabaseTypeMySQL,
		Host:             "10.0.0.3",
		Port:             3306,
		MaxDatabases:     5,
		CurrentDatabases: 5,
		IsActive:         true,
	}

	_ = hostRepo.Save(ctx, host1)
	_ = hostRepo.Save(ctx, host2)
	_ = hostRepo.Save(ctx, host3Full)

	// Case 1: Match node affinity (even though host1 has more load than host2, node affinity takes priority)
	selected, err := selector.SelectHost(ctx, databasemgr.SelectionCriteria{
		ServerID: "srv-1",
		NodeID:   "node-1",
		Type:     databasemgr.DatabaseTypeMySQL,
	})
	if err != nil {
		t.Fatalf("SelectHost() failed: %v", err)
	}
	if selected.ID != "host-1" {
		t.Fatalf("Expected host-1 due to node affinity, got %s", selected.ID)
	}

	// Case 2: No node affinity match -> select least loaded (host2 has 2 vs host1 has 5)
	selectedLeastLoaded, err := selector.SelectHost(ctx, databasemgr.SelectionCriteria{
		ServerID: "srv-2",
		NodeID:   "node-unrelated",
		Type:     databasemgr.DatabaseTypeMySQL,
	})
	if err != nil {
		t.Fatalf("SelectHost() failed: %v", err)
	}
	if selectedLeastLoaded.ID != "host-2" {
		t.Fatalf("Expected host-2 due to lowest load, got %s", selectedLeastLoaded.ID)
	}

	// Case 3: Explicit host that is at capacity
	_, err = selector.SelectHost(ctx, databasemgr.SelectionCriteria{
		RequestedHostID: "host-3",
	})
	if err == nil || !errors.Is(err, databasemgr.ErrHostAtCapacity) {
		t.Fatalf("Expected ErrHostAtCapacity for host-3, got %v", err)
	}
}

func TestProvisionManager_MySQLWorkflow(t *testing.T) {
	ctx := context.Background()
	dbRepo := databasemgr.NewMemoryDatabaseRepository()
	hostRepo := databasemgr.NewMemoryHostRepository()
	mockSQL := databasemgr.NewMockSQLExecutor()
	selector := databasemgr.NewDefaultHostSelector(hostRepo)
	mgr := databasemgr.NewProvisionManager(dbRepo, hostRepo, selector, mockSQL)

	host := &databasemgr.DatabaseHost{
		ID:               "mysql-host-1",
		Name:             "Main DB",
		Type:             databasemgr.DatabaseTypeMySQL,
		Host:             "127.0.0.1",
		Port:             3306,
		AdminUsername:    "root",
		AdminPassword:    "password",
		MaxDatabases:     10,
		CurrentDatabases: 0,
		IsActive:         true,
	}
	_ = hostRepo.Save(ctx, host)

	// 1. Provision
	db, err := mgr.Provision(ctx, databasemgr.ProvisionRequest{
		ServerID:       "15",
		Name:           "essentials",
		MaxConnections: 5,
	})
	if err != nil {
		t.Fatalf("Provision() failed: %v", err)
	}

	if db.Database != "s15_essentials" {
		t.Fatalf("Expected s15_essentials, got %s", db.Database)
	}
	if !strings.HasPrefix(db.Username, "u15_") {
		t.Fatalf("Expected username prefix u15_, got %s", db.Username)
	}

	// Verify SQL executed
	executed := mockSQL.GetExecuted()
	if len(executed) < 3 {
		t.Fatalf("Expected at least 3 statements executed, got %d: %v", len(executed), executed)
	}

	// Verify host database count incremented
	updatedHost, _ := hostRepo.Get(ctx, host.ID)
	if updatedHost.CurrentDatabases != 1 {
		t.Fatalf("Expected host database count 1, got %d", updatedHost.CurrentDatabases)
	}

	// 2. Rotate Password
	oldPassword := db.Password
	newPassword, err := mgr.RotatePassword(ctx, db.ID)
	if err != nil {
		t.Fatalf("RotatePassword() failed: %v", err)
	}
	if newPassword == oldPassword {
		t.Fatalf("New password should differ from old password")
	}

	reloaded, _ := mgr.GetDatabase(ctx, db.ID)
	if reloaded.Password != newPassword {
		t.Fatalf("Database record password not updated after rotation")
	}

	// 3. Deprovision
	mockSQL.Reset()
	err = mgr.Deprovision(ctx, db.ID)
	if err != nil {
		t.Fatalf("Deprovision() failed: %v", err)
	}

	dropExecuted := mockSQL.GetExecuted()
	hasDropDB := false
	hasDropUser := false
	for _, stmt := range dropExecuted {
		if strings.Contains(stmt, "DROP DATABASE") {
			hasDropDB = true
		}
		if strings.Contains(stmt, "DROP USER") {
			hasDropUser = true
		}
	}
	if !hasDropDB || !hasDropUser {
		t.Fatalf("Expected DROP DATABASE and DROP USER executed: %v", dropExecuted)
	}

	// Verify record deleted
	_, err = mgr.GetDatabase(ctx, db.ID)
	if err == nil || !errors.Is(err, databasemgr.ErrDatabaseNotFound) {
		t.Fatalf("Expected ErrDatabaseNotFound after deprovision, got %v", err)
	}

	// Verify host count decremented
	updatedHost, _ = hostRepo.Get(ctx, host.ID)
	if updatedHost.CurrentDatabases != 0 {
		t.Fatalf("Expected host database count 0, got %d", updatedHost.CurrentDatabases)
	}
}

func TestProvisionManager_PostgresWorkflow(t *testing.T) {
	ctx := context.Background()
	dbRepo := databasemgr.NewMemoryDatabaseRepository()
	hostRepo := databasemgr.NewMemoryHostRepository()
	mockSQL := databasemgr.NewMockSQLExecutor()
	selector := databasemgr.NewDefaultHostSelector(hostRepo)
	mgr := databasemgr.NewProvisionManager(dbRepo, hostRepo, selector, mockSQL)

	host := &databasemgr.DatabaseHost{
		ID:               "pg-host-1",
		Name:             "Postgres DB",
		Type:             databasemgr.DatabaseTypePostgres,
		Host:             "postgres.internal",
		Port:             5432,
		AdminUsername:    "postgres",
		AdminPassword:    "password",
		MaxDatabases:     10,
		CurrentDatabases: 0,
		IsActive:         true,
	}
	_ = hostRepo.Save(ctx, host)

	// Provision PostgreSQL database
	db, err := mgr.Provision(ctx, databasemgr.ProvisionRequest{
		ServerID: "20",
		Name:     "stats",
		Type:     databasemgr.DatabaseTypePostgres,
	})
	if err != nil {
		t.Fatalf("Provision() Postgres failed: %v", err)
	}

	if db.Database != "s20_stats" {
		t.Fatalf("Expected s20_stats, got %s", db.Database)
	}

	executed := mockSQL.GetExecuted()
	hasCreateUser := false
	hasCreateDB := false
	hasGrant := false
	for _, stmt := range executed {
		if strings.Contains(stmt, "CREATE USER") && strings.Contains(stmt, "ENCRYPTED PASSWORD") {
			hasCreateUser = true
		}
		if strings.Contains(stmt, "CREATE DATABASE") && strings.Contains(stmt, "WITH OWNER") {
			hasCreateDB = true
		}
		if strings.Contains(stmt, "GRANT ALL PRIVILEGES ON DATABASE") {
			hasGrant = true
		}
	}

	if !hasCreateUser || !hasCreateDB || !hasGrant {
		t.Fatalf("Postgres DDL statements missing: %v", executed)
	}
}

func TestProvisionManager_RollbackOnFailure(t *testing.T) {
	ctx := context.Background()
	dbRepo := databasemgr.NewMemoryDatabaseRepository()
	hostRepo := databasemgr.NewMemoryHostRepository()
	mockSQL := databasemgr.NewMockSQLExecutor()
	selector := databasemgr.NewDefaultHostSelector(hostRepo)
	mgr := databasemgr.NewProvisionManager(dbRepo, hostRepo, selector, mockSQL)

	host := &databasemgr.DatabaseHost{
		ID:               "mysql-rollback",
		Name:             "Rollback Host",
		Type:             databasemgr.DatabaseTypeMySQL,
		Host:             "10.0.0.5",
		Port:             3306,
		MaxDatabases:     10,
		CurrentDatabases: 0,
		IsActive:         true,
	}
	_ = hostRepo.Save(ctx, host)

	// Simulate error on the 3rd statement (the grant statement)
	mockSQL.FailOnIndex = 3
	mockSQL.FailError = errors.New("simulated grant permission denied")

	_, err := mgr.Provision(ctx, databasemgr.ProvisionRequest{
		ServerID: "99",
		Name:     "testrollback",
	})
	if err == nil {
		t.Fatalf("Expected provisioning to fail, got nil")
	}

	if !strings.Contains(err.Error(), "rolled back") {
		t.Fatalf("Expected rollback notification in error, got: %v", err)
	}

	// Verify rollback statements were executed (DROP DATABASE and DROP USER)
	executed := mockSQL.GetExecuted()
	hasDropDB := false
	hasDropUser := false
	for _, stmt := range executed {
		if strings.Contains(stmt, "DROP DATABASE") {
			hasDropDB = true
		}
		if strings.Contains(stmt, "DROP USER") {
			hasDropUser = true
		}
	}

	if !hasDropDB || !hasDropUser {
		t.Fatalf("Rollback did not execute DROP statements: %v", executed)
	}

	// Verify no database record was stored in repository
	dbs, err := mgr.ListDatabases(ctx, "99")
	if err != nil || len(dbs) != 0 {
		t.Fatalf("Database record should not be saved after rollback, found: %v", dbs)
	}

	// Verify host count was NOT incremented
	h, _ := hostRepo.Get(ctx, host.ID)
	if h.CurrentDatabases != 0 {
		t.Fatalf("Host database count should remain 0, got %d", h.CurrentDatabases)
	}
}
