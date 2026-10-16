package services

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pteronext/panel-core/models"
	"gorm.io/gorm"
)

type FileItem struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"` // "file" or "directory"
	Size        int64  `json:"size"`
	Modified    string `json:"modified"`
	Permissions string `json:"permissions"`
	Editable    bool   `json:"editable"`
	IsLocked    bool   `json:"is_locked"`
	Content     string `json:"content,omitempty"`
}

type FileService struct {
	db      *gorm.DB
	dataDir string
}

func NewFileService(db *gorm.DB, dataDir string) *FileService {
	if dataDir == "" {
		dataDir = "./data"
	}
	return &FileService{
		db:      db,
		dataDir: dataDir,
	}
}

// GetServerBaseDir safely resolves and initializes the filesystem volume for a server.
func (f *FileService) GetServerBaseDir(serverUUID string) (string, error) {
	var server models.Server
	if err := f.db.Preload("Node").Preload("Egg").Preload("Nest").Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
		return "", fmt.Errorf("server not found: %w", err)
	}

	var baseDir string
	if server.Node != nil && server.Node.DaemonBaseDir != "" {
		candidate := filepath.Join(server.Node.DaemonBaseDir, serverUUID)
		// Check if writable or can be created
		if err := os.MkdirAll(candidate, 0777); err == nil {
			baseDir = candidate
		}
	}

	if baseDir == "" {
		baseDir = filepath.Join(f.dataDir, "servers", serverUUID)
		if err := os.MkdirAll(baseDir, 0777); err != nil {
			return "", fmt.Errorf("could not create server directory: %w", err)
		}
	}

	// Auto-migrate files from legacy server directory if baseDir is under /var/lib/pterodactyl/volumes
	legacyDirs := []string{
		filepath.Join(f.dataDir, "servers", serverUUID),
		filepath.Join("/var/lib/pterodactyl", serverUUID),
	}
	for _, leg := range legacyDirs {
		if leg != baseDir {
			if entries, err := os.ReadDir(leg); err == nil && len(entries) > 0 {
				for _, entry := range entries {
					srcPath := filepath.Join(leg, entry.Name())
					dstPath := filepath.Join(baseDir, entry.Name())
					if _, statErr := os.Stat(dstPath); os.IsNotExist(statErr) {
						_ = copyPath(srcPath, dstPath)
					}
				}
			}
		}
	}

	// Seed default server files ONLY once upon initial server creation/first setup
	f.ensureDefaultFilesOnce(&server, baseDir)

	return baseDir, nil
}

func copyPath(src, dst string) error {
	fi, err := os.Stat(src)
	if err != nil {
		return err
	}
	if fi.IsDir() {
		if err := os.MkdirAll(dst, 0777); err != nil {
			return err
		}
		entries, err := os.ReadDir(src)
		if err != nil {
			return err
		}
		for _, e := range entries {
			if err := copyPath(filepath.Join(src, e.Name()), filepath.Join(dst, e.Name())); err != nil {
				return err
			}
		}
		return nil
	}
	// Regular file
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0777); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0777)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// isMinecraftServer determines if the server is a Minecraft server based on its egg, nest, image, and metadata.
func isMinecraftServer(server *models.Server) bool {
	if server == nil {
		return false
	}

	// Explicit Discord bots or generic bots are never Minecraft
	if isDiscordOrBotServer(server) {
		return false
	}

	if strings.EqualFold(server.EggCategory, "minecraft") || strings.EqualFold(server.NestSlug, "minecraft") {
		return true
	}

	if server.Egg != nil {
		if strings.EqualFold(server.Egg.Category, "minecraft") || server.Egg.GetCategory() == "minecraft" {
			return true
		}
		eggName := strings.ToLower(server.Egg.Name)
		for _, kw := range []string{"minecraft", "paper", "spigot", "purpur", "forge", "fabric", "bedrock", "bungeecord", "velocity", "waterfall", "sponge"} {
			if strings.Contains(eggName, kw) {
				return true
			}
		}
	}

	if server.Nest != nil {
		nestStr := strings.ToLower(server.Nest.Name + " " + server.Nest.Slug)
		if strings.Contains(nestStr, "minecraft") {
			return true
		}
	}

	img := strings.ToLower(server.Image)
	for _, kw := range []string{"minecraft", "paper", "spigot", "purpur", "forge", "fabric", "bedrock", "bungeecord", "velocity", "waterfall", "sponge"} {
		if strings.Contains(img, kw) {
			return true
		}
	}

	name := strings.ToLower(server.Name)
	if strings.Contains(name, "minecraft") || strings.Contains(name, "papermc") {
		return true
	}

	return false
}

