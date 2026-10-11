package security_test

import (
	"context"
	"testing"

	"github.com/pteronext/panel-core/pkg/security"
)

func TestBuiltinRoles(t *testing.T) {
	store := security.NewMemoryRoleStore()
	ctx := context.Background()

	roles, err := store.ListSystemRoles(ctx)
	if err != nil {
		t.Fatalf("unexpected error listing system roles: %v", err)
	}
	if len(roles) < 4 {
		t.Errorf("expected at least 4 system roles, got %d", len(roles))
	}

	owner, err := store.GetRole(ctx, security.SystemRoleOwnerID)
	if err != nil || owner.Name != security.RoleNameOwner {
		t.Errorf("failed to retrieve Owner role")
	}

	admin, err := store.GetRole(ctx, security.SystemRoleAdminID)
	if err != nil || admin.Name != security.RoleNameAdmin {
		t.Errorf("failed to retrieve Admin role")
	}

	mod, err := store.GetRole(ctx, security.SystemRoleModeratorID)
	if err != nil || mod.Name != security.RoleNameModerator {
		t.Errorf("failed to retrieve Moderator role")
	}
}

func TestCustomRoles(t *testing.T) {
	store := security.NewMemoryRoleStore()
	ctx := context.Background()
	serverID := "srv-1234"

	// Create custom role
	custom := &security.Role{
		Name:        "Plugin Developer",
		Description: "Can modify files and restart server",
		ServerID:    serverID,
		Permissions: []security.Permission{
			security.PermissionServerFilesRead,
			security.PermissionServerFilesWrite,
			security.PermissionServerPowerRestart,
		},
	}

	err := store.CreateCustomRole(ctx, custom)
	if err != nil {
		t.Fatalf("failed to create custom role: %v", err)
	}
	if custom.ID == "" {
		t.Fatalf("expected generated ID for custom role")
	}

	// Retrieve role
	fetched, err := store.GetRole(ctx, custom.ID)
	if err != nil {
		t.Fatalf("failed to get custom role: %v", err)
	}
	if fetched.Name != "Plugin Developer" {
		t.Errorf("expected role name 'Plugin Developer', got %s", fetched.Name)
	}

	// Update custom role
	fetched.Description = "Updated description"
	err = store.UpdateCustomRole(ctx, fetched)
	if err != nil {
		t.Fatalf("failed to update custom role: %v", err)
	}

	// Delete custom role
	err = store.DeleteCustomRole(ctx, serverID, custom.ID)
	if err != nil {
		t.Fatalf("failed to delete custom role: %v", err)
	}

	_, err = store.GetRole(ctx, custom.ID)
	if err == nil {
		t.Fatalf("expected error getting deleted custom role")
	}
}

