package controllers

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/middleware"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

// DeveloperController handles developer suite actions: .env Secret Vault, Git Webhook Auto-Deploy, and Package Manager operations.
type DeveloperController struct {
	db          *gorm.DB
	fileService *services.FileService
	wingsClient *services.WingsClient
}

// NewDeveloperController creates a new DeveloperController instance.
func NewDeveloperController(db *gorm.DB, fileService *services.FileService, wingsClient *services.WingsClient) *DeveloperController {
	return &DeveloperController{
		db:          db,
		fileService: fileService,
		wingsClient: wingsClient,
	}
}

// EnvEntry represents a single parsed environment variable from a .env file.
type EnvEntry struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	MaskedValue string `json:"masked_value"`
	IsSecret    bool   `json:"is_secret"`
	Comment     string `json:"comment,omitempty"`
}

// isSecretKey checks if a variable name corresponds to sensitive credentials.
func isSecretKey(key string) bool {
	upper := strings.ToUpper(key)
	secretIndicators := []string{
		"SECRET", "PASS", "PASSWORD", "KEY", "TOKEN", "AUTH",
		"PRIVATE", "CREDENTIAL", "APIKEY", "API_KEY", "WEBHOOK",
		"DATABASE_URL", "DB_PASS", "REDIS_URL", "CERT", "SALT",
		"HASH", "SIGNATURE", "CERTIFICATE", "SESSION", "BEARER",
	}
	for _, ind := range secretIndicators {
		if strings.Contains(upper, ind) {
			return true
		}
	}
	return false
}

// maskValue generates a masked representation for sensitive values.
func maskValue(val string) string {
	if len(val) == 0 {
		return ""
	}
	if len(val) <= 4 {
		return "••••"
	}
	return "••••••••"
}

// parseEnv reads lines and extracts key-value pairs, comments, and secret flags.
func parseEnv(content string) []EnvEntry {
	var entries []EnvEntry
	scanner := bufio.NewScanner(strings.NewReader(content))
	var lastComment string

	for scanner.Scan() {
		rawLine := scanner.Text()
		line := strings.TrimSpace(rawLine)
		if line == "" {
			lastComment = ""
			continue
		}
		if strings.HasPrefix(line, "#") {
			comment := strings.TrimSpace(strings.TrimPrefix(line, "#"))
			if lastComment == "" {
				lastComment = comment
			} else {
				lastComment = lastComment + "\n" + comment
			}
			continue
		}

		cleanLine := strings.TrimPrefix(line, "export ")
		parts := strings.SplitN(cleanLine, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])

			// Strip wrapping quotes
			if (strings.HasPrefix(v, `"`) && strings.HasSuffix(v, `"`)) ||
				(strings.HasPrefix(v, `'`) && strings.HasSuffix(v, `'`)) {
				if len(v) >= 2 {
					v = v[1 : len(v)-1]
				}
			}

			secret := isSecretKey(k)
			entries = append(entries, EnvEntry{
				Key:         k,
				Value:       v,
				MaskedValue: maskValue(v),
				IsSecret:    secret,
				Comment:     lastComment,
			})
			lastComment = ""
		}
	}
	return entries
}

// GetEnv handles GET /api/servers/:uuid/env
// Reads the server's .env file and returns parsed key-value list with metadata.
func (d *DeveloperController) GetEnv(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	content, err := d.fileService.GetFileContent(server.UUID, ".env")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"entries": []EnvEntry{},
			"raw":     "",
			"exists":  false,
			"total":   0,
		})
		return
	}

	entries := parseEnv(content)
	shouldMask := c.Query("mask") == "true"

	if shouldMask {
		for i := range entries {
			if entries[i].IsSecret {
				entries[i].Value = entries[i].MaskedValue
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
		"raw":     content,
		"exists":  true,
		"total":   len(entries),
	})
}

// SaveEnvRequest defines the payload for saving .env configurations.
type SaveEnvRequest struct {
	Entries []EnvEntry        `json:"entries"`
	Content string            `json:"content"`
	Env     map[string]string `json:"env"`
}