// isDiscordOrBotServer determines if the server is a Discord bot or generic bot.
func isDiscordOrBotServer(server *models.Server) bool {
	if server == nil {
		return false
	}
	if strings.EqualFold(server.EggCategory, "bot") || strings.EqualFold(server.NestSlug, "bot") || strings.EqualFold(server.NestSlug, "bots") {
		return true
	}
	if server.Egg != nil {
		eggName := strings.ToLower(server.Egg.Name)
		if strings.Contains(eggName, "discord") || strings.Contains(eggName, "bot") {
			return true
		}
		if server.Egg.GetCategory() == "bot" {
			return true
		}
	}
	if server.Nest != nil {
		nestStr := strings.ToLower(server.Nest.Name + " " + server.Nest.Slug)
		if strings.Contains(nestStr, "bot") || strings.Contains(nestStr, "discord") {
			return true
		}
	}
	img := strings.ToLower(server.Image)
	if strings.Contains(img, "discord") || strings.Contains(img, "bot") {
		return true
	}
	name := strings.ToLower(server.Name)
	if strings.Contains(name, "discord") || strings.Contains(name, "bot") {
		return true
	}
	return false
}

// isPythonServer determines if the server is a Python application.
func isPythonServer(server *models.Server) bool {
	if server == nil {
		return false
	}
	img := strings.ToLower(server.Image)
	if strings.Contains(img, "python") || strings.Contains(img, "py") {
		return true
	}
	if server.Egg != nil {
		eggName := strings.ToLower(server.Egg.Name)
		if strings.Contains(eggName, "python") || strings.Contains(eggName, "django") || strings.Contains(eggName, "flask") || strings.Contains(eggName, "fastapi") {
			return true
		}
	}
	startup := strings.ToLower(server.Startup)
	if strings.Contains(startup, "python") || strings.Contains(startup, "pip") {
		return true
	}
	return false
}

// isNodeServer determines if the server is a Node.js application.
func isNodeServer(server *models.Server) bool {
	if server == nil {
		return false
	}
	img := strings.ToLower(server.Image)
	if strings.Contains(img, "node") || strings.Contains(img, "js") {
		return true
	}
	if server.Egg != nil {
		eggName := strings.ToLower(server.Egg.Name)
		if strings.Contains(eggName, "node") || strings.Contains(eggName, "javascript") || strings.Contains(eggName, "typescript") {
			return true
		}
	}
	startup := strings.ToLower(server.Startup)
	if strings.Contains(startup, "node ") || strings.Contains(startup, "npm ") || strings.Contains(startup, "yarn ") {
		return true
	}
	return false
}

// cleanMistakenMinecraftFiles removes accidentally generated default Minecraft files from non-Minecraft servers.
func cleanMistakenMinecraftFiles(baseDir string) {
	propsPath := filepath.Join(baseDir, "server.properties")
	eulaPath := filepath.Join(baseDir, "eula.txt")

	propsData, propsErr := os.ReadFile(propsPath)
	eulaData, eulaErr := os.ReadFile(eulaPath)

	if propsErr == nil && strings.Contains(string(propsData), "A PteroNext Minecraft Server") {
		_ = os.Remove(propsPath)
	}
	if eulaErr == nil && strings.Contains(string(eulaData), "https://aka.ms/MinecraftEULA") {
		_ = os.Remove(eulaPath)
	}

	opsPath := filepath.Join(baseDir, "ops.json")
	if data, err := os.ReadFile(opsPath); err == nil && strings.TrimSpace(string(data)) == "[]" {
		_ = os.Remove(opsPath)
	}
	wlPath := filepath.Join(baseDir, "whitelist.json")
	if data, err := os.ReadFile(wlPath); err == nil && strings.TrimSpace(string(data)) == "[]" {
		_ = os.Remove(wlPath)
	}

	pluginsDir := filepath.Join(baseDir, "plugins")
	if pEntries, err := os.ReadDir(pluginsDir); err == nil && len(pEntries) == 0 {
		_ = os.Remove(pluginsDir)
	}
}

