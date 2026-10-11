package security

import (
	"fmt"
	"strings"
	"sync"
)

// Permission represents a granular access permission identifier.
type Permission string

// String returns the string representation of the permission.
func (p Permission) String() string {
	return string(p)
}

// Global Wildcard
const (
	PermissionAll Permission = "*"
)

// Server Permissions
const (
	// Wildcard for all server permissions
	PermissionServerAll Permission = "server.*"

	// Power actions
	PermissionServerPower        Permission = "server.power"
	PermissionServerPowerStart   Permission = "server.power.start"
	PermissionServerPowerStop    Permission = "server.power.stop"
	PermissionServerPowerRestart Permission = "server.power.restart"
	PermissionServerPowerKill    Permission = "server.power.kill"

	// Console
	PermissionServerConsoleRead  Permission = "server.console.read"
	PermissionServerConsoleWrite Permission = "server.console.write"

	// Files
	PermissionServerFilesRead        Permission = "server.files.read"
	PermissionServerFilesReadContent Permission = "server.files.read-content"
	PermissionServerFilesWrite       Permission = "server.files.write"
	PermissionServerFilesCreate      Permission = "server.files.create"
	PermissionServerFilesDelete      Permission = "server.files.delete"
	PermissionServerFilesArchive     Permission = "server.files.archive"
	PermissionServerFilesSFTP        Permission = "server.files.sftp"

	// Database
	PermissionServerDatabaseRead         Permission = "server.database.read"
	PermissionServerDatabaseCreate       Permission = "server.database.create"
	PermissionServerDatabaseUpdate       Permission = "server.database.update"
	PermissionServerDatabaseDelete       Permission = "server.database.delete"
	PermissionServerDatabaseViewPassword Permission = "server.database.view_password"

	// Schedules
	PermissionServerSchedulesManage Permission = "server.schedules.manage"
	PermissionServerSchedulesRead   Permission = "server.schedules.read"
	PermissionServerSchedulesCreate Permission = "server.schedules.create"
	PermissionServerSchedulesUpdate Permission = "server.schedules.update"
	PermissionServerSchedulesDelete Permission = "server.schedules.delete"

	// Backups
	PermissionServerBackupsRead     Permission = "server.backups.read"
	PermissionServerBackupsCreate   Permission = "server.backups.create"
	PermissionServerBackupsDelete   Permission = "server.backups.delete"
	PermissionServerBackupsDownload Permission = "server.backups.download"
	PermissionServerBackupsRestore  Permission = "server.backups.restore"

	// Subusers / Server Users
	PermissionServerUsersManage Permission = "server.users.manage"
	PermissionServerUsersRead   Permission = "server.users.read"
	PermissionServerUsersCreate Permission = "server.users.create"
	PermissionServerUsersUpdate Permission = "server.users.update"
	PermissionServerUsersDelete Permission = "server.users.delete"

	// Allocations
	PermissionServerAllocationsManage Permission = "server.allocations.manage"
	PermissionServerAllocationsRead   Permission = "server.allocations.read"
	PermissionServerAllocationsCreate Permission = "server.allocations.create"
	PermissionServerAllocationsUpdate Permission = "server.allocations.update"
	PermissionServerAllocationsDelete Permission = "server.allocations.delete"

	// Startup configuration
	PermissionServerStartupRead        Permission = "server.startup.read"
	PermissionServerStartupUpdate      Permission = "server.startup.update"
	PermissionServerStartupDockerImage Permission = "server.startup.docker-image"

	// Settings
	PermissionServerSettingsRename    Permission = "server.settings.rename"
	PermissionServerSettingsReinstall Permission = "server.settings.reinstall"

	// Activity
	PermissionServerActivityRead Permission = "server.activity.read"
)

