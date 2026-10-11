package security_test

import (
	"testing"

	"github.com/pteronext/panel-core/pkg/security"
)

func TestPermissionMatching(t *testing.T) {
	tests := []struct {
		name     string
		pattern  security.Permission
		target   security.Permission
		expected bool
	}{
		{
			name:     "Exact match",
			pattern:  security.PermissionServerPower,
			target:   security.PermissionServerPower,
			expected: true,
		},
		{
			name:     "Global wildcard matches anything",
			pattern:  security.PermissionAll,
			target:   security.PermissionServerPower,
			expected: true,
		},
		{
			name:     "Global wildcard matches admin",
			pattern:  security.PermissionAll,
			target:   security.PermissionAdminNodes,
			expected: true,
		},
		{
			name:     "Server wildcard matches server power",
			pattern:  security.PermissionServerAll,
			target:   security.PermissionServerPowerStart,
			expected: true,
		},
		{
			name:     "Server wildcard does not match admin nodes",
			pattern:  security.PermissionServerAll,
			target:   security.PermissionAdminNodes,
			expected: false,
		},
		{
			name:     "General power permission matches sub-action start",
			pattern:  security.PermissionServerPower,
			target:   security.PermissionServerPowerStart,
			expected: true,
		},
		{
			name:     "General power permission matches sub-action restart",
			pattern:  security.PermissionServerPower,
			target:   security.PermissionServerPowerRestart,
			expected: true,
		},
		{
			name:     "Sub-action start does not match sub-action stop",
			pattern:  security.PermissionServerPowerStart,
			target:   security.PermissionServerPowerStop,
			expected: false,
		},
		{
			name:     "Sub-action start does not match parent power",
			pattern:  security.PermissionServerPowerStart,
			target:   security.PermissionServerPower,
			expected: false,
		},
		{
			name:     "Admin wildcard matches admin users",
			pattern:  security.PermissionAdminAll,
			target:   security.PermissionAdminUsersRead,
			expected: true,
		},
		{
			name:     "Files read does not match files write",
			pattern:  security.PermissionServerFilesRead,
			target:   security.PermissionServerFilesWrite,
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := security.Match(tc.pattern, tc.target)
			if got != tc.expected {
				t.Errorf("Match(%q, %q) = %v; want %v", tc.pattern, tc.target, got, tc.expected)
			}
		})
	}
}

func TestPermissionSet(t *testing.T) {
	set := security.NewPermissionSet(
		security.PermissionServerPower,
		security.PermissionServerFilesRead,
	)

	if !set.Has(security.PermissionServerPower) {
		t.Errorf("expected set to have server.power")
	}
	if !set.Has(security.PermissionServerPowerStart) {
		t.Errorf("expected set to have server.power.start via hierarchy")
	}
	if !set.Has(security.PermissionServerFilesRead) {
		t.Errorf("expected set to have server.files.read")
	}
	if set.Has(security.PermissionServerFilesWrite) {
		t.Errorf("did not expect set to have server.files.write")
	}

	// Add permission
	set.Add(security.PermissionServerFilesWrite)
	if !set.Has(security.PermissionServerFilesWrite) {
		t.Errorf("expected set to have server.files.write after Add")
	}

	// Remove permission
	set.Remove(security.PermissionServerFilesWrite)
	if set.Has(security.PermissionServerFilesWrite) {
		t.Errorf("did not expect set to have server.files.write after Remove")
	}

	// HasAll and HasAny
	if !set.HasAny(security.PermissionServerFilesWrite, security.PermissionServerPower) {
		t.Errorf("HasAny should return true")
	}
	if set.HasAll(security.PermissionServerFilesWrite, security.PermissionServerPower) {
		t.Errorf("HasAll should return false")
	}
	if !set.HasAll(security.PermissionServerPower, security.PermissionServerFilesRead) {
		t.Errorf("HasAll should return true for held permissions")
	}

	// Slices
	if len(set.Slice()) != 2 {
		t.Errorf("expected 2 elements in slice, got %d", len(set.Slice()))
	}
	if len(set.Strings()) != 2 {
		t.Errorf("expected 2 strings, got %d", len(set.Strings()))
	}
}

func TestPermissionValidation(t *testing.T) {
	valid := []security.Permission{
		security.PermissionAll,
		security.PermissionServerPower,
		security.PermissionServerFilesRead,
		security.PermissionAdminNodes,
	}

	for _, p := range valid {
		if err := security.Validate(p); err != nil {
			t.Errorf("expected %q to be valid, got: %v", p, err)
		}
	}

	invalid := []security.Permission{
		"",
		"server",
		"invalid..perm",
		"singleword",
	}

	for _, p := range invalid {
		if err := security.Validate(p); err == nil {
			t.Errorf("expected %q to be invalid, got nil error", p)
		}
	}
}

func TestRegistry(t *testing.T) {
	reg := security.DefaultRegistry()

	desc, ok := reg.Get(security.PermissionServerPower)
	if !ok {
		t.Fatalf("expected descriptor for server.power")
	}
	if desc.Scope != security.ScopeServer {
		t.Errorf("expected server scope, got %q", desc.Scope)
	}

	if !reg.Exists(security.PermissionAdminNodes) {
		t.Errorf("expected admin.nodes to exist")
	}

	serverPerms := reg.ByScope(security.ScopeServer)
	if len(serverPerms) == 0 {
		t.Errorf("expected non-empty server permissions list")
	}

	adminPerms := reg.ByScope(security.ScopeAdmin)
	if len(adminPerms) == 0 {
		t.Errorf("expected non-empty admin permissions list")
	}

	all := reg.All()
	if len(all) == 0 {
		t.Errorf("expected non-empty All() list")
	}

	// Register custom descriptor
	customPerm := security.Permission("custom.plugin.manage")
	reg.Register(security.PermissionDescriptor{
		Permission:  customPerm,
		Scope:       security.ScopeServer,
		Category:    "Plugins",
		Name:        "Manage Plugins",
		Description: "Allows configuring plugins",
	})
	if !reg.Exists(customPerm) {
		t.Errorf("expected custom permission to exist after registration")
	}
}

func TestMatchesAnyAndHelpers(t *testing.T) {
	patterns := []security.Permission{
		security.PermissionServerFilesRead,
		security.PermissionServerPower,
	}

	if !security.MatchesAny(patterns, security.PermissionServerPowerStart) {
		t.Errorf("expected MatchesAny to match sub-action")
	}
	if security.MatchesAny(patterns, security.PermissionAdminNodes) {
		t.Errorf("MatchesAny should not match unrelated permission")
	}

	set := security.NewPermissionSet(security.PermissionServerPower)
	if set.Len() != 1 {
		t.Errorf("expected set.Len() == 1, got %d", set.Len())
	}
	if security.PermissionServerPower.String() != "server.power" {
		t.Errorf("expected String() 'server.power'")
	}
}