func (f *FileService) ensureDefaultFilesOnce(server *models.Server, baseDir string) {
	markerFile := filepath.Join(baseDir, ".pteronext_initialized")

	// If this is NOT a Minecraft server, purge any erroneously seeded default Minecraft files
	if !isMinecraftServer(server) {
		cleanMistakenMinecraftFiles(baseDir)
	}

	if _, err := os.Stat(markerFile); err == nil {
		// Server has already been initialized, NEVER recreate deleted files!
		return
	}

	entries, err := os.ReadDir(baseDir)
	if err != nil {
		return
	}

	// Filter out the marker file itself and system hidden files when checking if directory is empty
	nonEmpty := false
	for _, entry := range entries {
		if entry.Name() != ".pteronext_initialized" && entry.Name() != ".DS_Store" {
			nonEmpty = true
			break
		}
	}

	// If directory already has files from an existing install or upload, mark it initialized
	if nonEmpty {
		_ = os.WriteFile(markerFile, []byte(time.Now().Format(time.RFC3339)), 0644)
		return
	}

	// Seed files according to server workload type
	if isMinecraftServer(server) {
		// Seed server.properties
		serverProps := `# Minecraft server properties
motd=A PteroNext Minecraft Server
server-port=25565
max-players=20
online-mode=true
pvp=true
difficulty=normal
gamemode=survival
view-distance=10
simulation-distance=8
`
		_ = os.WriteFile(filepath.Join(baseDir, "server.properties"), []byte(serverProps), 0644)

		// Seed eula.txt
		eula := `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
eula=true
`
		_ = os.WriteFile(filepath.Join(baseDir, "eula.txt"), []byte(eula), 0644)

		// Seed ops.json and whitelist.json
		_ = os.WriteFile(filepath.Join(baseDir, "ops.json"), []byte("[]"), 0644)
		_ = os.WriteFile(filepath.Join(baseDir, "whitelist.json"), []byte("[]"), 0644)

		// Seed plugins and logs directories
		_ = os.MkdirAll(filepath.Join(baseDir, "plugins"), 0755)
		_ = os.MkdirAll(filepath.Join(baseDir, "logs"), 0755)
	} else if isPythonServer(server) {
		// Seed Python / Python Discord Bot template
		mainPy := `"""
Application Entrypoint
"""
import os

def main():
    print("Application starting...")

if __name__ == "__main__":
    main()
`
		_ = os.WriteFile(filepath.Join(baseDir, "main.py"), []byte(mainPy), 0644)

		reqTxt := `# Python dependencies
# discord.py>=2.3.0
# python-dotenv>=1.0.0
`
		_ = os.WriteFile(filepath.Join(baseDir, "requirements.txt"), []byte(reqTxt), 0644)

		envExample := `# Application Environment Variables
DISCORD_TOKEN=your_bot_token_here
APP_ENV=production
DEBUG=false
`
		_ = os.WriteFile(filepath.Join(baseDir, ".env.example"), []byte(envExample), 0644)
		_ = os.MkdirAll(filepath.Join(baseDir, "logs"), 0755)
	} else if isDiscordOrBotServer(server) || isNodeServer(server) {
		// Seed Node.js / Discord Bot template
		pkgJSON := `{
  "name": "discord-bot",
  "version": "1.0.0",
  "description": "Discord Bot / Node.js Application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {}
}
`
		_ = os.WriteFile(filepath.Join(baseDir, "package.json"), []byte(pkgJSON), 0644)

		indexJS := `/**
 * Main application entrypoint
 */
console.log('Application starting...');

// Example Discord.js bot snippet:
// const { Client, GatewayIntentBits } = require('discord.js');
// const client = new Client({ intents: [GatewayIntentBits.Guilds] });
// client.on('ready', () => {
//   console.log('Bot is ready and logged in as ' + client.user.tag);
// });
// client.login(process.env.DISCORD_TOKEN);
`
		_ = os.WriteFile(filepath.Join(baseDir, "index.js"), []byte(indexJS), 0644)

		envExample := `# Discord Bot & Node.js Environment Variables
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
PORT=3000
NODE_ENV=production
`
		_ = os.WriteFile(filepath.Join(baseDir, ".env.example"), []byte(envExample), 0644)
		_ = os.MkdirAll(filepath.Join(baseDir, "logs"), 0755)
	}

	// Always write initialization marker so files aren't recreated if deleted by the user
	_ = os.WriteFile(markerFile, []byte(time.Now().Format(time.RFC3339)), 0644)
}

