package databasemgr

import (
	"fmt"
	"strings"
)

// Dialect defines the statement generation interface for different SQL engines.
type Dialect interface {
	Type() DatabaseType
	CreateUserStatements(username, remote, password string, maxConns int) []string
	CreateDatabaseStatements(dbName, owner string) []string
	GrantPrivilegesStatements(dbName, username, remote string) []string
	RevokePrivilegesStatements(dbName, username, remote string) []string
	ChangePasswordStatements(username, remote, newPassword string) []string
	DropDatabaseStatements(dbName string) []string
	DropUserStatements(username, remote string) []string
	FlushStatements() []string
}

// GetDialect returns the appropriate dialect implementation for the given database type.
func GetDialect(dbType DatabaseType) Dialect {
	switch dbType {
	case DatabaseTypePostgres:
		return &PostgresDialect{}
	case DatabaseTypeMariaDB, DatabaseTypeMySQL:
		fallthrough
	default:
		return &MySQLDialect{}
	}
}

// MySQLDialect implements Dialect for MySQL and MariaDB databases.
type MySQLDialect struct{}

func (d *MySQLDialect) Type() DatabaseType {
	return DatabaseTypeMySQL
}

func (d *MySQLDialect) CreateUserStatements(username, remote, password string, maxConns int) []string {
	remoteHost := defaultRemote(remote, "%")
	escapedPass := escapeSQLString(password)

	var stmt string
	if maxConns > 0 {
		stmt = fmt.Sprintf("CREATE USER IF NOT EXISTS '%s'@'%s' IDENTIFIED BY '%s' WITH MAX_USER_CONNECTIONS %d", username, remoteHost, escapedPass, maxConns)
	} else {
		stmt = fmt.Sprintf("CREATE USER IF NOT EXISTS '%s'@'%s' IDENTIFIED BY '%s'", username, remoteHost, escapedPass)
	}
	return []string{stmt}
}

func (d *MySQLDialect) CreateDatabaseStatements(dbName, owner string) []string {
	return []string{
		fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbName),
	}
}

func (d *MySQLDialect) GrantPrivilegesStatements(dbName, username, remote string) []string {
	remoteHost := defaultRemote(remote, "%")
	return []string{
		fmt.Sprintf("GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, REFERENCES, INDEX, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, CREATE TEMPORARY TABLES, CREATE VIEW, SHOW VIEW, EVENT, TRIGGER ON `%s`.* TO '%s'@'%s'", dbName, username, remoteHost),
		"FLUSH PRIVILEGES",
	}
}

func (d *MySQLDialect) RevokePrivilegesStatements(dbName, username, remote string) []string {
	remoteHost := defaultRemote(remote, "%")
	return []string{
		fmt.Sprintf("REVOKE ALL PRIVILEGES, GRANT OPTION FROM '%s'@'%s'", username, remoteHost),
		"FLUSH PRIVILEGES",
	}
}

func (d *MySQLDialect) ChangePasswordStatements(username, remote, newPassword string) []string {
	remoteHost := defaultRemote(remote, "%")
	escapedPass := escapeSQLString(newPassword)
	return []string{
		fmt.Sprintf("ALTER USER '%s'@'%s' IDENTIFIED BY '%s'", username, remoteHost, escapedPass),
		"FLUSH PRIVILEGES",
	}
}

func (d *MySQLDialect) DropDatabaseStatements(dbName string) []string {
	return []string{
		fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", dbName),
	}
}

func (d *MySQLDialect) DropUserStatements(username, remote string) []string {
	remoteHost := defaultRemote(remote, "%")
	return []string{
		fmt.Sprintf("DROP USER IF EXISTS '%s'@'%s'", username, remoteHost),
		"FLUSH PRIVILEGES",
	}
}

func (d *MySQLDialect) FlushStatements() []string {
	return []string{"FLUSH PRIVILEGES"}
}

// PostgresDialect implements Dialect for PostgreSQL databases.
type PostgresDialect struct{}

func (d *PostgresDialect) Type() DatabaseType {
	return DatabaseTypePostgres
}

func (d *PostgresDialect) CreateUserStatements(username, remote, password string, maxConns int) []string {
	escapedPass := escapeSQLString(password)
	var stmt string
	if maxConns > 0 {
		stmt = fmt.Sprintf(`CREATE USER "%s" WITH ENCRYPTED PASSWORD '%s' CONNECTION LIMIT %d`, username, escapedPass, maxConns)
	} else {
		stmt = fmt.Sprintf(`CREATE USER "%s" WITH ENCRYPTED PASSWORD '%s'`, username, escapedPass)
	}
	return []string{stmt}
}

func (d *PostgresDialect) CreateDatabaseStatements(dbName, owner string) []string {
	return []string{
		fmt.Sprintf(`CREATE DATABASE "%s" WITH OWNER "%s" ENCODING 'UTF8'`, dbName, owner),
	}
}

func (d *PostgresDialect) GrantPrivilegesStatements(dbName, username, remote string) []string {
	return []string{
		fmt.Sprintf(`GRANT ALL PRIVILEGES ON DATABASE "%s" TO "%s"`, dbName, username),
	}
}

func (d *PostgresDialect) RevokePrivilegesStatements(dbName, username, remote string) []string {
	return []string{
		fmt.Sprintf(`REVOKE ALL PRIVILEGES ON DATABASE "%s" FROM "%s"`, dbName, username),
	}
}

func (d *PostgresDialect) ChangePasswordStatements(username, remote, newPassword string) []string {
	escapedPass := escapeSQLString(newPassword)
	return []string{
		fmt.Sprintf(`ALTER USER "%s" WITH ENCRYPTED PASSWORD '%s'`, username, escapedPass),
	}
}

func (d *PostgresDialect) DropDatabaseStatements(dbName string) []string {
	return []string{
		fmt.Sprintf(`DROP DATABASE IF EXISTS "%s"`, dbName),
	}
}

func (d *PostgresDialect) DropUserStatements(username, remote string) []string {
	return []string{
		fmt.Sprintf(`DROP USER IF EXISTS "%s"`, username),
	}
}

func (d *PostgresDialect) FlushStatements() []string {
	return []string{} // Not required in PostgreSQL
}

func defaultRemote(val, def string) string {
	trimmed := strings.TrimSpace(val)
	if trimmed == "" {
		return def
	}
	return trimmed
}

func escapeSQLString(val string) string {
	return strings.ReplaceAll(val, "'", "''")
}
