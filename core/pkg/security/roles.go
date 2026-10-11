package security

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Standard Role Names
const (
	RoleNameOwner     = "Owner"
	RoleNameAdmin     = "Admin"
	RoleNameModerator = "Moderator"
	RoleNameViewer    = "Viewer"
)

// Role IDs for built-in roles
const (
	SystemRoleOwnerID     = "sys_role_owner"
	SystemRoleAdminID     = "sys_role_admin"
	SystemRoleModeratorID = "sys_role_moderator"
	SystemRoleViewerID    = "sys_role_viewer"
)

// Role defines a role with a collection of permissions.
type Role struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	ServerID    string       `json:"server_id,omitempty"` // empty for system templates, or specific server ID for custom roles
	IsSystem    bool         `json:"is_system"`
	Permissions []Permission `json:"permissions"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// ServerRoleAssignment maps a user to a specific role on a server, with optional direct overrides.
type ServerRoleAssignment struct {
	ID                string       `json:"id"`
	ServerID          string       `json:"server_id"`
	UserID            string       `json:"user_id"`
	RoleID            string       `json:"role_id"`
	RoleName          string       `json:"role_name"`
	DirectPermissions []Permission `json:"direct_permissions,omitempty"` // extra granted permissions
	DeniedPermissions []Permission `json:"denied_permissions,omitempty"` // explicit overrides (deny takes precedence)
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
}

// Built-in System Roles
var (
	BuiltinOwnerRole = Role{
		ID:          SystemRoleOwnerID,
		Name:        RoleNameOwner,
		Description: "Server owner with full, unrestricted access to the server.",
		IsSystem:    true,
		Permissions: []Permission{
			PermissionServerAll,
		},
	}

	BuiltinAdminRole = Role{
		ID:          SystemRoleAdminID,
		Name:        RoleNameAdmin,
		Description: "Server administrator with operational and management access.",
		IsSystem:    true,
		Permissions: []Permission{
			PermissionServerPower,
			PermissionServerConsoleRead,
			PermissionServerConsoleWrite,
			PermissionServerFilesRead,
			PermissionServerFilesReadContent,
			PermissionServerFilesWrite,
			PermissionServerFilesCreate,
			PermissionServerFilesDelete,
			PermissionServerFilesArchive,
			PermissionServerFilesSFTP,
			PermissionServerDatabaseRead,
			PermissionServerDatabaseCreate,
			PermissionServerDatabaseUpdate,
			PermissionServerDatabaseDelete,
			PermissionServerDatabaseViewPassword,
			PermissionServerSchedulesManage,
			PermissionServerBackupsRead,
			PermissionServerBackupsCreate,
			PermissionServerBackupsDelete,
			PermissionServerBackupsDownload,
			PermissionServerBackupsRestore,
			PermissionServerUsersRead,
			PermissionServerUsersCreate,
			PermissionServerUsersUpdate,
			PermissionServerUsersDelete,
			PermissionServerAllocationsRead,
			PermissionServerAllocationsCreate,
			PermissionServerAllocationsUpdate,
			PermissionServerAllocationsDelete,
			PermissionServerStartupRead,
			PermissionServerStartupUpdate,
			PermissionServerStartupDockerImage,
			PermissionServerSettingsRename,
			PermissionServerActivityRead,
		},
	}

	BuiltinModeratorRole = Role{
		ID:          SystemRoleModeratorID,
		Name:        RoleNameModerator,
		Description: "Server moderator for daily maintenance, console interaction, and server power.",
		IsSystem:    true,
		Permissions: []Permission{
			PermissionServerPowerStart,
			PermissionServerPowerRestart,
			PermissionServerPowerStop,
			PermissionServerConsoleRead,
			PermissionServerConsoleWrite,
			PermissionServerFilesRead,
			PermissionServerFilesReadContent,
			PermissionServerBackupsRead,
			PermissionServerBackupsCreate,
			PermissionServerActivityRead,
		},
	}

	BuiltinViewerRole = Role{
		ID:          SystemRoleViewerID,
		Name:        RoleNameViewer,
		Description: "Read-only observer access to server console and files.",
		IsSystem:    true,
		Permissions: []Permission{
			PermissionServerConsoleRead,
			PermissionServerFilesRead,
			PermissionServerActivityRead,
		},
	}
)

// RoleStore defines persistent/storage operations for roles and user assignments.
type RoleStore interface {
	// Role CRUD
	GetRole(ctx context.Context, roleID string) (*Role, error)
	ListSystemRoles(ctx context.Context) ([]*Role, error)
	ListServerRoles(ctx context.Context, serverID string) ([]*Role, error)
	CreateCustomRole(ctx context.Context, role *Role) error
	UpdateCustomRole(ctx context.Context, role *Role) error
	DeleteCustomRole(ctx context.Context, serverID, roleID string) error

	// Server Role Assignments
	GetAssignment(ctx context.Context, serverID, userID string) (*ServerRoleAssignment, error)
	ListAssignmentsForServer(ctx context.Context, serverID string) ([]*ServerRoleAssignment, error)
	ListAssignmentsForUser(ctx context.Context, userID string) ([]*ServerRoleAssignment, error)
	SaveAssignment(ctx context.Context, assignment *ServerRoleAssignment) error
	DeleteAssignment(ctx context.Context, serverID, userID string) error

	// Server Ownership
	GetServerOwner(ctx context.Context, serverID string) (string, error)
	SetServerOwner(ctx context.Context, serverID, userID string) error

	// Global Admins
	IsGlobalAdmin(ctx context.Context, userID string) (bool, error)
	SetGlobalAdmin(ctx context.Context, userID string, isAdmin bool) error
}

// MemoryRoleStore is a thread-safe in-memory implementation of RoleStore.
type MemoryRoleStore struct {
	mu           sync.RWMutex
	systemRoles  map[string]*Role
	customRoles  map[string]map[string]*Role // serverID -> roleID -> Role
	assignments  map[string]map[string]*ServerRoleAssignment // serverID -> userID -> Assignment
	serverOwners map[string]string            // serverID -> userID
	globalAdmins map[string]bool              // userID -> bool
}

// NewMemoryRoleStore creates a new in-memory role store seeded with system roles.
func NewMemoryRoleStore() *MemoryRoleStore {
	store := &MemoryRoleStore{
		systemRoles:  make(map[string]*Role),
		customRoles:  make(map[string]map[string]*Role),
		assignments:  make(map[string]map[string]*ServerRoleAssignment),
		serverOwners: make(map[string]string),
		globalAdmins: make(map[string]bool),
	}

	// Register builtins
	now := time.Now().UTC()
	for _, r := range []Role{BuiltinOwnerRole, BuiltinAdminRole, BuiltinModeratorRole, BuiltinViewerRole} {
		rCopy := r
		rCopy.CreatedAt = now
		rCopy.UpdatedAt = now
		store.systemRoles[r.ID] = &rCopy
	}

	return store
}

func (s *MemoryRoleStore) GetRole(ctx context.Context, roleID string) (*Role, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if r, ok := s.systemRoles[roleID]; ok {
		cp := *r
		return &cp, nil
	}

	for _, srvRoles := range s.customRoles {
		if r, ok := srvRoles[roleID]; ok {
			cp := *r
			return &cp, nil
		}
	}

	return nil, fmt.Errorf("role %q not found", roleID)
}

func (s *MemoryRoleStore) ListSystemRoles(ctx context.Context) ([]*Role, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	roles := make([]*Role, 0, len(s.systemRoles))
	for _, r := range s.systemRoles {
		cp := *r
		roles = append(roles, &cp)
	}
	return roles, nil
}

func (s *MemoryRoleStore) ListServerRoles(ctx context.Context, serverID string) ([]*Role, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var roles []*Role
	for _, r := range s.systemRoles {
		cp := *r
		roles = append(roles, &cp)
	}

	if srvRoles, ok := s.customRoles[serverID]; ok {
		for _, r := range srvRoles {
			cp := *r
			roles = append(roles, &cp)
		}
	}

	return roles, nil
}

func (s *MemoryRoleStore) CreateCustomRole(ctx context.Context, role *Role) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if role.ServerID == "" {
		return fmt.Errorf("server_id is required for custom roles")
	}
	if role.ID == "" {
		role.ID = "role_" + uuid.NewString()
	}
	role.IsSystem = false
	if role.CreatedAt.IsZero() {
		role.CreatedAt = time.Now().UTC()
	}
	role.UpdatedAt = role.CreatedAt

	if _, ok := s.customRoles[role.ServerID]; !ok {
		s.customRoles[role.ServerID] = make(map[string]*Role)
	}

	cp := *role
	s.customRoles[role.ServerID][role.ID] = &cp
	return nil
}

func (s *MemoryRoleStore) UpdateCustomRole(ctx context.Context, role *Role) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	srvRoles, ok := s.customRoles[role.ServerID]
	if !ok {
		return fmt.Errorf("no custom roles for server %q", role.ServerID)
	}
	existing, ok := srvRoles[role.ID]
	if !ok {
		return fmt.Errorf("custom role %q not found for server %q", role.ID, role.ServerID)
	}
	if existing.IsSystem {
		return fmt.Errorf("cannot modify system role")
	}

	role.UpdatedAt = time.Now().UTC()
	role.CreatedAt = existing.CreatedAt
	role.IsSystem = false

	cp := *role
	srvRoles[role.ID] = &cp
	return nil
}

func (s *MemoryRoleStore) DeleteCustomRole(ctx context.Context, serverID, roleID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.systemRoles[roleID]; ok {
		return fmt.Errorf("cannot delete system role %q", roleID)
	}

	srvRoles, ok := s.customRoles[serverID]
	if !ok {
		return fmt.Errorf("custom role not found")
	}

	if _, exists := srvRoles[roleID]; !exists {
		return fmt.Errorf("custom role not found")
	}

	delete(srvRoles, roleID)
	return nil
}

func (s *MemoryRoleStore) GetAssignment(ctx context.Context, serverID, userID string) (*ServerRoleAssignment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	srvMap, ok := s.assignments[serverID]
	if !ok {
		return nil, fmt.Errorf("no assignments for server %q", serverID)
	}
	assign, ok := srvMap[userID]
	if !ok {
		return nil, fmt.Errorf("no assignment for user %q on server %q", userID, serverID)
	}

	cp := *assign
	return &cp, nil
}

func (s *MemoryRoleStore) ListAssignmentsForServer(ctx context.Context, serverID string) ([]*ServerRoleAssignment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var list []*ServerRoleAssignment
	if srvMap, ok := s.assignments[serverID]; ok {
		for _, a := range srvMap {
			cp := *a
			list = append(list, &cp)
		}
	}
	return list, nil
}

func (s *MemoryRoleStore) ListAssignmentsForUser(ctx context.Context, userID string) ([]*ServerRoleAssignment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var list []*ServerRoleAssignment
	for _, srvMap := range s.assignments {
		if a, ok := srvMap[userID]; ok {
			cp := *a
			list = append(list, &cp)
		}
	}
	return list, nil
}

func (s *MemoryRoleStore) SaveAssignment(ctx context.Context, assignment *ServerRoleAssignment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if assignment.ServerID == "" || assignment.UserID == "" {
		return fmt.Errorf("server_id and user_id are required")
	}
	if assignment.ID == "" {
		assignment.ID = "assign_" + uuid.NewString()
	}
	now := time.Now().UTC()
	if assignment.CreatedAt.IsZero() {
		assignment.CreatedAt = now
	}
	assignment.UpdatedAt = now

	if _, ok := s.assignments[assignment.ServerID]; !ok {
		s.assignments[assignment.ServerID] = make(map[string]*ServerRoleAssignment)
	}

	cp := *assignment
	s.assignments[assignment.ServerID][assignment.UserID] = &cp
	return nil
}

func (s *MemoryRoleStore) DeleteAssignment(ctx context.Context, serverID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if srvMap, ok := s.assignments[serverID]; ok {
		delete(srvMap, userID)
	}
	return nil
}

func (s *MemoryRoleStore) GetServerOwner(ctx context.Context, serverID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	owner, ok := s.serverOwners[serverID]
	if !ok {
		return "", fmt.Errorf("server %q has no owner configured", serverID)
	}
	return owner, nil
}

func (s *MemoryRoleStore) SetServerOwner(ctx context.Context, serverID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.serverOwners[serverID] = userID
	return nil
}

func (s *MemoryRoleStore) IsGlobalAdmin(ctx context.Context, userID string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.globalAdmins[userID], nil
}

func (s *MemoryRoleStore) SetGlobalAdmin(ctx context.Context, userID string, isAdmin bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if isAdmin {
		s.globalAdmins[userID] = true
	} else {
		delete(s.globalAdmins, userID)
	}
	return nil
}

// Authorizer evaluates RBAC rules and permissions for users on servers.
type Authorizer struct {
	store    RoleStore
	registry *Registry
}

// NewAuthorizer creates a new RBAC Authorizer backed by a RoleStore.
func NewAuthorizer(store RoleStore, registry *Registry) *Authorizer {
	if registry == nil {
		registry = DefaultRegistry()
	}
	return &Authorizer{
		store:    store,
		registry: registry,
	}
}

// Can checks whether the user has the target permission for a given server context.
// If serverID is empty, it checks for global/administrative permission.
func (a *Authorizer) Can(ctx context.Context, userID, serverID string, target Permission) bool {
	// 1. Check Global Admin (superadmin grants everything)
	isGlobalAdmin, err := a.store.IsGlobalAdmin(ctx, userID)
	if err == nil && isGlobalAdmin {
		return true
	}

	// If target is an admin permission but user is not global admin:
	if strings.HasPrefix(string(target), "admin.") {
		return false
	}

	// If no server context was provided and not a global admin:
	if serverID == "" {
		return false
	}

	// 2. Check Server Ownership
	ownerID, err := a.store.GetServerOwner(ctx, serverID)
	if err == nil && ownerID != "" && ownerID == userID {
		// Server owner holds all server permissions
		if Match(PermissionServerAll, target) {
			return true
		}
	}

	// 3. Check Server Role Assignment
	assignment, err := a.store.GetAssignment(ctx, serverID, userID)
	if err != nil || assignment == nil {
		return false
	}

	// 4. Denied permissions have highest priority (explicit deny override)
	for _, denied := range assignment.DeniedPermissions {
		if Match(denied, target) {
			return false
		}
	}

	// 5. Check direct granted permissions
	for _, direct := range assignment.DirectPermissions {
		if Match(direct, target) {
			return true
		}
	}

	// 6. Check Role Permissions
	role, err := a.store.GetRole(ctx, assignment.RoleID)
	if err != nil || role == nil {
		return false
	}

	for _, p := range role.Permissions {
		if Match(p, target) {
			return true
		}
	}

	return false
}

// CanAny checks if the user has AT LEAST ONE of the target permissions.
func (a *Authorizer) CanAny(ctx context.Context, userID, serverID string, targets ...Permission) bool {
	if len(targets) == 0 {
		return true
	}
	for _, t := range targets {
		if a.Can(ctx, userID, serverID, t) {
			return true
		}
	}
	return false
}

// CanAll checks if the user has ALL of the target permissions.
func (a *Authorizer) CanAll(ctx context.Context, userID, serverID string, targets ...Permission) bool {
	for _, t := range targets {
		if !a.Can(ctx, userID, serverID, t) {
			return false
		}
	}
	return true
}

// EffectivePermissions computes the full active permission set for a user on a server.
func (a *Authorizer) EffectivePermissions(ctx context.Context, userID, serverID string) (PermissionSet, error) {
	set := NewPermissionSet()

	// 1. Global Admin
	isGlobalAdmin, _ := a.store.IsGlobalAdmin(ctx, userID)
	if isGlobalAdmin {
		set.Add(PermissionAll)
		return set, nil
	}

	if serverID == "" {
		return set, nil
	}

	// 2. Server Owner
	ownerID, _ := a.store.GetServerOwner(ctx, serverID)
	if ownerID == userID {
		set.Add(PermissionServerAll)
		return set, nil
	}

	// 3. Assignment
	assignment, err := a.store.GetAssignment(ctx, serverID, userID)
	if err != nil {
		return set, nil
	}

	// Add role permissions
	role, err := a.store.GetRole(ctx, assignment.RoleID)
	if err == nil && role != nil {
		for _, p := range role.Permissions {
			set.Add(p)
		}
	}

	// Add direct permissions
	for _, p := range assignment.DirectPermissions {
		set.Add(p)
	}

	// Remove denied permissions
	for _, p := range assignment.DeniedPermissions {
		set.Remove(p)
	}

	return set, nil
}

// AssignRole is a helper to assign a role to a user on a server.
func (a *Authorizer) AssignRole(ctx context.Context, serverID, userID, roleID string, direct, denied []Permission) (*ServerRoleAssignment, error) {
	role, err := a.store.GetRole(ctx, roleID)
	if err != nil {
		return nil, fmt.Errorf("role %q not found: %w", roleID, err)
	}

	assignment := &ServerRoleAssignment{
		ID:                fmt.Sprintf("asgn_%s_%s", serverID, userID),
		ServerID:          serverID,
		UserID:            userID,
		RoleID:            role.ID,
		RoleName:          role.Name,
		DirectPermissions: direct,
		DeniedPermissions: denied,
	}

	if err := a.store.SaveAssignment(ctx, assignment); err != nil {
		return nil, fmt.Errorf("failed to save assignment: %w", err)
	}
	return assignment, nil
}

// RevokeRole removes a user's role assignment from a server.
func (a *Authorizer) RevokeRole(ctx context.Context, serverID, userID string) error {
	return a.store.DeleteAssignment(ctx, serverID, userID)
}

// Store returns the underlying RoleStore.
func (a *Authorizer) Store() RoleStore {
	return a.store
}