// resolveSafePath verifies against directory traversal
func (f *FileService) resolveSafePath(baseDir, relPath string) (string, error) {
	cleanRel := filepath.Clean("/" + relPath)
	target := filepath.Join(baseDir, cleanRel)
	cleanBase := filepath.Clean(baseDir)
	if target != cleanBase && !strings.HasPrefix(target, cleanBase+string(filepath.Separator)) {
		return "", fmt.Errorf("access denied: path escapes server directory")
	}
	return target, nil
}

// isEditableFile determines whether a file can be opened in the web editor
func isEditableFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	editableExts := map[string]bool{
		".txt": true, ".yml": true, ".yaml": true, ".json": true,
		".properties": true, ".conf": true, ".cfg": true, ".ini": true,
		".log": true, ".sh": true, ".bash": true, ".xml": true,
		".toml": true, ".md": true, ".env": true, ".lua": true,
		".js": true, ".mjs": true, ".cjs": true, ".ts": true,
		".jsx": true, ".tsx": true, ".py": true, ".pyw": true,
		".sql": true, ".example": true, ".gitignore": true,
	}
	base := strings.ToLower(name)
	return editableExts[ext] || base == "eula.txt" || base == "server.properties" || base == "dockerfile" || base == ".env.example" || base == ".gitignore" || base == "procfile"
}

// ListDirectory lists files and folders inside a server directory.
func (f *FileService) ListDirectory(serverUUID, relPath string) ([]FileItem, error) {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return nil, err
	}

	targetDir, err := f.resolveSafePath(baseDir, relPath)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	var items []FileItem
	for _, entry := range entries {
		// Hide internal system markers and OS meta files from user filemanager
		if entry.Name() == ".pteronext_initialized" || entry.Name() == ".DS_Store" {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		itemRelPath := "/" + strings.TrimPrefix(filepath.Join(relPath, entry.Name()), "/")
		itemType := "file"
		if entry.IsDir() {
			itemType = "directory"
		}

		item := FileItem{
			Name:        entry.Name(),
			Path:        itemRelPath,
			Type:        itemType,
			Size:        info.Size(),
			Modified:    formatRelativeTime(info.ModTime()),
			Permissions: info.Mode().String(),
			Editable:    !entry.IsDir() && isEditableFile(entry.Name()),
		}

		// Pre-populate content for small editable files in root for fast initial preview
		if !entry.IsDir() && item.Editable && info.Size() < 32768 && (relPath == "" || relPath == "/") {
			if content, err := os.ReadFile(filepath.Join(targetDir, entry.Name())); err == nil {
				item.Content = string(content)
			}
		}

		items = append(items, item)
	}

	return items, nil
}

func formatRelativeTime(t time.Time) string {
	diff := time.Since(t)
	switch {
	case diff < time.Minute:
		return "Just now"
	case diff < time.Hour:
		return fmt.Sprintf("%d min ago", int(diff.Minutes()))
	case diff < 24*time.Hour:
		return fmt.Sprintf("%d hours ago", int(diff.Hours()))
	case diff < 7*24*time.Hour:
		return fmt.Sprintf("%d days ago", int(diff.Hours()/24))
	default:
		return t.Format("Jan 02, 2006")
	}
}

// GetFileContent reads the text content of a file.
func (f *FileService) GetFileContent(serverUUID, relPath string) (string, error) {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return "", err
	}

	targetPath, err := f.resolveSafePath(baseDir, relPath)
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed reading file: %w", err)
	}

	return string(data), nil
}

// WriteFile writes string content into a file.
func (f *FileService) WriteFile(serverUUID, relPath, content string) error {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	targetPath, err := f.resolveSafePath(baseDir, relPath)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		return err
	}

	return os.WriteFile(targetPath, []byte(content), 0644)
}

