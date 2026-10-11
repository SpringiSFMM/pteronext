package services

import (
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
	if err := f.db.Preload("Node").Where("uuid = ?", serverUUID).First(&server).Error; err != nil {
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

	// Seed default server files if newly created / empty
	f.ensureDefaultFiles(baseDir)

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

func (f *FileService) ensureDefaultFiles(baseDir string) {
	entries, err := os.ReadDir(baseDir)
	if err != nil || len(entries) > 0 {
		return
	}

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
	}
	return editableExts[ext] || name == "eula.txt" || name == "server.properties"
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

	for _, name := range files {
		target, err := f.resolveSafePath(baseDir, filepath.Join(root, name))
		if err != nil {
			continue
		}
		_ = os.RemoveAll(target)
	}
	return nil
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