// SaveEnv handles POST /api/servers/:uuid/env
// Atomically writes key-value pairs back to .env with automatic Time-Machine FileRevision snapshot.
func (d *DeveloperController) SaveEnv(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	var req SaveEnvRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	var newContent string
	if strings.TrimSpace(req.Content) != "" {
		newContent = req.Content
	} else if len(req.Entries) > 0 {
		var sb strings.Builder
		for _, e := range req.Entries {
			k := strings.TrimSpace(e.Key)
			if k == "" {
				continue
			}
			if e.Comment != "" {
				lines := strings.Split(e.Comment, "\n")
				for _, cl := range lines {
					sb.WriteString("# " + strings.TrimSpace(cl) + "\n")
				}
			}
			v := e.Value
			if strings.ContainsAny(v, " \t\n\"'#$") {
				v = `"` + strings.ReplaceAll(v, `"`, `\"`) + `"`
			}
			sb.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		}
		newContent = sb.String()
	} else if req.Env != nil {
		var sb strings.Builder
		keys := make([]string, 0, len(req.Env))
		for k := range req.Env {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			v := req.Env[k]
			if strings.ContainsAny(v, " \t\n\"'#$") {
				v = `"` + strings.ReplaceAll(v, `"`, `\"`) + `"`
			}
			sb.WriteString(fmt.Sprintf("%s=%s\n", k, v))
		}
		newContent = sb.String()
	}

	// 1. Time-Machine Revision Snapshot before changing
	previousContent, _ := d.fileService.GetFileContent(server.UUID, ".env")
	if len(previousContent) > 0 && previousContent != newContent && len(previousContent) < 1000000 {
		user, _ := middleware.GetRequestUser(c)
		author := "developer"
		if user != nil {
			author = user.Username
		}
		if d.db != nil {
			d.db.Create(&models.FileRevision{
				ServerUUID: server.UUID,
				FilePath:   "/.env",
				Content:    previousContent,
				Size:       int64(len(previousContent)),
				CreatedBy:  author,
				CreatedAt:  time.Now(),
			})
		}
	}

	// 2. Atomic Write to disk
	baseDir, err := d.fileService.GetServerBaseDir(server.UUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed resolving server directory: " + err.Error()})
		return
	}

	targetPath := filepath.Join(baseDir, ".env")
	tmpPath := filepath.Join(baseDir, fmt.Sprintf(".env.tmp.%d", time.Now().UnixNano()))

	if err := os.WriteFile(tmpPath, []byte(newContent), 0600); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed writing temporary .env: " + err.Error()})
		return
	}

	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		if err2 := d.fileService.WriteFile(server.UUID, ".env", newContent); err2 != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed writing .env file: " + err2.Error()})
			return
		}
	}
	_ = os.Chmod(targetPath, 0600)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": ".env file saved successfully with Time-Machine revision snapshot.",
	})
}

// WebhookDeployRequest defines incoming webhook payload parameters.
type WebhookDeployRequest struct {
	Ref         string `json:"ref"`
	Branch      string `json:"branch"`
	RepoURL     string `json:"repo_url"`
	AutoRestart *bool  `json:"auto_restart"`
}