// DeleteFiles deletes one or more files / folders inside root.
func (f *FileService) DeleteFiles(serverUUID, root string, files []string) error {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	cleanRoot := filepath.Clean("/" + root)
	var lastErr error
	for _, name := range files {
		cleanName := strings.TrimPrefix(filepath.Clean("/"+name), "/")
		relPath := filepath.Join(cleanRoot, cleanName)
		target, err := f.resolveSafePath(baseDir, relPath)
		if err != nil {
			lastErr = err
			continue
		}
		if removeErr := os.RemoveAll(target); removeErr != nil {
			lastErr = removeErr
		}
	}
	return lastErr
}

// CreateDirectory creates a new subfolder.
func (f *FileService) CreateDirectory(serverUUID, root, name string) error {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	target, err := f.resolveSafePath(baseDir, filepath.Join(root, name))
	if err != nil {
		return err
	}

	return os.MkdirAll(target, 0755)
}

// Rename renames a file or folder.
func (f *FileService) Rename(serverUUID, root, from, to string) error {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	src, err := f.resolveSafePath(baseDir, filepath.Join(root, from))
	if err != nil {
		return err
	}

	dst, err := f.resolveSafePath(baseDir, filepath.Join(root, to))
	if err != nil {
		return err
	}

	return os.Rename(src, dst)
}

// SaveUploadedFile saves an uploaded file stream into the target folder.
func (f *FileService) SaveUploadedFile(serverUUID, root string, name string, r io.Reader) (*FileItem, error) {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return nil, err
	}

	target, err := f.resolveSafePath(baseDir, filepath.Join(root, name))
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return nil, err
	}

	out, err := os.Create(target)
	if err != nil {
		return nil, err
	}
	defer out.Close()

	written, err := io.Copy(out, r)
	if err != nil {
		return nil, err
	}

	relPath := "/" + strings.TrimPrefix(filepath.Join(root, name), "/")
	return &FileItem{
		Name:        name,
		Path:        relPath,
		Type:        "file",
		Size:        written,
		Modified:    "Just now",
		Permissions: "-rw-r--r--",
		Editable:    isEditableFile(name),
	}, nil
}

// InstallMinecraftVersion downloads PaperMC for the selected version and configures eula.txt
func (f *FileService) InstallMinecraftVersion(serverUUID, version, jarFileName string) error {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	if jarFileName == "" {
		jarFileName = "server.jar"
	}

	// Always ensure eula.txt is agreed to
	eulaPath := filepath.Join(baseDir, "eula.txt")
	_ = os.WriteFile(eulaPath, []byte("eula=true\n"), 0644)

	// Fetch PaperMC build info using the v3 fill API
	var downloadUrl string
	verUrl := fmt.Sprintf("https://fill.papermc.io/v3/projects/paper/versions/%s", version)
	req, err := http.NewRequest(http.MethodGet, verUrl, nil)
	if err == nil {
		req.Header.Set("User-Agent", "PteroNext-Panel/1.0 (admin@springisfm.de)")
		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			var verData struct {
				Builds []int `json:"builds"`
			}
			if json.NewDecoder(resp.Body).Decode(&verData) == nil && len(verData.Builds) > 0 {
				latestBuild := verData.Builds[0] // in fill API, builds are ordered newest first!
				buildUrl := fmt.Sprintf("https://fill.papermc.io/v3/projects/paper/versions/%s/builds/%d", version, latestBuild)
				bReq, _ := http.NewRequest(http.MethodGet, buildUrl, nil)
				bReq.Header.Set("User-Agent", "PteroNext-Panel/1.0 (admin@springisfm.de)")
				bResp, err := client.Do(bReq)
				if err == nil && bResp.StatusCode == http.StatusOK {
					var bData struct {
						Downloads map[string]struct {
							URL string `json:"url"`
						} `json:"downloads"`
					}
					if json.NewDecoder(bResp.Body).Decode(&bData) == nil {
						if d, ok := bData.Downloads["server:default"]; ok && d.URL != "" {
							downloadUrl = d.URL
						}
					}
					bResp.Body.Close()
				}
			}
			resp.Body.Close()
		}
	}

	// Fallback to Purpur if Paper version not directly resolved
	if downloadUrl == "" {
		downloadUrl = fmt.Sprintf("https://api.purpurmc.org/v2/purpur/%s/latest/download", version)
	}

	jarFileName = filepath.Base(jarFileName)
	if jarFileName == "" || jarFileName == "." {
		jarFileName = "server.jar"
	}
	targetJarPath, err := f.resolveSafePath(baseDir, jarFileName)
	if err != nil {
		return err
	}
	out, err := os.Create(targetJarPath)
	if err != nil {
		return fmt.Errorf("could not create jarfile: %w", err)
	}
	defer out.Close()

	dlReq, _ := http.NewRequest(http.MethodGet, downloadUrl, nil)
	dlReq.Header.Set("User-Agent", "PteroNext-Panel/1.0 (admin@springisfm.de)")
	dlClient := &http.Client{Timeout: 10 * time.Minute}
	dlResp, err := dlClient.Do(dlReq)
	if err != nil {
		return fmt.Errorf("download request failed: %w", err)
	}
	defer dlResp.Body.Close()

	if dlResp.StatusCode != http.StatusOK {
		return fmt.Errorf("download server returned HTTP %d", dlResp.StatusCode)
	}

	_, err = io.Copy(out, dlResp.Body)
	if err != nil {
		return fmt.Errorf("failed writing jar file: %w", err)
	}

	return nil
}

