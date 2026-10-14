package services

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/pteronext/panel-core/models"
)

func TestEnsureDefaultFilesOnce_Minecraft(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "pteronext_mc_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	fs := &FileService{}
	mcServer := &models.Server{
		Name:  "My PaperMC Server",
		Image: "ghcr.io/pterodactyl/yolks:java_21",
		Egg: &models.Egg{
			Name:     "Paper",
			Category: "minecraft",
		},
	}

	fs.ensureDefaultFilesOnce(mcServer, tmpDir)

	// Verify Minecraft files exist
	expectedFiles := []string{
		"server.properties",
		"eula.txt",
		"ops.json",
		"whitelist.json",
		"plugins",
		"logs",
		".pteronext_initialized",
	}

	for _, f := range expectedFiles {
		p := filepath.Join(tmpDir, f)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			t.Errorf("expected %s to exist for Minecraft server, but it was not found", f)
		}
	}
}

func TestEnsureDefaultFilesOnce_DiscordBot(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "pteronext_discord_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	fs := &FileService{}
	botServer := &models.Server{
		Name:  "My Discord Bot",
		Image: "ghcr.io/pterodactyl/yolks:nodejs_20",
		Egg: &models.Egg{
			Name:     "Discord Bot (Node.js)",
			Category: "bot",
		},
	}

	fs.ensureDefaultFilesOnce(botServer, tmpDir)

	// Verify Minecraft files DO NOT exist
	forbiddenFiles := []string{
		"server.properties",
		"eula.txt",
		"ops.json",
		"whitelist.json",
		"plugins",
	}

	for _, f := range forbiddenFiles {
		p := filepath.Join(tmpDir, f)
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Errorf("forbidden file %s MUST NOT exist for Discord bot server!", f)
		}
	}

	// Verify Discord Bot files exist
	expectedFiles := []string{
		"package.json",
		"index.js",
		".env.example",
		"logs",
		".pteronext_initialized",
	}

	for _, f := range expectedFiles {
		p := filepath.Join(tmpDir, f)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			t.Errorf("expected %s to exist for Discord bot server, but it was not found", f)
		}
	}
}

func TestEnsureDefaultFilesOnce_PythonBot(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "pteronext_python_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	fs := &FileService{}
	pyServer := &models.Server{
		Name:  "Python Bot Server",
		Image: "ghcr.io/pterodactyl/yolks:python_3.11",
		Egg: &models.Egg{
			Name:     "Discord Bot (Python)",
			Category: "bot",
		},
	}

	fs.ensureDefaultFilesOnce(pyServer, tmpDir)

	// Verify Minecraft files DO NOT exist
	if _, err := os.Stat(filepath.Join(tmpDir, "server.properties")); !os.IsNotExist(err) {
		t.Errorf("server.properties MUST NOT exist for Python bot server")
	}

	// Verify Python files exist
	expectedFiles := []string{
		"main.py",
		"requirements.txt",
		".env.example",
		".pteronext_initialized",
	}

	for _, f := range expectedFiles {
		p := filepath.Join(tmpDir, f)
		if _, err := os.Stat(p); os.IsNotExist(err) {
			t.Errorf("expected %s to exist for Python server, but it was not found", f)
		}
	}
}

func TestCleanMistakenMinecraftFiles(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "pteronext_clean_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Seed mistaken Minecraft files
	_ = os.WriteFile(filepath.Join(tmpDir, "server.properties"), []byte("motd=A PteroNext Minecraft Server\n"), 0644)
	_ = os.WriteFile(filepath.Join(tmpDir, "eula.txt"), []byte("https://aka.ms/MinecraftEULA\neula=true\n"), 0644)
	_ = os.WriteFile(filepath.Join(tmpDir, "ops.json"), []byte("[]"), 0644)
	_ = os.WriteFile(filepath.Join(tmpDir, "whitelist.json"), []byte("[]"), 0644)
	_ = os.MkdirAll(filepath.Join(tmpDir, "plugins"), 0755)

	cleanMistakenMinecraftFiles(tmpDir)

	// All default Minecraft files should be gone
	for _, f := range []string{"server.properties", "eula.txt", "ops.json", "whitelist.json", "plugins"} {
		if _, err := os.Stat(filepath.Join(tmpDir, f)); !os.IsNotExist(err) {
			t.Errorf("%s was not properly cleaned up", f)
		}
	}
}
