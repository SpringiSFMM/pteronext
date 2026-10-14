package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/controllers"
	"github.com/pteronext/panel-core/database"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

func setupCustomTestDB(t *testing.T) (*gorm.DB, string) {
	tmpDir, err := os.MkdirTemp("", "ptl-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := database.InitDB(dbPath, false)
	if err != nil {
		t.Fatalf("Failed to open sqlite: %v", err)
	}

	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("Failed to auto-migrate: %v", err)
	}

	if err := database.SeedDatabase(db); err != nil {
		t.Fatalf("Failed to seed database: %v", err)
	}

	return db, tmpDir
}

func TestEggCategoryAndFeatures(t *testing.T) {
	db, tmpDir := setupCustomTestDB(t)
	defer os.RemoveAll(tmpDir)

	var nest models.Nest
	if err := db.Where("slug = ?", "minecraft").First(&nest).Error; err != nil {
		nest = models.Nest{
			Name: "Custom Minecraft",
			Slug: "custom-minecraft",
		}
		if err := db.Create(&nest).Error; err != nil {
			t.Fatalf("Failed creating nest: %v", err)
		}
	}

	egg := models.Egg{
		NestID:         nest.ID,
		Name:           "Paper 1.20",
		Category:       "minecraft",
		Features:       models.StringSlice{"canvas_world", "player_manager"},
		StartupCommand: "java -jar server.jar",
	}
	if err := db.Create(&egg).Error; err != nil {
		t.Fatalf("Failed creating egg: %v", err)
	}

	var loadedEgg models.Egg
	if err := db.First(&loadedEgg, egg.ID).Error; err != nil {
		t.Fatalf("Failed loading egg: %v", err)
	}
	if loadedEgg.Category != "minecraft" {
		t.Errorf("Expected category 'minecraft', got '%s'", loadedEgg.Category)
	}
	features := []string(loadedEgg.Features)
	if len(features) != 2 || features[0] != "canvas_world" || features[1] != "player_manager" {
		t.Errorf("Unexpected features: %v", features)
	}

	// Test default category and features inference for a bot
	botEgg := models.Egg{
		NestID:         nest.ID,
		Name:           "Discord Node.js Bot",
		StartupCommand: "node index.js",
	}
	if err := db.Create(&botEgg).Error; err != nil {
		t.Fatalf("Failed creating bot egg: %v", err)
	}

	var loadedBotEgg models.Egg
	if err := db.First(&loadedBotEgg, botEgg.ID).Error; err != nil {
		t.Fatalf("Failed loading bot egg: %v", err)
	}
	if loadedBotEgg.Category != "bot" {
		t.Errorf("Expected inferred category 'bot', got '%s'", loadedBotEgg.Category)
	}
	botFeatures := []string(loadedBotEgg.Features)
	foundEnvVault := false
	for _, f := range botFeatures {
		if f == "env_vault" {
			foundEnvVault = true
		}
	}
	if !foundEnvVault {
		t.Errorf("Expected bot features to include env_vault, got: %v", botFeatures)
	}
}

func TestServerEggCategoryAndNestSlug(t *testing.T) {
	db, tmpDir := setupCustomTestDB(t)
	defer os.RemoveAll(tmpDir)

	nest := models.Nest{
		Name: "Web Applications",
		Slug: "web-apps",
	}
	if err := db.Create(&nest).Error; err != nil {
		t.Fatalf("Failed creating nest: %v", err)
	}

	egg := models.Egg{
		NestID:         nest.ID,
		Name:           "Next.js App",
		Category:       "web",
		Features:       models.StringSlice{"env_vault", "git_deploy", "web_domains"},
		StartupCommand: "npm run start",
	}
	if err := db.Create(&egg).Error; err != nil {
		t.Fatalf("Failed creating egg: %v", err)
	}

	server := models.Server{
		Name:         "My Portfolio",
		OwnerID:      1,
		NodeID:       1,
		AllocationID: 1,
		NestID:       &nest.ID,
		EggID:        &egg.ID,
		MemoryMB:     2048,
		Startup:      "npm start",
		Image:        "node:20-alpine",
	}
	if err := db.Create(&server).Error; err != nil {
		t.Fatalf("Failed creating server: %v", err)
	}

	var loadedServer models.Server
	if err := db.Preload("Nest").Preload("Egg").First(&loadedServer, server.ID).Error; err != nil {
		t.Fatalf("Failed loading server: %v", err)
	}
	if loadedServer.EggCategory != "web" {
		t.Errorf("Expected EggCategory 'web', got '%s'", loadedServer.EggCategory)
	}
	if loadedServer.NestSlug != "web-apps" {
		t.Errorf("Expected NestSlug 'web-apps', got '%s'", loadedServer.NestSlug)
	}
}