// DownloadRemoteFile streams a file from a remote HTTP(S) URL into the server directory.
func (f *FileService) DownloadRemoteFile(serverUUID, root, filename, sourceURL string) (*FileItem, error) {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return nil, err
	}

	if root == "" {
		root = "/"
	}
	if filename == "" {
		filename = filepath.Base(sourceURL)
	}

	target, err := f.resolveSafePath(baseDir, filepath.Join(root, filename))
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return nil, err
	}

	parsedURL, err := url.Parse(sourceURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return nil, fmt.Errorf("ungültige Download-URL (nur http/https erlaubt)")
	}

	// Prevent SSRF against loopback and cloud metadata endpoints
	hostname := strings.ToLower(parsedURL.Hostname())
	if hostname == "localhost" || hostname == "127.0.0.1" || hostname == "169.254.169.254" || hostname == "::1" {
		return nil, fmt.Errorf("remote download from internal or metadata hosts is forbidden")
	}
	if ips, err := net.LookupIP(hostname); err == nil {
		for _, ip := range ips {
			if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsPrivate() {
				return nil, fmt.Errorf("remote download from private IP ranges is forbidden")
			}
		}
	}

	client := &http.Client{Timeout: 5 * time.Minute}
	req, err := http.NewRequest(http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "PteroNext-Panel/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("remote download request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("remote download failed with HTTP %d", resp.StatusCode)
	}

	out, err := os.Create(target)
	if err != nil {
		return nil, fmt.Errorf("could not create target file: %w", err)
	}
	defer out.Close()

	written, err := io.Copy(out, resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed saving downloaded content: %w", err)
	}

	relPath := "/" + strings.TrimPrefix(filepath.Join(root, filename), "/")
	return &FileItem{
		Name:        filename,
		Path:        relPath,
		Type:        "file",
		Size:        written,
		Modified:    "Just now",
		Permissions: "-rw-r--r--",
		Editable:    isEditableFile(filename),
	}, nil
}