// DeployWebhook handles POST /api/servers/:uuid/deploy/webhook
// Git Auto-Deploy Webhook: receives GitHub/GitLab pings, pulls updates, and triggers container restart.
func (d *DeveloperController) DeployWebhook(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	githubEvent := c.GetHeader("X-GitHub-Event")
	gitlabEvent := c.GetHeader("X-Gitlab-Event")
	if githubEvent == "ping" || githubEvent == "zen" {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "GitHub ping hook received."})
		return
	}
	if gitlabEvent == "Ping" {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "GitLab ping hook received."})
		return
	}

	var req WebhookDeployRequest
	_ = c.ShouldBindJSON(&req)

	branch := "main"
	if req.Branch != "" {
		branch = req.Branch
	} else if req.Ref != "" {
		branch = strings.TrimPrefix(req.Ref, "refs/heads/")
	}

	baseDir, err := d.fileService.GetServerBaseDir(server.UUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server directory not accessible: " + err.Error()})
		return
	}

	gitDir := filepath.Join(baseDir, ".git")
	var deployLog strings.Builder

	if _, statErr := os.Stat(gitDir); os.IsNotExist(statErr) {
		if req.RepoURL != "" {
			deployLog.WriteString(fmt.Sprintf("[Deploy] Initializing repository from %s...\n", req.RepoURL))
			cloneCmd := exec.Command("git", "clone", req.RepoURL, ".")
			cloneCmd.Dir = baseDir
			out, cErr := cloneCmd.CombinedOutput()
			deployLog.Write(out)
			if cErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Git clone failed: " + cErr.Error(),
					"log":     deployLog.String(),
				})
				return
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "No .git repository found in server volume. Provide repo_url to initialize.",
			})
			return
		}
	} else {
		deployLog.WriteString("[Deploy] Fetching updates from origin...\n")
		fetchCmd := exec.Command("git", "fetch", "--all")
		fetchCmd.Dir = baseDir
		out, _ := fetchCmd.CombinedOutput()
		deployLog.Write(out)

		deployLog.WriteString(fmt.Sprintf("[Deploy] Checking out branch '%s'...\n", branch))
		coCmd := exec.Command("git", "checkout", branch)
		coCmd.Dir = baseDir
		coOut, _ := coCmd.CombinedOutput()
		deployLog.Write(coOut)

		deployLog.WriteString(fmt.Sprintf("[Deploy] Pulling latest commits from %s...\n", branch))
		pullCmd := exec.Command("git", "pull", "origin", branch)
		pullCmd.Dir = baseDir
		pullOut, pErr := pullCmd.CombinedOutput()
		deployLog.Write(pullOut)
		if pErr != nil {
			deployLog.WriteString(fmt.Sprintf("[Deploy] Git pull warning: %s\n", pErr.Error()))
		}
	}

	restartTriggered := false
	if req.AutoRestart == nil || *req.AutoRestart {
		if server.Node != nil && d.wingsClient != nil {
			deployLog.WriteString("[Deploy] Triggering server container restart...\n")
			err := d.wingsClient.SendPowerAction(server.Node, server.UUID, "restart")
			if err == nil {
				restartTriggered = true
				deployLog.WriteString("[Deploy] Container restart signal successfully sent.\n")
			} else {
				deployLog.WriteString(fmt.Sprintf("[Deploy] Warning: could not signal container restart: %v\n", err))
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"branch":            branch,
		"log":               deployLog.String(),
		"restart_triggered": restartTriggered,
	})
}

// RunPkgRequest defines package manager execution parameters.
type RunPkgRequest struct {
	Manager string   `json:"manager" binding:"required"` // "npm", "pip", "composer", "yarn", "pnpm", "bun", "cargo", "go"
	Command string   `json:"command"`                   // "install", "update", "ci", "build", etc. Defaults to "install"
	Args    []string `json:"args"`
}

// RunPkg handles POST /api/servers/:uuid/deploy/run-pkg
// Executes package manager commands (npm install, pip install, composer install, etc.) in server volume.
func (d *DeveloperController) RunPkg(c *gin.Context) {
	server, ok := middleware.GetRequestServer(c)
	if !ok || server == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Server not found."})
		return
	}

	var req RunPkgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Whitelist allowed package managers
	allowedManagers := map[string]bool{
		"npm":      true,
		"npx":      true,
		"yarn":     true,
		"pnpm":     true,
		"bun":      true,
		"pip":      true,
		"pip3":     true,
		"composer": true,
		"cargo":    true,
		"go":       true,
		"deno":     true,
	}

	manager := strings.ToLower(strings.TrimSpace(req.Manager))
	if !allowedManagers[manager] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Unsupported package manager. Allowed: npm, yarn, pnpm, bun, pip, composer, cargo, go, deno",
		})
		return
	}

	action := strings.TrimSpace(req.Command)
	if action == "" {
		action = "install"
	}

	// Validate action against injection
	if strings.ContainsAny(action, ";|&$`><\n") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid command character detected."})
		return
	}

	baseDir, err := d.fileService.GetServerBaseDir(server.UUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed resolving server directory: " + err.Error()})
		return
	}

	cmdArgs := []string{action}
	for _, arg := range req.Args {
		clean := strings.TrimSpace(arg)
		if clean != "" && !strings.ContainsAny(clean, ";|&$`><\n") {
			cmdArgs = append(cmdArgs, clean)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, manager, cmdArgs...)
	cmd.Dir = baseDir
	cmd.Env = os.Environ()

	out, cmdErr := cmd.CombinedOutput()
	outputStr := string(out)

	if cmdErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"manager": manager,
			"command": fmt.Sprintf("%s %s", manager, strings.Join(cmdArgs, " ")),
			"output":  outputStr,
			"error":   cmdErr.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"manager": manager,
		"command": fmt.Sprintf("%s %s", manager, strings.Join(cmdArgs, " ")),
		"output":  outputStr,
	})
}