func TestDeveloperControllerEnvAndRevisions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tmpDir := setupCustomTestDB(t)
	defer os.RemoveAll(tmpDir)

	fileService := services.NewFileService(db, tmpDir)
	devCtrl := controllers.NewDeveloperController(db, fileService, nil)

	server := models.Server{
		Name:         "Dev Node Server",
		UUID:         "test-uuid-dev-1234",
		OwnerID:      1,
		NodeID:       1,
		AllocationID: 1,
		MemoryMB:     1024,
		Startup:      "node index.js",
		Image:        "node:20-alpine",
	}
	if err := db.Create(&server).Error; err != nil {
		t.Fatalf("Failed creating server: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("server", &server)
		user := &models.User{ID: 1, Username: "admin_tester", RootAdmin: true}
		c.Set("user", user)
		c.Next()
	})

	router.GET("/api/servers/:uuid/env", devCtrl.GetEnv)
	router.POST("/api/servers/:uuid/env", devCtrl.SaveEnv)

	// 1. Initial GET - empty env
	req1 := httptest.NewRequest(http.MethodGet, "/api/servers/test-uuid-dev-1234/env", nil)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w1.Code)
	}

	var res1 map[string]interface{}
	if err := json.Unmarshal(w1.Body.Bytes(), &res1); err != nil {
		t.Fatalf("Failed unmarshaling: %v", err)
	}
	if res1["exists"] != false {
		t.Errorf("Expected exists=false, got %v", res1["exists"])
	}

	// 2. Save new .env with secret and regular variable
	savePayload := controllers.SaveEnvRequest{
		Entries: []controllers.EnvEntry{
			{Key: "PORT", Value: "3000", Comment: "HTTP port"},
			{Key: "DATABASE_URL", Value: "postgres://user:secretpass@localhost:5432/app", Comment: "Main database"},
			{Key: "JWT_SECRET", Value: "my-super-secret-key-12345"},
		},
	}
	payloadBytes, _ := json.Marshal(savePayload)
	req2 := httptest.NewRequest(http.MethodPost, "/api/servers/test-uuid-dev-1234/env", bytes.NewReader(payloadBytes))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	// 3. GET .env with mask=true
	req3 := httptest.NewRequest(http.MethodGet, "/api/servers/test-uuid-dev-1234/env?mask=true", nil)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w3.Code)
	}

	var res3 struct {
		Exists  bool                   `json:"exists"`
		Total   int                    `json:"total"`
		Entries []controllers.EnvEntry `json:"entries"`
		Raw     string                 `json:"raw"`
	}
	if err := json.Unmarshal(w3.Body.Bytes(), &res3); err != nil {
		t.Fatalf("Failed unmarshaling: %v", err)
	}
	if !res3.Exists || res3.Total != 3 {
		t.Fatalf("Expected exists=true and total=3, got %v, %d", res3.Exists, res3.Total)
	}

	// PORT should be unmasked (not a secret)
	// DATABASE_URL and JWT_SECRET should be masked
	for _, entry := range res3.Entries {
		if entry.Key == "PORT" {
			if entry.IsSecret || entry.Value != "3000" {
				t.Errorf("PORT: expected unmasked 3000, got isSecret=%v val=%s", entry.IsSecret, entry.Value)
			}
		} else if entry.Key == "DATABASE_URL" {
			if !entry.IsSecret || entry.Value != "••••••••" {
				t.Errorf("DATABASE_URL: expected masked, got isSecret=%v val=%s", entry.IsSecret, entry.Value)
			}
		} else if entry.Key == "JWT_SECRET" {
			if !entry.IsSecret || entry.Value != "••••••••" {
				t.Errorf("JWT_SECRET: expected masked, got isSecret=%v val=%s", entry.IsSecret, entry.Value)
			}
		}
	}

	// 4. Update .env to test Time-Machine file revision creation
	savePayload2 := controllers.SaveEnvRequest{
		Content: "PORT=8080\nNODE_ENV=production\n",
	}
	payloadBytes2, _ := json.Marshal(savePayload2)
	req4 := httptest.NewRequest(http.MethodPost, "/api/servers/test-uuid-dev-1234/env", bytes.NewReader(payloadBytes2))
	req4.Header.Set("Content-Type", "application/json")
	w4 := httptest.NewRecorder()
	router.ServeHTTP(w4, req4)
	if w4.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d: %s", w4.Code, w4.Body.String())
	}

	// Verify revision was saved in database
	var revisions []models.FileRevision
	if err := db.Where("server_uuid = ?", "test-uuid-dev-1234").Find(&revisions).Error; err != nil {
		t.Fatalf("Failed loading revisions: %v", err)
	}
	if len(revisions) == 0 {
		t.Fatalf("Expected at least 1 FileRevision, got 0")
	}
	if revisions[0].FilePath != "/.env" {
		t.Errorf("Expected revision path '/.env', got '%s'", revisions[0].FilePath)
	}
	if !strings.Contains(revisions[0].Content, "DATABASE_URL") {
		t.Errorf("Expected snapshot to contain previous content, got: %s", revisions[0].Content)
	}
}