// Administrative Permissions
const (
	// Wildcard for all administrative permissions
	PermissionAdminAll Permission = "admin.*"

	// Node management
	PermissionAdminNodes       Permission = "admin.nodes"
	PermissionAdminNodesRead   Permission = "admin.nodes.read"
	PermissionAdminNodesWrite  Permission = "admin.nodes.write"
	PermissionAdminNodesDelete Permission = "admin.nodes.delete"

	// User management
	PermissionAdminUsers       Permission = "admin.users"
	PermissionAdminUsersRead   Permission = "admin.users.read"
	PermissionAdminUsersWrite  Permission = "admin.users.write"
	PermissionAdminUsersDelete Permission = "admin.users.delete"

	// Server management (fleet-wide)
	PermissionAdminServers       Permission = "admin.servers"
	PermissionAdminServersRead   Permission = "admin.servers.read"
	PermissionAdminServersCreate Permission = "admin.servers.create"
	PermissionAdminServersUpdate Permission = "admin.servers.update"
	PermissionAdminServersDelete Permission = "admin.servers.delete"

	// Database hosts management
	PermissionAdminDatabases      Permission = "admin.databases"
	PermissionAdminDatabasesRead  Permission = "admin.databases.read"
	PermissionAdminDatabasesWrite Permission = "admin.databases.write"

	// Mounts & Nests & Locations
	PermissionAdminMounts    Permission = "admin.mounts"
	PermissionAdminNests     Permission = "admin.nests"
	PermissionAdminLocations Permission = "admin.locations"

	// System settings & Audit logs
	PermissionAdminSettings Permission = "admin.settings"
	PermissionAdminAudit    Permission = "admin.audit"
)

// PermissionScope defines the context in which a permission operates.
type PermissionScope string

const (
	ScopeServer PermissionScope = "server"
	ScopeAdmin  PermissionScope = "admin"
	ScopeGlobal PermissionScope = "global"
)