func TestAuthorizer(t *testing.T) {
	store := security.NewMemoryRoleStore()
	auth := security.NewAuthorizer(store, nil)
	ctx := context.Background()

	serverID := "srv-alpha"
	ownerUserID := "user-owner"
	adminUserID := "user-admin"
	modUserID := "user-mod"
	viewerUserID := "user-viewer"
	customUserID := "user-custom"
	superAdminID := "user-root"

	// 1. Setup Server Owner
	_ = store.SetServerOwner(ctx, serverID, ownerUserID)

	// 2. Setup Super Admin
	_ = store.SetGlobalAdmin(ctx, superAdminID, true)

	// 3. Assign Builtin Roles
	_, _ = auth.AssignRole(ctx, serverID, adminUserID, security.SystemRoleAdminID, nil, nil)
	_, _ = auth.AssignRole(ctx, serverID, modUserID, security.SystemRoleModeratorID, nil, nil)
	_, _ = auth.AssignRole(ctx, serverID, viewerUserID, security.SystemRoleViewerID, nil, nil)

	// 4. Setup Custom Role with direct grants and explicit deny
	customRole := &security.Role{
		Name:     "Support Specialist",
		ServerID: serverID,
		Permissions: []security.Permission{
			security.PermissionServerPowerStart,
			security.PermissionServerConsoleRead,
		},
	}
	_ = store.CreateCustomRole(ctx, customRole)

	// Assign custom role with direct grant (files.read) and denied perm (power.stop)
	_, _ = auth.AssignRole(
		ctx,
		serverID,
		customUserID,
		customRole.ID,
		[]security.Permission{security.PermissionServerFilesRead},
		[]security.Permission{security.PermissionServerPowerStop},
	)

	// Test Global SuperAdmin
	if !auth.Can(ctx, superAdminID, serverID, security.PermissionServerPowerKill) {
		t.Errorf("global admin should have server.power.kill")
	}
	if !auth.Can(ctx, superAdminID, "", security.PermissionAdminNodes) {
		t.Errorf("global admin should have admin.nodes")
	}

	// Test Server Owner
	if !auth.Can(ctx, ownerUserID, serverID, security.PermissionServerPowerKill) {
		t.Errorf("server owner should have all server permissions")
	}
	if !auth.Can(ctx, ownerUserID, serverID, security.PermissionServerSettingsRename) {
		t.Errorf("server owner should have settings rename")
	}
	if auth.Can(ctx, ownerUserID, "", security.PermissionAdminNodes) {
		t.Errorf("server owner should not have global admin permissions without superadmin")
	}

	// Test Admin User
	if !auth.Can(ctx, adminUserID, serverID, security.PermissionServerPower) {
		t.Errorf("admin should have server power")
	}
	if !auth.Can(ctx, adminUserID, serverID, security.PermissionServerDatabaseCreate) {
		t.Errorf("admin should have database create")
	}

	// Test Moderator User
	if !auth.Can(ctx, modUserID, serverID, security.PermissionServerPowerStart) {
		t.Errorf("moderator should have power start")
	}
	if !auth.Can(ctx, modUserID, serverID, security.PermissionServerConsoleWrite) {
		t.Errorf("moderator should have console write")
	}
	if auth.Can(ctx, modUserID, serverID, security.PermissionServerDatabaseCreate) {
		t.Errorf("moderator should NOT have database create")
	}

	// Test Viewer User
	if !auth.Can(ctx, viewerUserID, serverID, security.PermissionServerConsoleRead) {
		t.Errorf("viewer should have console read")
	}
	if auth.Can(ctx, viewerUserID, serverID, security.PermissionServerConsoleWrite) {
		t.Errorf("viewer should NOT have console write")
	}
	if auth.Can(ctx, viewerUserID, serverID, security.PermissionServerPowerStart) {
		t.Errorf("viewer should NOT have power start")
	}

	// Test Custom User
	if !auth.Can(ctx, customUserID, serverID, security.PermissionServerPowerStart) {
		t.Errorf("custom user should have power start from role")
	}
	if !auth.Can(ctx, customUserID, serverID, security.PermissionServerFilesRead) {
		t.Errorf("custom user should have files read from direct permissions")
	}
	if auth.Can(ctx, customUserID, serverID, security.PermissionServerPowerStop) {
		t.Errorf("custom user should NOT have power stop due to explicit deny")
	}
	if auth.Can(ctx, customUserID, serverID, security.PermissionServerDatabaseCreate) {
		t.Errorf("custom user should not have unassigned permissions")
	}

	// Test CanAny and CanAll
	if !auth.CanAny(ctx, modUserID, serverID, security.PermissionServerDatabaseCreate, security.PermissionServerConsoleRead) {
		t.Errorf("CanAny should succeed if at least one permission matches")
	}
	if auth.CanAll(ctx, modUserID, serverID, security.PermissionServerDatabaseCreate, security.PermissionServerConsoleRead) {
		t.Errorf("CanAll should fail if not all permissions match")
	}
	if !auth.CanAll(ctx, modUserID, serverID, security.PermissionServerPowerStart, security.PermissionServerConsoleRead) {
		t.Errorf("CanAll should succeed if all permissions match")
	}

	// Test EffectivePermissions
	eff, err := auth.EffectivePermissions(ctx, customUserID, serverID)
	if err != nil {
		t.Fatalf("failed to calculate effective permissions: %v", err)
	}
	if !eff.Has(security.PermissionServerPowerStart) {
		t.Errorf("effective perms missing power start")
	}
	if !eff.Has(security.PermissionServerFilesRead) {
		t.Errorf("effective perms missing direct files read")
	}

	// Test Revoke Role
	err = auth.RevokeRole(ctx, serverID, modUserID)
	if err != nil {
		t.Fatalf("failed to revoke role: %v", err)
	}
	if auth.Can(ctx, modUserID, serverID, security.PermissionServerConsoleRead) {
		t.Errorf("revoked user should not have permissions")
	}

	// Test ListAssignmentsForServer & ListAssignmentsForUser
	srvAssigns, err := store.ListAssignmentsForServer(ctx, serverID)
	if err != nil || len(srvAssigns) == 0 {
		t.Errorf("expected assignments for server, got: %v", err)
	}

	usrAssigns, err := store.ListAssignmentsForUser(ctx, adminUserID)
	if err != nil || len(usrAssigns) == 0 {
		t.Errorf("expected assignments for admin user, got: %v", err)
	}

	// Test ListServerRoles
	srvRoles, err := store.ListServerRoles(ctx, serverID)
	if err != nil || len(srvRoles) == 0 {
		t.Errorf("expected server roles, got: %v", err)
	}

	// Test EffectivePermissions for SuperAdmin and Owner
	adminEff, err := auth.EffectivePermissions(ctx, superAdminID, serverID)
	if err != nil || !adminEff.Has(security.PermissionAll) {
		t.Errorf("expected superadmin effective permissions to have *")
	}

	ownerEff, err := auth.EffectivePermissions(ctx, ownerUserID, serverID)
	if err != nil || !ownerEff.Has(security.PermissionServerAll) {
		t.Errorf("expected owner effective permissions to have server.*")
	}

	emptyEff, err := auth.EffectivePermissions(ctx, "nonexistent", "")
	if err != nil || emptyEff.Len() != 0 {
		t.Errorf("expected empty permissions for unauthenticated user with no server")
	}
}