// CompressFiles archives multiple files or directories into a zip or tar.gz file.
func (f *FileService) CompressFiles(serverUUID, root string, files []string, archiveName string) (*FileItem, error) {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return nil, err
	}

	rootPath, err := f.resolveSafePath(baseDir, root)
	if err != nil {
		return nil, err
	}

	if archiveName == "" {
		archiveName = fmt.Sprintf("archive-%s.tar.gz", time.Now().Format("20060102-150405"))
	}
	archiveName = filepath.Base(archiveName)

	targetArchiveFile, err := f.resolveSafePath(baseDir, filepath.Join(root, archiveName))
	if err != nil {
		return nil, err
	}

	outFile, err := os.Create(targetArchiveFile)
	if err != nil {
		return nil, fmt.Errorf("failed to create archive destination file: %w", err)
	}
	defer outFile.Close()

	isZip := strings.HasSuffix(strings.ToLower(archiveName), ".zip")

	if isZip {
		zipWriter := zip.NewWriter(outFile)
		defer zipWriter.Close()

		for _, relItem := range files {
			itemSafePath, err := f.resolveSafePath(baseDir, filepath.Join(root, relItem))
			if err != nil {
				continue
			}

			info, statErr := os.Stat(itemSafePath)
			if statErr != nil {
				continue
			}

			if info.IsDir() {
				filepath.Walk(itemSafePath, func(p string, fi os.FileInfo, walkErr error) error {
					if walkErr != nil || fi.IsDir() {
						return nil
					}
					relInArchive, _ := filepath.Rel(rootPath, p)
					header, err := zip.FileInfoHeader(fi)
					if err != nil {
						return nil
					}
					header.Name = filepath.ToSlash(relInArchive)
					header.Method = zip.Deflate

					w, err := zipWriter.CreateHeader(header)
					if err != nil {
						return nil
					}
					rf, err := os.Open(p)
					if err != nil {
						return nil
					}
					defer rf.Close()
					_, _ = io.Copy(w, rf)
					return nil
				})
			} else {
				header, err := zip.FileInfoHeader(info)
				if err != nil {
					continue
				}
				header.Name = filepath.ToSlash(relItem)
				header.Method = zip.Deflate

				w, err := zipWriter.CreateHeader(header)
				if err != nil {
					continue
				}
				rf, err := os.Open(itemSafePath)
				if err != nil {
					continue
				}
				_, _ = io.Copy(w, rf)
				rf.Close()
			}
		}
	} else {
		// Tar.gz compression
		gw := gzip.NewWriter(outFile)
		defer gw.Close()
		tw := tar.NewWriter(gw)
		defer tw.Close()

		for _, relItem := range files {
			itemSafePath, err := f.resolveSafePath(baseDir, filepath.Join(root, relItem))
			if err != nil {
				continue
			}

			info, statErr := os.Stat(itemSafePath)
			if statErr != nil {
				continue
			}

			if info.IsDir() {
				filepath.Walk(itemSafePath, func(p string, fi os.FileInfo, walkErr error) error {
					if walkErr != nil {
						return nil
					}
					relInArchive, _ := filepath.Rel(rootPath, p)
					header, err := tar.FileInfoHeader(fi, fi.Name())
					if err != nil {
						return nil
					}
					header.Name = filepath.ToSlash(relInArchive)
					if err := tw.WriteHeader(header); err != nil {
						return nil
					}
					if fi.IsDir() {
						return nil
					}
					rf, err := os.Open(p)
					if err != nil {
						return nil
					}
					defer rf.Close()
					_, _ = io.Copy(tw, rf)
					return nil
				})
			} else {
				header, err := tar.FileInfoHeader(info, info.Name())
				if err != nil {
					continue
				}
				header.Name = filepath.ToSlash(relItem)
				if err := tw.WriteHeader(header); err != nil {
					continue
				}
				rf, err := os.Open(itemSafePath)
				if err != nil {
					continue
				}
				_, _ = io.Copy(tw, rf)
				rf.Close()
			}
		}
	}

	// Close open handles before inspecting size
	_ = outFile.Sync()
	fi, _ := os.Stat(targetArchiveFile)
	var finalSize int64
	if fi != nil {
		finalSize = fi.Size()
	}

	archiveRelPath := "/" + strings.TrimPrefix(filepath.Join(root, archiveName), "/")
	return &FileItem{
		Name:        archiveName,
		Path:        archiveRelPath,
		Type:        "file",
		Size:        finalSize,
		Modified:    "Just now",
		Permissions: "-rw-r--r--",
		Editable:    false,
	}, nil
}

