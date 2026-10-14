package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIsVersionGreater(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected bool
	}{
		{"v2.9.1", "v2.9.0", true},
		{"v3.0.0", "v2.9.0", true},
		{"v2.9.0", "v2.9.0", false},
		{"v2.8.8", "v2.9.0", false},
		{"v2.9.0", "v2.8.8", true},
		{"2.9.1", "2.9.0", true},
	}

	for _, tt := range tests {
		result := isVersionGreater(tt.v1, tt.v2)
		if result != tt.expected {
			t.Errorf("isVersionGreater(%s, %s) = %v; want %v", tt.v1, tt.v2, result, tt.expected)
		}
	}
}

func TestRunUpdateDryRun(t *testing.T) {
	tmpDir := t.TempDir()
	fakeDB := filepath.Join(tmpDir, "pteronext.db")
	if err := os.WriteFile(fakeDB, []byte("SQLite format 3\x00test"), 0644); err != nil {
		t.Fatalf("Failed to create fake db: %v", err)
	}

	// Dry run with custom db
	args := []string{"update", "--dry-run", "--force", "--db", fakeDB, "--no-restart"}
	err := RunUpdate(args, fakeDB)
	if err != nil {
		t.Fatalf("RunUpdate failed in dry-run mode: %v", err)
	}

	// Verify the original database is still completely intact
	data, err := os.ReadFile(fakeDB)
	if err != nil {
		t.Fatalf("Failed to read original DB after update dry-run: %v", err)
	}
	if string(data) != "SQLite format 3\x00test" {
		t.Fatalf("Original DB content was altered: got %q", string(data))
	}
}

func TestRunUpdateCheckOnly(t *testing.T) {
	args := []string{"update", "--check"}
	err := RunUpdate(args, "")
	if err != nil {
		t.Fatalf("RunUpdate failed in check-only mode: %v", err)
	}
}

func TestCopyFileSecure(t *testing.T) {
	tmpDir := t.TempDir()
	src := filepath.Join(tmpDir, "source.db")
	dst := filepath.Join(tmpDir, "dest.db")

	testContent := "test-database-content-12345"
	if err := os.WriteFile(src, []byte(testContent), 0600); err != nil {
		t.Fatalf("Failed to write source file: %v", err)
	}

	if err := copyFileSecure(src, dst); err != nil {
		t.Fatalf("copyFileSecure failed: %v", err)
	}

	data, err := os.ReadFile(dst)
	if err != nil {
		t.Fatalf("Failed to read dest file: %v", err)
	}
	if string(data) != testContent {
		t.Fatalf("Content mismatch: got %q, want %q", string(data), testContent)
	}

	// Verify permissions
	fi, _ := os.Stat(dst)
	if fi.Mode().Perm() != 0600 {
		t.Errorf("Unexpected permissions on copy: %v", fi.Mode().Perm())
	}
}