func TestDeveloperControllerWebhookAndPkgManager(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tmpDir := setupCustomTestDB(t)
	defer os.RemoveAll(tmpDir)

	fileService := services.NewFileService(db, tmpDir)
	devCtrl := controllers.NewDeveloperController(db, fileService, nil)

	server := models.Server{
		Name:     "Node App",
		UUID:     "test-uuid-pkg-5678",
		OwnerID:      1,
		NodeID:       1,
		AllocationID: 1,
		MemoryMB:     1024,
		Startup:  "node index.js",
		Image:    "node:20-alpine",
	}
	if err := db.Create(&server).Error; err != nil {
		t.Fatalf("Failed creating server: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("server", &server)
		c.Next()
	})

	router.POST("/api/servers/:uuid/deploy/webhook", devCtrl.DeployWebhook)
	router.POST("/api/servers/:uuid/deploy/run-pkg", devCtrl.RunPkg)

	// Test GitHub ping webhook
	req1 := httptest.NewRequest(http.MethodPost, "/api/servers/test-uuid-pkg-5678/deploy/webhook", nil)
	req1.Header.Set("X-GitHub-Event", "ping")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w1.Code)
	}

	var res1 map[string]interface{}
	if err := json.Unmarshal(w1.Body.Bytes(), &res1); err != nil {
		t.Fatalf("Failed unmarshaling: %v", err)
	}
	if res1["status"] != "ok" {
		t.Errorf("Expected status='ok', got %v", res1["status"])
	}

	// Test unsupported package manager validation
	badPkgReq := controllers.RunPkgRequest{
		Manager: "malicious_binary",
		Command: "hack",
	}
	badBytes, _ := json.Marshal(badPkgReq)
	req2 := httptest.NewRequest(http.MethodPost, "/api/servers/test-uuid-pkg-5678/deploy/run-pkg", bytes.NewReader(badBytes))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for unsupported manager, got %d", w2.Code)
	}
}