// DecompressFile uncompresses a .zip or .tar.gz archive into root.
func (f *FileService) DecompressFile(serverUUID, root string, fileName string) error {
	baseDir, err := f.GetServerBaseDir(serverUUID)
	if err != nil {
		return err
	}

	targetArchiveFile, err := f.resolveSafePath(baseDir, filepath.Join(root, fileName))
	if err != nil {
		return err
	}

	extractDest, err := f.resolveSafePath(baseDir, root)
	if err != nil {
		return err
	}

	// Bounds against Zip/Decompression bombs
	const maxFileSize = 2 * 1024 * 1024 * 1024       // 2 GB per single file
	const maxTotalSize = 10 * 1024 * 1024 * 1024     // 10 GB total uncompressed
	const maxFiles = 50000                           // Max files in archive

	lower := strings.ToLower(fileName)
	if strings.HasSuffix(lower, ".zip") {
		r, err := zip.OpenReader(targetArchiveFile)
		if err != nil {
			return fmt.Errorf("invalid zip archive: %w", err)
		}
		defer r.Close()

		var totalUncompressed int64
		var fileCount int

		for _, zf := range r.File {
			fileCount++
			if fileCount > maxFiles {
				return fmt.Errorf("archive contains too many files (max %d)", maxFiles)
			}

			cleanPath := filepath.Clean(zf.Name)
			if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) || strings.Contains(cleanPath, "/../") {
				continue
			}
			destPath := filepath.Join(extractDest, cleanPath)
			// Ensure destPath remains inside extractDest
			if !strings.HasPrefix(destPath, filepath.Clean(extractDest)+string(filepath.Separator)) && destPath != extractDest {
				continue
			}

			if zf.FileInfo().IsDir() {
				_ = os.MkdirAll(destPath, 0755)
				continue
			}
			_ = os.MkdirAll(filepath.Dir(destPath), 0755)
			rc, err := zf.Open()
			if err != nil {
				continue
			}
			out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, zf.Mode())
			if err == nil {
				// nosemgrep: go.lang.security.decompression_bomb.potential-dos-via-decompression-bomb – Enforced bounds via io.CopyN and aggregate size tracker
				written, _ := io.CopyN(out, rc, maxFileSize+1)
				out.Close()
				if written > maxFileSize {
					rc.Close()
					_ = os.Remove(destPath)
					return fmt.Errorf("decompression exceeded maximum file limit of %d bytes", maxFileSize)
				}
				totalUncompressed += written
				if totalUncompressed > maxTotalSize {
					rc.Close()
					return fmt.Errorf("decompression exceeded maximum total size limit of %d bytes", maxTotalSize)
				}
			}
			rc.Close()
		}
		return nil
	}

	// Tar.gz extraction
	fIn, err := os.Open(targetArchiveFile)
	if err != nil {
		return fmt.Errorf("could not open archive: %w", err)
	}
	defer fIn.Close()

	var tr *tar.Reader
	if strings.HasSuffix(lower, ".gz") || strings.HasSuffix(lower, ".tgz") {
		gz, err := gzip.NewReader(fIn)
		if err != nil {
			return fmt.Errorf("invalid gzip compression: %w", err)
		}
		defer gz.Close()
		tr = tar.NewReader(gz)
	} else {
		tr = tar.NewReader(fIn)
	}

	var totalUncompressed int64
	var fileCount int

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		fileCount++
		if fileCount > maxFiles {
			return fmt.Errorf("archive contains too many files (max %d)", maxFiles)
		}

		cleanPath := filepath.Clean(header.Name)
		if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) || strings.Contains(cleanPath, "/../") {
			continue
		}
		destPath := filepath.Join(extractDest, cleanPath)
		// Ensure destPath remains inside extractDest
		if !strings.HasPrefix(destPath, filepath.Clean(extractDest)+string(filepath.Separator)) && destPath != extractDest {
			continue
		}

		switch header.Typeflag {
		case tar.TypeDir:
			_ = os.MkdirAll(destPath, 0755)
		case tar.TypeReg, tar.TypeRegA:
			_ = os.MkdirAll(filepath.Dir(destPath), 0755)
			out, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(header.Mode))
			if err == nil {
				// nosemgrep: go.lang.security.decompression_bomb.potential-dos-via-decompression-bomb – Enforced bounds via io.CopyN and aggregate size tracker
				written, _ := io.CopyN(out, tr, maxFileSize+1)
				out.Close()
				if written > maxFileSize {
					_ = os.Remove(destPath)
					return fmt.Errorf("decompression exceeded maximum file limit of %d bytes", maxFileSize)
				}
				totalUncompressed += written
				if totalUncompressed > maxTotalSize {
					return fmt.Errorf("decompression exceeded maximum total size limit of %d bytes", maxTotalSize)
				}
			}
		}
	}

	return nil
}