// PermissionDescriptor holds detailed metadata about a permission.
type PermissionDescriptor struct {
	Permission  Permission      `json:"permission"`
	Scope       PermissionScope `json:"scope"`
	Category    string          `json:"category"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
}

// Registry manages defined permissions and metadata.
type Registry struct {
	mu          sync.RWMutex
	permissions map[Permission]PermissionDescriptor
}

var (
	defaultRegistry = NewRegistry()
)

// DefaultRegistry returns the singleton permission registry.
func DefaultRegistry() *Registry {
	return defaultRegistry
}

// NewRegistry creates a fresh permission registry with standard definitions.
func NewRegistry() *Registry {
	r := &Registry{
		permissions: make(map[Permission]PermissionDescriptor),
	}
	r.registerDefaults()
	return r
}

// Register adds a permission descriptor to the registry.
func (r *Registry) Register(desc PermissionDescriptor) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.permissions[desc.Permission] = desc
}

// Get returns the descriptor for a permission if registered.
func (r *Registry) Get(p Permission) (PermissionDescriptor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	d, ok := r.permissions[p]
	return d, ok
}

// Exists checks whether a permission is defined in the registry.
func (r *Registry) Exists(p Permission) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.permissions[p]
	return ok
}

// All returns a slice of all registered permission descriptors.
func (r *Registry) All() []PermissionDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]PermissionDescriptor, 0, len(r.permissions))
	for _, d := range r.permissions {
		list = append(list, d)
	}
	return list
}

// ByScope filters permissions by their operational scope.
func (r *Registry) ByScope(scope PermissionScope) []PermissionDescriptor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var list []PermissionDescriptor
	for _, d := range r.permissions {
		if d.Scope == scope {
			list = append(list, d)
		}
	}
	return list
}

func (r *Registry) registerDefaults() {
	// Global
	r.permissions[PermissionAll] = PermissionDescriptor{
		Permission:  PermissionAll,
		Scope:       ScopeGlobal,
		Category:    "Global",
		Name:        "Super Administrator",
		Description: "Unrestricted access across the entire panel and all servers.",
	}

	// Server Power
	r.permissions[PermissionServerAll] = PermissionDescriptor{
		Permission:  PermissionServerAll,
		Scope:       ScopeServer,
		Category:    "Server",
		Name:        "All Server Permissions",
		Description: "Wildcard granting all actions on a specific server.",
	}
	r.permissions[PermissionServerPower] = PermissionDescriptor{
		Permission:  PermissionServerPower,
		Scope:       ScopeServer,
		Category:    "Power",
		Name:        "Full Power Control",
		Description: "Allows full power state control (start, stop, restart, kill).",
	}
	r.permissions[PermissionServerPowerStart] = PermissionDescriptor{
		Permission:  PermissionServerPowerStart,
		Scope:       ScopeServer,
		Category:    "Power",
		Name:        "Start Server",
		Description: "Allows starting the server when offline.",
	}
	r.permissions[PermissionServerPowerStop] = PermissionDescriptor{
		Permission:  PermissionServerPowerStop,
		Scope:       ScopeServer,
		Category:    "Power",
		Name:        "Stop Server",
		Description: "Allows gracefully stopping the server.",
	}
	r.permissions[PermissionServerPowerRestart] = PermissionDescriptor{
		Permission:  PermissionServerPowerRestart,
		Scope:       ScopeServer,
		Category:    "Power",
		Name:        "Restart Server",
		Description: "Allows initiating a server reboot.",
	}
	r.permissions[PermissionServerPowerKill] = PermissionDescriptor{
		Permission:  PermissionServerPowerKill,
		Scope:       ScopeServer,
		Category:    "Power",
		Name:        "Kill Server",
		Description: "Allows immediately terminating the server process (SIGKILL).",
	}

	// Console
	r.permissions[PermissionServerConsoleRead] = PermissionDescriptor{
		Permission:  PermissionServerConsoleRead,
		Scope:       ScopeServer,
		Category:    "Console",
		Name:        "Read Console",
		Description: "Allows viewing live server console streams and logs.",
	}
	r.permissions[PermissionServerConsoleWrite] = PermissionDescriptor{
		Permission:  PermissionServerConsoleWrite,
		Scope:       ScopeServer,
		Category:    "Console",
		Name:        "Write to Console",
		Description: "Allows sending interactive commands via server console.",
	}

	// Files
	r.permissions[PermissionServerFilesRead] = PermissionDescriptor{
		Permission:  PermissionServerFilesRead,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "List Files",
		Description: "Allows listing files and directories.",
	}
	r.permissions[PermissionServerFilesReadContent] = PermissionDescriptor{
		Permission:  PermissionServerFilesReadContent,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "Read File Contents",
		Description: "Allows downloading and viewing file contents.",
	}
	r.permissions[PermissionServerFilesWrite] = PermissionDescriptor{
		Permission:  PermissionServerFilesWrite,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "Write Files",
		Description: "Allows creating, updating, and writing file contents.",
	}
	r.permissions[PermissionServerFilesCreate] = PermissionDescriptor{
		Permission:  PermissionServerFilesCreate,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "Create Files & Directories",
		Description: "Allows creating new files and directories.",
	}
	r.permissions[PermissionServerFilesDelete] = PermissionDescriptor{
		Permission:  PermissionServerFilesDelete,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "Delete Files",
		Description: "Allows removing files and directories.",
	}
	r.permissions[PermissionServerFilesArchive] = PermissionDescriptor{
		Permission:  PermissionServerFilesArchive,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "Archive Files",
		Description: "Allows compressing and decompressing archive files.",
	}
	r.permissions[PermissionServerFilesSFTP] = PermissionDescriptor{
		Permission:  PermissionServerFilesSFTP,
		Scope:       ScopeServer,
		Category:    "Files",
		Name:        "SFTP Access",
		Description: "Allows logging in via SFTP with authorized file permissions.",
	}

	// Databases
	r.permissions[PermissionServerDatabaseCreate] = PermissionDescriptor{
		Permission:  PermissionServerDatabaseCreate,
		Scope:       ScopeServer,
		Category:    "Database",
		Name:        "Create Databases",
		Description: "Allows creating databases on assigned database hosts.",
	}
	r.permissions[PermissionServerDatabaseRead] = PermissionDescriptor{
		Permission:  PermissionServerDatabaseRead,
		Scope:       ScopeServer,
		Category:    "Database",
		Name:        "View Databases",
		Description: "Allows viewing databases associated with this server.",
	}
	r.permissions[PermissionServerDatabaseUpdate] = PermissionDescriptor{
		Permission:  PermissionServerDatabaseUpdate,
		Scope:       ScopeServer,
		Category:    "Database",
		Name:        "Rotate DB Passwords",
		Description: "Allows rotating credentials for server databases.",
	}
	r.permissions[PermissionServerDatabaseDelete] = PermissionDescriptor{
		Permission:  PermissionServerDatabaseDelete,
		Scope:       ScopeServer,
		Category:    "Database",
		Name:        "Delete Databases",
		Description: "Allows dropping server databases.",
	}
	r.permissions[PermissionServerDatabaseViewPassword] = PermissionDescriptor{
		Permission:  PermissionServerDatabaseViewPassword,
		Scope:       ScopeServer,
		Category:    "Database",
		Name:        "View DB Passwords",
		Description: "Allows inspecting plaintext passwords for server databases.",
	}

	// Schedules
	r.permissions[PermissionServerSchedulesManage] = PermissionDescriptor{
		Permission:  PermissionServerSchedulesManage,
		Scope:       ScopeServer,
		Category:    "Schedules",
		Name:        "Manage Schedules",
		Description: "Allows full control over automated cron tasks and schedules.",
	}
	r.permissions[PermissionServerSchedulesRead] = PermissionDescriptor{
		Permission:  PermissionServerSchedulesRead,
		Scope:       ScopeServer,
		Category:    "Schedules",
		Name:        "View Schedules",
		Description: "Allows viewing schedules and task execution history.",
	}
	r.permissions[PermissionServerSchedulesCreate] = PermissionDescriptor{
		Permission:  PermissionServerSchedulesCreate,
		Scope:       ScopeServer,
		Category:    "Schedules",
		Name:        "Create Schedules",
		Description: "Allows defining new schedules and triggers.",
	}
	r.permissions[PermissionServerSchedulesUpdate] = PermissionDescriptor{
		Permission:  PermissionServerSchedulesUpdate,
		Scope:       ScopeServer,
		Category:    "Schedules",
		Name:        "Update Schedules",
		Description: "Allows editing schedules and queueing tasks.",
	}
	r.permissions[PermissionServerSchedulesDelete] = PermissionDescriptor{
		Permission:  PermissionServerSchedulesDelete,
		Scope:       ScopeServer,
		Category:    "Schedules",
		Name:        "Delete Schedules",
		Description: "Allows deleting schedules.",
	}

	// Backups
	r.permissions[PermissionServerBackupsRead] = PermissionDescriptor{
		Permission:  PermissionServerBackupsRead,
		Scope:       ScopeServer,
		Category:    "Backups",
		Name:        "View Backups",
		Description: "Allows listing server backups.",
	}
	r.permissions[PermissionServerBackupsCreate] = PermissionDescriptor{
		Permission:  PermissionServerBackupsCreate,
		Scope:       ScopeServer,
		Category:    "Backups",
		Name:        "Create Backup",
		Description: "Allows creating snapshot backups.",
	}
	r.permissions[PermissionServerBackupsDelete] = PermissionDescriptor{
		Permission:  PermissionServerBackupsDelete,
		Scope:       ScopeServer,
		Category:    "Backups",
		Name:        "Delete Backup",
		Description: "Allows removing backups.",
	}
	r.permissions[PermissionServerBackupsDownload] = PermissionDescriptor{
		Permission:  PermissionServerBackupsDownload,
		Scope:       ScopeServer,
		Category:    "Backups",
		Name:        "Download Backup",
		Description: "Allows downloading backup archives.",
	}
	r.permissions[PermissionServerBackupsRestore] = PermissionDescriptor{
		Permission:  PermissionServerBackupsRestore,
		Scope:       ScopeServer,
		Category:    "Backups",
		Name:        "Restore Backup",
		Description: "Allows restoring a server from backup (destructive action).",
	}

	// Users / Subusers
	r.permissions[PermissionServerUsersManage] = PermissionDescriptor{
		Permission:  PermissionServerUsersManage,
		Scope:       ScopeServer,
		Category:    "Subusers",
		Name:        "Manage Subusers",
		Description: "Allows full management of server subusers and their roles.",
	}
	r.permissions[PermissionServerUsersRead] = PermissionDescriptor{
		Permission:  PermissionServerUsersRead,
		Scope:       ScopeServer,
		Category:    "Subusers",
		Name:        "View Subusers",
		Description: "Allows viewing subusers and assigned permissions.",
	}
	r.permissions[PermissionServerUsersCreate] = PermissionDescriptor{
		Permission:  PermissionServerUsersCreate,
		Scope:       ScopeServer,
		Category:    "Subusers",
		Name:        "Create Subuser",
		Description: "Allows inviting and creating subusers.",
	}
	r.permissions[PermissionServerUsersUpdate] = PermissionDescriptor{
		Permission:  PermissionServerUsersUpdate,
		Scope:       ScopeServer,
		Category:    "Subusers",
		Name:        "Update Subuser",
		Description: "Allows updating subuser permissions.",
	}
	r.permissions[PermissionServerUsersDelete] = PermissionDescriptor{
		Permission:  PermissionServerUsersDelete,
		Scope:       ScopeServer,
		Category:    "Subusers",
		Name:        "Remove Subuser",
		Description: "Allows deleting subusers from the server.",
	}

	// Allocations
	r.permissions[PermissionServerAllocationsManage] = PermissionDescriptor{
		Permission:  PermissionServerAllocationsManage,
		Scope:       ScopeServer,
		Category:    "Allocations",
		Name:        "Manage Allocations",
		Description: "Allows assigning, changing primary, and deleting allocations.",
	}
	r.permissions[PermissionServerAllocationsRead] = PermissionDescriptor{
		Permission:  PermissionServerAllocationsRead,
		Scope:       ScopeServer,
		Category:    "Allocations",
		Name:        "View Allocations",
		Description: "Allows viewing assigned server port allocations.",
	}
	r.permissions[PermissionServerAllocationsCreate] = PermissionDescriptor{
		Permission:  PermissionServerAllocationsCreate,
		Scope:       ScopeServer,
		Category:    "Allocations",
		Name:        "Assign Allocation",
		Description: "Allows allocating extra ports from available node pool.",
	}
	r.permissions[PermissionServerAllocationsUpdate] = PermissionDescriptor{
		Permission:  PermissionServerAllocationsUpdate,
		Scope:       ScopeServer,
		Category:    "Allocations",
		Name:        "Update Allocation",
		Description: "Allows changing primary allocation or updating notes.",
	}
	r.permissions[PermissionServerAllocationsDelete] = PermissionDescriptor{
		Permission:  PermissionServerAllocationsDelete,
		Scope:       ScopeServer,
		Category:    "Allocations",
		Name:        "Delete Allocation",
		Description: "Allows releasing assigned secondary allocations.",
	}

	// Startup & Settings & Activity
	r.permissions[PermissionServerStartupRead] = PermissionDescriptor{
		Permission:  PermissionServerStartupRead,
		Scope:       ScopeServer,
		Category:    "Startup",
		Name:        "View Startup Parameters",
		Description: "Allows viewing startup command and environment variables.",
	}
	r.permissions[PermissionServerStartupUpdate] = PermissionDescriptor{
		Permission:  PermissionServerStartupUpdate,
		Scope:       ScopeServer,
		Category:    "Startup",
		Name:        "Update Startup Parameters",
		Description: "Allows modifying startup arguments and egg variables.",
	}
	r.permissions[PermissionServerStartupDockerImage] = PermissionDescriptor{
		Permission:  PermissionServerStartupDockerImage,
		Scope:       ScopeServer,
		Category:    "Startup",
		Name:        "Update Docker Image",
		Description: "Allows changing the server docker container image.",
	}
	r.permissions[PermissionServerSettingsRename] = PermissionDescriptor{
		Permission:  PermissionServerSettingsRename,
		Scope:       ScopeServer,
		Category:    "Settings",
		Name:        "Rename Server",
		Description: "Allows changing server name and description.",
	}
	r.permissions[PermissionServerSettingsReinstall] = PermissionDescriptor{
		Permission:  PermissionServerSettingsReinstall,
		Scope:       ScopeServer,
		Category:    "Settings",
		Name:        "Reinstall Server",
		Description: "Allows triggering a full server re-installation.",
	}
	r.permissions[PermissionServerActivityRead] = PermissionDescriptor{
		Permission:  PermissionServerActivityRead,
		Scope:       ScopeServer,
		Category:    "Activity",
		Name:        "View Server Activity",
		Description: "Allows reading server audit and activity logs.",
	}

	// Administrative
	r.permissions[PermissionAdminAll] = PermissionDescriptor{
		Permission:  PermissionAdminAll,
		Scope:       ScopeAdmin,
		Category:    "Admin",
		Name:        "All Admin Permissions",
		Description: "Grants all administrative panel privileges.",
	}
	r.permissions[PermissionAdminNodes] = PermissionDescriptor{
		Permission:  PermissionAdminNodes,
		Scope:       ScopeAdmin,
		Category:    "Admin:Nodes",
		Name:        "Manage Nodes",
		Description: "Full access to create, configure, and monitor daemon nodes.",
	}
	r.permissions[PermissionAdminNodesRead] = PermissionDescriptor{
		Permission:  PermissionAdminNodesRead,
		Scope:       ScopeAdmin,
		Category:    "Admin:Nodes",
		Name:        "View Nodes",
		Description: "Allows inspecting node details, allocations, and stats.",
	}
	r.permissions[PermissionAdminNodesWrite] = PermissionDescriptor{
		Permission:  PermissionAdminNodesWrite,
		Scope:       ScopeAdmin,
		Category:    "Admin:Nodes",
		Name:        "Write Nodes",
		Description: "Allows creating and modifying nodes and daemon tokens.",
	}
	r.permissions[PermissionAdminNodesDelete] = PermissionDescriptor{
		Permission:  PermissionAdminNodesDelete,
		Scope:       ScopeAdmin,
		Category:    "Admin:Nodes",
		Name:        "Delete Nodes",
		Description: "Allows deleting nodes from the cluster.",
	}

	r.permissions[PermissionAdminUsers] = PermissionDescriptor{
		Permission:  PermissionAdminUsers,
		Scope:       ScopeAdmin,
		Category:    "Admin:Users",
		Name:        "Manage Users",
		Description: "Full administrative access to manage all panel user accounts.",
	}
	r.permissions[PermissionAdminUsersRead] = PermissionDescriptor{
		Permission:  PermissionAdminUsersRead,
		Scope:       ScopeAdmin,
		Category:    "Admin:Users",
		Name:        "View Users",
		Description: "Allows listing and viewing panel users.",
	}
	r.permissions[PermissionAdminUsersWrite] = PermissionDescriptor{
		Permission:  PermissionAdminUsersWrite,
		Scope:       ScopeAdmin,
		Category:    "Admin:Users",
		Name:        "Write Users",
		Description: "Allows creating and modifying user accounts and passwords.",
	}
	r.permissions[PermissionAdminUsersDelete] = PermissionAdminUsersDeleteDescriptor()

	r.permissions[PermissionAdminServers] = PermissionDescriptor{
		Permission:  PermissionAdminServers,
		Scope:       ScopeAdmin,
		Category:    "Admin:Servers",
		Name:        "Manage All Servers",
		Description: "Full access to create, build, manage, and delete all servers.",
	}
	r.permissions[PermissionAdminServersRead] = PermissionDescriptor{
		Permission:  PermissionAdminServersRead,
		Scope:       ScopeAdmin,
		Category:    "Admin:Servers",
		Name:        "View All Servers",
		Description: "Allows viewing any server across the entire panel.",
	}
	r.permissions[PermissionAdminServersCreate] = PermissionDescriptor{
		Permission:  PermissionAdminServersCreate,
		Scope:       ScopeAdmin,
		Category:    "Admin:Servers",
		Name:        "Create Servers",
		Description: "Allows provisioning new servers on nodes.",
	}
	r.permissions[PermissionAdminServersUpdate] = PermissionDescriptor{
		Permission:  PermissionAdminServersUpdate,
		Scope:       ScopeAdmin,
		Category:    "Admin:Servers",
		Name:        "Update Server Configuration",
		Description: "Allows modifying build limits, CPU, RAM, and disk for any server.",
	}
	r.permissions[PermissionAdminServersDelete] = PermissionDescriptor{
		Permission:  PermissionAdminServersDelete,
		Scope:       ScopeAdmin,
		Category:    "Admin:Servers",
		Name:        "Delete Servers",
		Description: "Allows permanently deleting servers from the panel.",
	}

	r.permissions[PermissionAdminDatabases] = PermissionDescriptor{
		Permission:  PermissionAdminDatabases,
		Scope:       ScopeAdmin,
		Category:    "Admin:Databases",
		Name:        "Manage Database Hosts",
		Description: "Full access to database hosts and clusters.",
	}
	r.permissions[PermissionAdminDatabasesRead] = PermissionDescriptor{
		Permission:  PermissionAdminDatabasesRead,
		Scope:       ScopeAdmin,
		Category:    "Admin:Databases",
		Name:        "View Database Hosts",
		Description: "Allows viewing database hosts and connection endpoints.",
	}
	r.permissions[PermissionAdminDatabasesWrite] = PermissionDescriptor{
		Permission:  PermissionAdminDatabasesWrite,
		Scope:       ScopeAdmin,
		Category:    "Admin:Databases",
		Name:        "Write Database Hosts",
		Description: "Allows creating and updating database hosts.",
	}

	r.permissions[PermissionAdminMounts] = PermissionDescriptor{
		Permission:  PermissionAdminMounts,
		Scope:       ScopeAdmin,
		Category:    "Admin:Mounts",
		Name:        "Manage Mounts",
		Description: "Allows configuring shared storage mounts across nodes and servers.",
	}
	r.permissions[PermissionAdminNests] = PermissionDescriptor{
		Permission:  PermissionAdminNests,
		Scope:       ScopeAdmin,
		Category:    "Admin:Nests",
		Name:        "Manage Nests & Eggs",
		Description: "Allows managing nests, eggs, variables, and install scripts.",
	}
	r.permissions[PermissionAdminLocations] = PermissionDescriptor{
		Permission:  PermissionAdminLocations,
		Scope:       ScopeAdmin,
		Category:    "Admin:Locations",
		Name:        "Manage Locations",
		Description: "Allows managing geographical location groups for nodes.",
	}
	r.permissions[PermissionAdminSettings] = PermissionDescriptor{
		Permission:  PermissionAdminSettings,
		Scope:       ScopeAdmin,
		Category:    "Admin:Settings",
		Name:        "Manage System Settings",
		Description: "Allows updating panel branding, mail, 2FA, and general settings.",
	}
	r.permissions[PermissionAdminAudit] = PermissionDescriptor{
		Permission:  PermissionAdminAudit,
		Scope:       ScopeAdmin,
		Category:    "Admin:Audit",
		Name:        "View Global Audit Logs",
		Description: "Allows viewing system-wide administrative audit activity.",
	}
}

func PermissionAdminUsersDeleteDescriptor() PermissionDescriptor {
	return PermissionDescriptor{
		Permission:  PermissionAdminUsersDelete,
		Scope:       ScopeAdmin,
		Category:    "Admin:Users",
		Name:        "Delete Users",
		Description: "Allows deleting user accounts from the panel.",
	}
}

// Match evaluates whether a given granted pattern satisfies the requested target permission.
//
// Rules:
// 1. Root wildcard "*" matches any target permission.
// 2. Exact match (pattern == target) always matches.
// 3. Dot-wildcard suffix e.g. "server.*" matches anything starting with "server.".
// 4. Hierarchical prefix matching: granting "server.power" grants "server.power.start", "server.power.stop", etc.
func Match(pattern, target Permission) bool {
	pStr := string(pattern)
	tStr := string(target)

	if pStr == "*" {
		return true
	}
	if pStr == tStr {
		return true
	}

	// Wildcard suffix: e.g. "server.*" matches "server.power"
	if strings.HasSuffix(pStr, ".*") {
		prefix := strings.TrimSuffix(pStr, "*")
		if strings.HasPrefix(tStr, prefix) {
			return true
		}
	}

	// Hierarchical implication: e.g. "server.power" implies "server.power.start"
	if strings.HasPrefix(tStr, pStr+".") {
		return true
	}

	return false
}

// MatchesAny checks if the target satisfies at least one pattern in the patterns slice.
func MatchesAny(patterns []Permission, target Permission) bool {
	for _, p := range patterns {
		if Match(p, target) {
			return true
		}
	}
	return false
}

// PermissionSet represents an optimized, fast set of permissions with wildcard evaluation.
type PermissionSet struct {
	items map[Permission]struct{}
}

// NewPermissionSet initializes a new PermissionSet with optional initial permissions.
func NewPermissionSet(perms ...Permission) PermissionSet {
	ps := PermissionSet{
		items: make(map[Permission]struct{}, len(perms)),
	}
	for _, p := range perms {
		ps.Add(p)
	}
	return ps
}

// Add adds one or more permissions to the set.
func (ps *PermissionSet) Add(perms ...Permission) {
	if ps.items == nil {
		ps.items = make(map[Permission]struct{})
	}
	for _, p := range perms {
		trimmed := Permission(strings.TrimSpace(string(p)))
		if trimmed != "" {
			ps.items[trimmed] = struct{}{}
		}
	}
}

// Remove removes one or more permissions from the set.
func (ps *PermissionSet) Remove(perms ...Permission) {
	if ps.items == nil {
		return
	}
	for _, p := range perms {
		delete(ps.items, p)
	}
}

// Has checks whether the permission set satisfies the given target permission,
// taking into account exact matches and wildcards.
func (ps PermissionSet) Has(target Permission) bool {
	if ps.items == nil || len(ps.items) == 0 {
		return false
	}

	// Direct map lookup fast path
	if _, direct := ps.items[target]; direct {
		return true
	}
	if _, star := ps.items[PermissionAll]; star {
		return true
	}

	// Pattern match evaluation
	for granted := range ps.items {
		if Match(granted, target) {
			return true
		}
	}

	return false
}

// HasAll checks whether every single target permission is satisfied by the set.
func (ps PermissionSet) HasAll(targets ...Permission) bool {
	for _, t := range targets {
		if !ps.Has(t) {
			return false
		}
	}
	return true
}

// HasAny checks whether at least one target permission is satisfied by the set.
func (ps PermissionSet) HasAny(targets ...Permission) bool {
	if len(targets) == 0 {
		return true
	}
	for _, t := range targets {
		if ps.Has(t) {
			return true
		}
	}
	return false
}

// Slice returns all distinct permissions in the set as a slice.
func (ps PermissionSet) Slice() []Permission {
	if ps.items == nil {
		return []Permission{}
	}
	res := make([]Permission, 0, len(ps.items))
	for p := range ps.items {
		res = append(res, p)
	}
	return res
}

// Strings returns all distinct permissions as string slice.
func (ps PermissionSet) Strings() []string {
	if ps.items == nil {
		return []string{}
	}
	res := make([]string, 0, len(ps.items))
	for p := range ps.items {
		res = append(res, string(p))
	}
	return res
}

// Len returns the count of items in the set.
func (ps PermissionSet) Len() int {
	return len(ps.items)
}

// Validate checks whether a given permission string format is valid according to naming conventions.
func Validate(perm Permission) error {
	s := strings.TrimSpace(string(perm))
	if s == "" {
		return fmt.Errorf("permission cannot be empty")
	}
	if s == "*" {
		return nil
	}
	parts := strings.Split(s, ".")
	if len(parts) < 2 {
		return fmt.Errorf("permission %q must follow scope.resource or scope.resource.action format", s)
	}
	for _, part := range parts {
		if part == "" {
			return fmt.Errorf("permission %q contains empty segment", s)
		}
	}
	return nil
}
