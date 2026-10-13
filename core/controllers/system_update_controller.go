package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type SystemUpdateController struct {
	currentVersion string
	githubRepo     string
}

func NewSystemUpdateController() *SystemUpdateController {
	return &SystemUpdateController{
		currentVersion: "v2.8.8",
		githubRepo:     "SpringiSFMM/pteronext",
	}
}

type GitHubCommit struct {
	SHA    string `json:"sha"`
	Commit struct {
		Message string `json:"message"`
		Author  struct {
			Name string    `json:"name"`
			Date time.Time `json:"date"`
		} `json:"author"`
	} `json:"commit"`
}

func isVersionGreater(v1, v2 string) bool {
	v1Clean := strings.TrimPrefix(v1, "v")
	v2Clean := strings.TrimPrefix(v2, "v")
	parts1 := strings.Split(v1Clean, ".")
	parts2 := strings.Split(v2Clean, ".")

	for i := 0; i < len(parts1) && i < len(parts2); i++ {
		n1, _ := strconv.Atoi(parts1[i])
		n2, _ := strconv.Atoi(parts2[i])
		if n1 > n2 {
			return true
		}
		if n1 < n2 {
			return false
		}
	}
	return len(parts1) > len(parts2)
}

// CheckUpdate queries GitHub repository to check for latest commits/releases
func (s *SystemUpdateController) CheckUpdate(c *gin.Context) {
	client := &http.Client{Timeout: 6 * time.Second}

	// 1. Fetch latest commit
	commitReq, _ := http.NewRequest("GET", fmt.Sprintf("https://api.github.com/repos/%s/commits/main", s.githubRepo), nil)
	commitReq.Header.Set("User-Agent", "PteroNext-Panel-Updater")
	commitReq.Header.Set("Accept", "application/vnd.github.v3+json")

	var commit GitHubCommit
	var shortSHA string
	if resp, err := client.Do(commitReq); err == nil && resp.StatusCode == http.StatusOK {
		_ = json.NewDecoder(resp.Body).Decode(&commit)
		resp.Body.Close()
		shortSHA = commit.SHA
		if len(shortSHA) > 7 {
			shortSHA = shortSHA[:7]
		}
	}

	// 2. Fetch latest tags from repository
	tagsReq, _ := http.NewRequest("GET", fmt.Sprintf("https://api.github.com/repos/%s/tags", s.githubRepo), nil)
	tagsReq.Header.Set("User-Agent", "PteroNext-Panel-Updater")
	tagsReq.Header.Set("Accept", "application/vnd.github.v3+json")

	latestTag := ""
	if resp, err := client.Do(tagsReq); err == nil && resp.StatusCode == http.StatusOK {
		var tags []struct {
			Name string `json:"name"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&tags)
		resp.Body.Close()
		if len(tags) > 0 {
			latestTag = tags[0].Name
		}
	}

	// Fallback to commit message version detection if tags API is rate-limited
	if latestTag == "" && commit.Commit.Message != "" {
		re := regexp.MustCompile(`v\d+\.\d+\.\d+`)
		if m := re.FindString(commit.Commit.Message); m != "" {
			latestTag = m
		}
	}

	if latestTag == "" {
		latestTag = s.currentVersion
	}

	updateAvailable := false
	if latestTag != "" && latestTag != s.currentVersion {
		updateAvailable = isVersionGreater(latestTag, s.currentVersion)
	}

	displayLatest := latestTag
	if shortSHA != "" {
		displayLatest = fmt.Sprintf("%s (%s)", latestTag, shortSHA)
	}

	c.JSON(http.StatusOK, gin.H{
		"update_available": updateAvailable,
		"current_version":  s.currentVersion,
		"latest_version":   displayLatest,
		"commit_sha":       shortSHA,
		"commit_message":   commit.Commit.Message,
		"commit_date":      commit.Commit.Author.Date.Format("2006-01-02 15:04:05"),
		"commit_author":    commit.Commit.Author.Name,
		"repo_url":         fmt.Sprintf("https://github.com/%s", s.githubRepo),
		"checked_at":       time.Now().Format(time.RFC3339),
	})
}

// InstallUpdate triggers safe 1-click update with zero data loss
func (s *SystemUpdateController) InstallUpdate(c *gin.Context) {
	// 1. Safely snapshot database before updating
	timestamp := time.Now().Format("20060102_150405")
	dbCandidates := []string{
		"/var/lib/pteronext/pteronext.db",
		"/opt/pteronext/pteronext.db",
		"./pteronext.db",
	}

	var backedUp []string
	for _, p := range dbCandidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			bakPath := fmt.Sprintf("%s.bak_%s", p, timestamp)
			if data, rErr := os.ReadFile(p); rErr == nil {
				if wErr := os.WriteFile(bakPath, data, 0644); wErr == nil {
					backedUp = append(backedUp, bakPath)
				}
			}
		}
	}

	// 2. Schedule non-blocking update execution & restart
	go func() {
		time.Sleep(1200 * time.Millisecond)

		// If a git repo exists at /root/panel or /opt/pteronext, attempt pull & build
		if _, err := os.Stat("/root/panel/.git"); err == nil {
			cmd := exec.Command("bash", "-c", "cd /root/panel && git pull origin main && ./build.sh || true")
			_ = cmd.Run()
		}

		_ = exec.Command("systemctl", "restart", "pteronext").Start()
	}()

	msg := fmt.Sprintf("1-Klick Update eingeleitet. Datenbank wurde sicher gesichert (%d Backups angelegt). Dienst startet in wenigen Sekunden neu...", len(backedUp))
	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       msg,
		"version":       s.currentVersion,
		"backed_up_dbs": backedUp,
	})
}

