package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pteronext/panel-core/config"
	"github.com/pteronext/panel-core/database"
	"github.com/pteronext/panel-core/models"
	"github.com/pteronext/panel-core/routes"
	"github.com/pteronext/panel-core/services"
	"gorm.io/gorm"
)

func setupTestEnvironment(t *testing.T) (*ginTestEnv, func()) {
	testDBPath := fmt.Sprintf("./test_pteronext_%d.db", time.Now().UnixNano())

	cfg := &config.Config{
		AppEnv:      "testing",
		AppURL:      "http://localhost:8080",
		HTTPHost:    "127.0.0.1",
		HTTPPort:    8080,
		DBPath:      testDBPath,
		JWTSecret:   "test-secret-key-32-bytes-minimum-length!",
		JWTTTL:      time.Hour,
		Debug:       false,
		AllowOrigin: "*",
	}

	db, err := database.InitDB(cfg.DBPath, false)
	if err != nil {
		t.Fatalf("Failed to init db: %v", err)
	}

	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("Failed auto-migration: %v", err)
	}

	if err := database.SeedDatabase(db); err != nil {
		t.Fatalf("Failed seeding: %v", err)
	}

	authService := services.NewAuthService(db, cfg)
	serverService := services.NewServerService(db)
	wingsClient := services.NewWingsClient()
	wsHub := services.NewWebSocketHub(wingsClient, db)
	auditService := services.NewAuditService(db)
	statsService := services.NewStatsService(db, cfg.DBPath)

	fileService := services.NewFileService(db, ".")
	webhookService := services.NewWebhookService(db)
	backupService := services.NewBackupService(db, fileService, webhookService, ".")
	scannerService := services.NewSecurityScannerService()

	router := routes.SetupRouter(
		cfg,
		db,
		authService,
		serverService,
		wingsClient,
		wsHub,
		auditService,
		statsService,
		fileService,
		backupService,
		webhookService,
		scannerService,
	)

	env := &ginTestEnv{
		cfg:           cfg,
		db:            db,
		router:        router,
		authService:   authService,
		serverService: serverService,
		wsHub:         wsHub,
	}

	cleanup := func() {
		_ = database.Close(db)
		_ = os.Remove(testDBPath)
		_ = os.Remove(testDBPath + "-wal")
		_ = os.Remove(testDBPath + "-shm")
	}

	return env, cleanup
}

type ginTestEnv struct {
	cfg           *config.Config
	db            *gorm.DB
	router        http.Handler
	authService   *services.AuthService
	serverService *services.ServerService
	wsHub         *services.WebSocketHub
}

func (e *ginTestEnv) performRequest(method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var bodyReader *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(b)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}

	req, _ := http.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

// -------------------------------------------------------------
// Test 1: Database WAL mode and Model Migrations
// -------------------------------------------------------------
func TestDatabaseWALAndMigrations(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Verify WAL Mode
	sqlDB, err := env.db.DB()
	if err != nil {
		t.Fatalf("Failed to get sqlDB: %v", err)
	}
	var journalMode string
	if err := sqlDB.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err != nil {
		t.Fatalf("Failed to query journal_mode: %v", err)
	}
	if strings.ToLower(journalMode) != "wal" {
		t.Errorf("Expected journal_mode=wal, got %s", journalMode)
	}

	// 2. Verify all models exist
	modelsToCheck := []interface{}{
		&models.User{},
		&models.Role{},
		&models.Permission{},
		&models.Server{},
		&models.Node{},
		&models.Schedule{},
		&models.AuditLog{},
		&models.Database{},
		&models.APIKey{},
		&models.Backup{},
		&models.Allocation{},
		&models.Nest{},
		&models.Egg{},
	}
	for _, m := range modelsToCheck {
		var count int64
		if err := env.db.Model(m).Count(&count).Error; err != nil {
			t.Errorf("Failed querying table for model %T: %v", m, err)
		}
	}
}

// -------------------------------------------------------------
// Test 2: Auth, JWT, and RBAC Middleware
// -------------------------------------------------------------
func TestAuthAndRBAC(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Login with valid credentials
	w := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK login, got %d: %s", w.Code, w.Body.String())
	}

	var loginResp struct {
		Token string `json:"token"`
		User  struct {
			Username  string `json:"username"`
			RootAdmin bool   `json:"root_admin"`
		} `json:"user"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &loginResp)
	if loginResp.Token == "" {
		t.Fatal("Expected non-empty JWT token")
	}
	if !loginResp.User.RootAdmin {
		t.Fatal("Expected admin user to have root_admin=true")
	}

	adminToken := loginResp.Token

	// 2. Login with invalid credentials -> 401
	wInvalid := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "wrongpassword",
	}, nil)
	if wInvalid.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for wrong password, got %d", wInvalid.Code)
	}

	// 3. /api/auth/me with Bearer token
	wMe := env.performRequest("GET", "/api/auth/me", nil, map[string]string{
		"Authorization": "Bearer " + adminToken,
	})
	if wMe.Code != http.StatusOK {
		t.Errorf("Expected 200 for /api/auth/me, got %d", wMe.Code)
	}

	// 4. Register standard user
	wReg := env.performRequest("POST", "/api/auth/register", map[string]string{
		"username": "regularuser",
		"email":    "user@example.com",
		"password": "password123",
	}, nil)
	if wReg.Code != http.StatusCreated {
		t.Fatalf("Expected 201 for register, got %d: %s", wReg.Code, wReg.Body.String())
	}

	var regResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wReg.Body.Bytes(), &regResp)
	userToken := regResp.Token

	// 5. Regular user tries admin endpoint -> 403 Forbidden
	wAdminNode := env.performRequest("GET", "/api/nodes", nil, map[string]string{
		"Authorization": "Bearer " + userToken,
	})
	if wAdminNode.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for non-admin on /api/nodes, got %d", wAdminNode.Code)
	}

	// 6. Admin user accesses /api/nodes -> 200 OK
	wAdminAllowed := env.performRequest("GET", "/api/nodes", nil, map[string]string{
		"Authorization": "Bearer " + adminToken,
	})
	if wAdminAllowed.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for admin on /api/nodes, got %d", wAdminAllowed.Code)
	}
}

// -------------------------------------------------------------
// Test 3: API Key Creation and Authentication
// -------------------------------------------------------------
func TestAPIKeyAuthentication(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Login as admin
	wLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)
	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wLogin.Body.Bytes(), &loginResp)

	// Create an API Key
	wKey := env.performRequest("POST", "/api/account/api-keys", map[string]string{
		"memo": "Test API Key",
	}, map[string]string{
		"Authorization": "Bearer " + loginResp.Token,
	})
	if wKey.Code != http.StatusCreated {
		t.Fatalf("Expected 201 creating API key, got %d", wKey.Code)
	}

	var keyResp struct {
		Secret string `json:"secret"`
	}
	_ = json.Unmarshal(wKey.Body.Bytes(), &keyResp)
	if !strings.HasPrefix(keyResp.Secret, "ptl_") {
		t.Fatalf("Expected API key to start with ptl_, got %s", keyResp.Secret)
	}

	// Access authenticated endpoint using API Key
	wMe := env.performRequest("GET", "/api/auth/me", nil, map[string]string{
		"Authorization": "Bearer " + keyResp.Secret,
	})
	if wMe.Code != http.StatusOK {
		t.Fatalf("Expected 200 using API key, got %d: %s", wMe.Code, wMe.Body.String())
	}
}

// -------------------------------------------------------------
// Test 4: Wings Compatibility Daemon Endpoints (/api/remote/*)
// -------------------------------------------------------------
func TestWingsRemoteCompatibilityEndpoints(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Get seeded node
	var node models.Node
	if err := env.db.First(&node).Error; err != nil {
		t.Fatalf("No node seeded: %v", err)
	}
	daemonAuthHeader := fmt.Sprintf("Bearer %s.%s", node.DaemonTokenID, node.DaemonToken)

	// 1. Daemon Auth rejection on invalid token
	wInvalidAuth := env.performRequest("GET", "/api/remote/servers", nil, map[string]string{
		"Authorization": "Bearer bad.token",
	})
	if wInvalidAuth.Code != http.StatusForbidden {
		t.Errorf("Expected 403 for invalid daemon token, got %d", wInvalidAuth.Code)
	}

	// 2. GET /api/remote/servers (List servers for this node)
	wServers := env.performRequest("GET", "/api/remote/servers", nil, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wServers.Code != http.StatusOK {
		t.Fatalf("Expected 200 for /api/remote/servers, got %d: %s", wServers.Code, wServers.Body.String())
	}

	var listData struct {
		Data []struct {
			UUID     string `json:"uuid"`
			Settings struct {
				UUID        string                 `json:"uuid"`
				Environment map[string]interface{} `json:"environment"`
				Build       struct {
					MemoryLimit int64 `json:"memory_limit"`
				} `json:"build"`
				Allocations struct {
					Default struct {
						IP   string `json:"ip"`
						Port int    `json:"port"`
					} `json:"default"`
				} `json:"allocations"`
			} `json:"settings"`
			ProcessConfiguration struct {
				Startup struct {
					Done []string `json:"done"`
				} `json:"startup"`
				Stop struct {
					Type  string `json:"type"`
					Value string `json:"value"`
				} `json:"stop"`
			} `json:"process_configuration"`
		} `json:"data"`
		Meta struct {
			Pagination struct {
				Total int64 `json:"total"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	_ = json.Unmarshal(wServers.Body.Bytes(), &listData)
	if len(listData.Data) == 0 {
		t.Fatal("Expected at least 1 server in Wings remote server list")
	}

	serverUUID := listData.Data[0].UUID
	if listData.Data[0].Settings.Build.MemoryLimit <= 0 {
		t.Error("Expected positive MemoryLimit in Wings settings")
	}
	if listData.Data[0].Settings.Allocations.Default.Port == 0 {
		t.Error("Expected default allocation port in Wings settings")
	}
	if listData.Data[0].ProcessConfiguration.Stop.Value == "" {
		t.Error("Expected stop command in process configuration")
	}

	// 3. GET /api/remote/servers/:uuid (Single server details)
	wSingle := env.performRequest("GET", "/api/remote/servers/"+serverUUID, nil, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wSingle.Code != http.StatusOK {
		t.Fatalf("Expected 200 for single server details, got %d: %s", wSingle.Code, wSingle.Body.String())
	}

	// 4. POST /api/remote/servers/reset (Reset state upon Wings reboot)
	wReset := env.performRequest("POST", "/api/remote/servers/reset", nil, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wReset.Code != http.StatusNoContent {
		t.Errorf("Expected 204 No Content for reset state, got %d", wReset.Code)
	}

	// 5. GET /api/remote/servers/:uuid/install (Installation scripts)
	wInstallGet := env.performRequest("GET", "/api/remote/servers/"+serverUUID+"/install", nil, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wInstallGet.Code != http.StatusOK {
		t.Fatalf("Expected 200 for install data, got %d: %s", wInstallGet.Code, wInstallGet.Body.String())
	}
	var installData struct {
		ContainerImage string `json:"container_image"`
		Script         string `json:"script"`
	}
	_ = json.Unmarshal(wInstallGet.Body.Bytes(), &installData)
	if installData.ContainerImage == "" || installData.Script == "" {
		t.Errorf("Expected container image and script in install data")
	}

	// 6. POST /api/remote/servers/:uuid/install (Install completion)
	wInstallPost := env.performRequest("POST", "/api/remote/servers/"+serverUUID+"/install", map[string]interface{}{
		"successful": true,
		"reinstall":  false,
	}, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wInstallPost.Code != http.StatusNoContent {
		t.Errorf("Expected 204 No Content for install report, got %d", wInstallPost.Code)
	}

	// 7. POST /api/remote/activity (Wings activity stream)
	wActivity := env.performRequest("POST", "/api/remote/activity", map[string]interface{}{
		"data": []map[string]interface{}{
			{
				"server":    serverUUID,
				"user":      "",
				"event":     "server:power.start",
				"metadata":  map[string]string{"action": "start"},
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"ip":        "127.0.0.1",
			},
		},
	}, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wActivity.Code != http.StatusNoContent {
		t.Fatalf("Expected 204 for remote activity, got %d: %s", wActivity.Code, wActivity.Body.String())
	}

	// Verify activity log was recorded
	var auditCount int64
	env.db.Model(&models.AuditLog{}).Where("event = ?", "server:power.start").Count(&auditCount)
	if auditCount == 0 {
		t.Error("Expected audit log entry from Wings activity")
	}

	// 8. Backups Remote Flow
	// Create test backup record
	backupUUID := "bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
	var demoServer models.Server
	env.db.Where("uuid = ?", serverUUID).First(&demoServer)
	backup := models.Backup{
		ServerID: demoServer.ID,
		UUID:     backupUUID,
		Name:     "Test Snapshot",
	}
	env.db.Create(&backup)

	// GET /api/remote/backups/:backup
	wBackupGet := env.performRequest("GET", "/api/remote/backups/"+backupUUID, nil, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wBackupGet.Code != http.StatusOK {
		t.Errorf("Expected 200 for remote backup upload info, got %d", wBackupGet.Code)
	}

	// POST /api/remote/backups/:backup (Completion)
	wBackupPost := env.performRequest("POST", "/api/remote/backups/"+backupUUID, map[string]interface{}{
		"successful":    true,
		"checksum_type": "sha256",
		"checksum":      "abcdef1234567890",
		"size":          1024 * 1024,
	}, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wBackupPost.Code != http.StatusNoContent {
		t.Errorf("Expected 204 for backup complete, got %d", wBackupPost.Code)
	}

	// POST /api/remote/backups/:backup/restore
	wBackupRestore := env.performRequest("POST", "/api/remote/backups/"+backupUUID+"/restore", map[string]interface{}{
		"successful": true,
	}, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wBackupRestore.Code != http.StatusNoContent {
		t.Errorf("Expected 204 for backup restore, got %d", wBackupRestore.Code)
	}

	// 9. POST /api/remote/sftp/auth (Wings SFTP Authentication)
	wSftp := env.performRequest("POST", "/api/remote/sftp/auth", map[string]string{
		"type":     "password",
		"username": fmt.Sprintf("admin.%s", demoServer.Identifier),
		"password": "admin123456",
		"ip":       "127.0.0.1",
	}, map[string]string{
		"Authorization": daemonAuthHeader,
	})
	if wSftp.Code != http.StatusOK {
		t.Fatalf("Expected 200 for SFTP auth, got %d: %s", wSftp.Code, wSftp.Body.String())
	}
	var sftpResp struct {
		User        string   `json:"user"`
		Server      string   `json:"server"`
		Permissions []string `json:"permissions"`
	}
	_ = json.Unmarshal(wSftp.Body.Bytes(), &sftpResp)
	if sftpResp.Server != serverUUID {
		t.Errorf("Expected SFTP server uuid %s, got %s", serverUUID, sftpResp.Server)
	}
	if len(sftpResp.Permissions) == 0 {
		t.Errorf("Expected non-empty SFTP permissions list")
	}
}

// -------------------------------------------------------------
// Test 5: Server REST Management & Power Actions
// -------------------------------------------------------------
func TestServerRESTAndPower(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Login as admin
	wLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)
	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wLogin.Body.Bytes(), &loginResp)
	token := loginResp.Token

	// Create a test server first
	wCreate := env.performRequest("POST", "/api/servers", map[string]interface{}{
		"name":        "Test Patch Server",
		"node_id":     1,
		"memory":      2048,
		"disk":        10240,
		"cpu":         200,
		"startup":     "java -jar server.jar",
		"image":       "ghcr.io/pterodactyl/yolks:java_17",
	}, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wCreate.Code != http.StatusCreated {
		t.Fatalf("Expected 201 for /api/servers, got %d: %s", wCreate.Code, wCreate.Body.String())
	}
	var createResp struct {
		Server models.Server `json:"server"`
	}
	_ = json.Unmarshal(wCreate.Body.Bytes(), &createResp)
	serverUUID := createResp.Server.UUID

	// List servers
	wList := env.performRequest("GET", "/api/servers", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wList.Code != http.StatusOK {
		t.Fatalf("Expected 200 for /api/servers, got %d", wList.Code)
	}

	// Test PATCH /api/servers/:uuid to update memory and hardware limits
	newMemory := int64(4096)
	newCPU := int64(300)
	newDisk := int64(20480)
	newName := "Renamed Patch Server"
	wPatch := env.performRequest("PATCH", "/api/servers/"+serverUUID, map[string]interface{}{
		"name":   newName,
		"memory": newMemory,
		"cpu":    newCPU,
		"disk":   newDisk,
	}, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wPatch.Code != http.StatusOK {
		t.Fatalf("Expected 200 for PATCH /api/servers/:uuid, got %d: %s", wPatch.Code, wPatch.Body.String())
	}

	// Verify update persisted
	wGet := env.performRequest("GET", "/api/servers/"+serverUUID, nil, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wGet.Code != http.StatusOK {
		t.Fatalf("Expected 200 for GET /api/servers/:uuid, got %d", wGet.Code)
	}
	var getResp struct {
		Server models.Server `json:"server"`
	}
	_ = json.Unmarshal(wGet.Body.Bytes(), &getResp)
	if getResp.Server.MemoryMB != newMemory {
		t.Errorf("Expected memory %d, got %d", newMemory, getResp.Server.MemoryMB)
	}
	if getResp.Server.CPU != newCPU {
		t.Errorf("Expected cpu %d, got %d", newCPU, getResp.Server.CPU)
	}
	if getResp.Server.DiskMB != newDisk {
		t.Errorf("Expected disk %d, got %d", newDisk, getResp.Server.DiskMB)
	}
	if getResp.Server.Name != newName {
		t.Errorf("Expected name %s, got %s", newName, getResp.Server.Name)
	}

	// Power Action: start
	wPower := env.performRequest("POST", "/api/servers/"+serverUUID+"/power", map[string]string{
		"action": "start",
	}, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wPower.Code != http.StatusOK && wPower.Code != http.StatusBadGateway {
		t.Fatalf("Expected 200 or 502 for power action, got %d: %s", wPower.Code, wPower.Body.String())
	}

	// Server Resources
	wRes := env.performRequest("GET", "/api/servers/"+serverUUID+"/resources", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wRes.Code != http.StatusOK {
		t.Fatalf("Expected 200 for server resources, got %d", wRes.Code)
	}

	// Node Wings configuration generation
	wNodeConfig := env.performRequest("GET", "/api/nodes/1/configuration", nil, map[string]string{
		"Authorization": "Bearer " + token,
	})
	if wNodeConfig.Code != http.StatusOK {
		t.Fatalf("Expected 200 for node config, got %d", wNodeConfig.Code)
	}
	var nodeCfgResp struct {
		YAML string `json:"yaml"`
	}
	_ = json.Unmarshal(wNodeConfig.Body.Bytes(), &nodeCfgResp)
	if !strings.Contains(nodeCfgResp.YAML, "token_id:") || !strings.Contains(nodeCfgResp.YAML, "remote:") {
		t.Errorf("Invalid Wings configuration generated: %s", nodeCfgResp.YAML)
	}
}

// -------------------------------------------------------------
// Test 6: WebSocket Console & Terminal Handshake
// -------------------------------------------------------------
func TestWebSocketConsole(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Start test HTTP server
	ts := httptest.NewServer(env.router)
	defer ts.Close()

	// Login
	wLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)
	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wLogin.Body.Bytes(), &loginResp)

	var server models.Server
	env.db.First(&server)

	// WebSocket URL
	wsURL := fmt.Sprintf("ws%s/api/servers/%s/ws?token=%s", strings.TrimPrefix(ts.URL, "http"), server.UUID, loginResp.Token)

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket connection failed: %v (status %v)", err, resp)
	}
	defer conn.Close()

	// Read initial messages (auth success, status, console output)
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed reading initial WS message: %v", err)
	}

	var wsMsg services.WSMessage
	if err := json.Unmarshal(msg, &wsMsg); err != nil {
		t.Fatalf("Failed unmarshaling WS message: %v", err)
	}
	if wsMsg.Event != "auth success" {
		t.Errorf("Expected 'auth success' event, got '%s'", wsMsg.Event)
	}

	// Send a command through WebSocket
	cmdMsg := services.WSMessage{
		Event: "send command",
		Args:  []interface{}{"help"},
	}
	cmdBytes, _ := json.Marshal(cmdMsg)
	if err := conn.WriteMessage(websocket.TextMessage, cmdBytes); err != nil {
		t.Fatalf("Failed sending command over WS: %v", err)
	}
}

// -------------------------------------------------------------
// Test 7: System Stats Telemetry
// -------------------------------------------------------------
func TestSystemStats(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	wStats := env.performRequest("GET", "/api/system/stats", nil, nil)
	if wStats.Code != http.StatusOK {
		t.Fatalf("Expected 200 for /api/system/stats, got %d", wStats.Code)
	}

	var stats services.SystemStatsResponse
	_ = json.Unmarshal(wStats.Body.Bytes(), &stats)
	if stats.GoVersion == "" {
		t.Error("Expected go_version in system stats")
	}
	if stats.Counts.Servers == 0 {
		t.Error("Expected at least 1 server counted in system stats")
	}
}

// -------------------------------------------------------------
// Test 8: Official Nest & Egg Seeder
// -------------------------------------------------------------
func TestNestAndEggSeeder(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// Verify Nests count (Minecraft, Rust, Source Engine, Voice Servers)
	var nestCount int64
	env.db.Model(&models.Nest{}).Count(&nestCount)
	if nestCount < 4 {
		t.Fatalf("Expected at least 4 nests seeded, found %d", nestCount)
	}

	// Verify Eggs count
	var eggCount int64
	env.db.Model(&models.Egg{}).Count(&eggCount)
	if eggCount < 9 {
		t.Fatalf("Expected at least 9 official eggs seeded, found %d", eggCount)
	}

	// Verify official eggs exist
	expectedEggs := []string{
		"Paper",
		"Vanilla Minecraft",
		"Forge Minecraft",
		"Bungeecord",
		"Rust",
		"Counter-Strike: Global Offensive",
		"Team Fortress 2",
		"Teamspeak3 Server",
		"Mumble Server",
	}

	for _, eggName := range expectedEggs {
		var egg models.Egg
		if err := env.db.Where("name = ?", eggName).First(&egg).Error; err != nil {
			t.Errorf("Official egg '%s' was not loaded into the database: %v", eggName, err)
		} else {
			if egg.StartupCommand == "" {
				t.Errorf("Egg '%s' has empty startup command", eggName)
			}
			if len(egg.DockerImages) == 0 {
				t.Errorf("Egg '%s' has no docker images", eggName)
			}
		}
	}

	// Verify Paper egg details specifically
	var paper models.Egg
	if err := env.db.Where("name = ?", "Paper").First(&paper).Error; err == nil {
		if len(paper.Variables) == 0 {
			t.Error("Paper egg has no variables parsed")
		}
		var foundJarVar, foundVerVar bool
		for _, v := range paper.Variables {
			if v.EnvVariable == "SERVER_JARFILE" {
				foundJarVar = true
			}
			if v.EnvVariable == "MINECRAFT_VERSION" {
				foundVerVar = true
			}
		}
		if !foundJarVar {
			t.Error("Paper egg missing SERVER_JARFILE variable")
		}
		if !foundVerVar {
			t.Error("Paper egg missing MINECRAFT_VERSION variable")
		}
		if !strings.Contains(paper.StartupCommand, "{{SERVER_JARFILE}}") {
			t.Errorf("Paper startup command unexpected: %s", paper.StartupCommand)
		}
	}
}

// -------------------------------------------------------------
// Test 9: Nest & Egg REST APIs (List, Get, Import)
// -------------------------------------------------------------
func TestNestAndEggAPI(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Authenticate as admin
	wLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)
	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wLogin.Body.Bytes(), &loginResp)
	authHeaders := map[string]string{"Authorization": "Bearer " + loginResp.Token}

	// 2. GET /api/nests
	wNests := env.performRequest("GET", "/api/nests", nil, authHeaders)
	if wNests.Code != http.StatusOK {
		t.Fatalf("Expected 200 for GET /api/nests, got %d", wNests.Code)
	}
	var nestsResp struct {
		Data []models.Nest `json:"data"`
	}
	if err := json.Unmarshal(wNests.Body.Bytes(), &nestsResp); err != nil {
		t.Fatalf("Failed unmarshaling /api/nests: %v", err)
	}
	if len(nestsResp.Data) < 4 {
		t.Errorf("Expected >= 4 nests in API response, got %d", len(nestsResp.Data))
	}

	var foundEggID uint
	for _, nest := range nestsResp.Data {
		if len(nest.Eggs) > 0 {
			foundEggID = nest.Eggs[0].ID
			break
		}
	}
	if foundEggID == 0 {
		t.Fatal("No eggs found inside nests response")
	}

	// 3. GET /api/eggs/:id
	wEgg := env.performRequest("GET", fmt.Sprintf("/api/eggs/%d", foundEggID), nil, authHeaders)
	if wEgg.Code != http.StatusOK {
		t.Fatalf("Expected 200 for GET /api/eggs/%d, got %d", foundEggID, wEgg.Code)
	}
	var eggResp struct {
		Egg models.Egg `json:"egg"`
	}
	if err := json.Unmarshal(wEgg.Body.Bytes(), &eggResp); err != nil {
		t.Fatalf("Failed unmarshaling /api/eggs response: %v", err)
	}
	if eggResp.Egg.ID != foundEggID {
		t.Errorf("Expected egg ID %d, got %d", foundEggID, eggResp.Egg.ID)
	}
	if len(eggResp.Egg.DockerImages) == 0 {
		t.Error("Expected egg to have docker images")
	}

	// 4. POST /api/eggs/import with raw JSON (PTDL_v2)
	factorioEggJSON := `{
		"meta": {"version": "PTDL_v2"},
		"name": "Factorio Dedicated",
		"description": "Factorio game server container",
		"docker_images": {
			"Latest": "ghcr.io/pterodactyl/games:factorio"
		},
		"startup": "./bin/x64/factorio --start-server-load-latest --port {{SERVER_PORT}}",
		"config": {
			"files": "{}",
			"startup": "{\"done\": \"Hosting game at port\"}",
			"stop": "/quit"
		},
		"scripts": {
			"installation": {
				"script": "#!/bin/bash\necho 'Installing Factorio...'",
				"container": "ghcr.io/pterodactyl/installers:alpine",
				"entrypoint": "ash"
			}
		},
		"variables": [
			{
				"name": "Server Port",
				"description": "Port for incoming connections",
				"env_variable": "SERVER_PORT",
				"default_value": "34197",
				"user_viewable": true,
				"user_editable": true,
				"rules": "required|numeric"
			}
		]
	}`

	reqRaw, _ := http.NewRequest("POST", "/api/eggs/import", strings.NewReader(factorioEggJSON))
	reqRaw.Header.Set("Content-Type", "application/json")
	reqRaw.Header.Set("Authorization", "Bearer "+loginResp.Token)
	wRaw := httptest.NewRecorder()
	env.router.ServeHTTP(wRaw, reqRaw)

	if wRaw.Code != http.StatusCreated && wRaw.Code != http.StatusOK {
		t.Fatalf("Expected 200/201 for raw import, got %d: %s", wRaw.Code, wRaw.Body.String())
	}

	var importedEgg models.Egg
	if err := env.db.Where("name = ?", "Factorio Dedicated").First(&importedEgg).Error; err != nil {
		t.Fatalf("Imported egg not found in database: %v", err)
	}
	if len(importedEgg.Variables) != 1 || importedEgg.Variables[0].EnvVariable != "SERVER_PORT" {
		t.Errorf("Imported egg variables mismatch: %+v", importedEgg.Variables)
	}
	if importedEgg.DockerImages["Latest"] != "ghcr.io/pterodactyl/games:factorio" {
		t.Errorf("Imported egg docker images mismatch: %+v", importedEgg.DockerImages)
	}

	// 5. POST /api/eggs/import with multipart file upload
	terrariaEggJSON := `{
		"meta": {"version": "PTDL_v2"},
		"name": "Terraria TShock",
		"description": "Terraria multiplayer server",
		"docker_images": {
			"Latest": "ghcr.io/pterodactyl/games:terraria"
		},
		"startup": "mono --server --gc=sgen -O=all TerrariaServer.exe -port {{SERVER_PORT}}",
		"config": {
			"files": "{}",
			"startup": "{\"done\": \"Server started\"}",
			"stop": "exit"
		},
		"variables": [
			{
				"name": "Port",
				"env_variable": "SERVER_PORT",
				"default_value": "7777",
				"user_viewable": true,
				"user_editable": true
			}
		]
	}`

	var b bytes.Buffer
	wMulti := multipart.NewWriter(&b)
	part, err := wMulti.CreateFormFile("file", "egg-terraria.json")
	if err != nil {
		t.Fatalf("Failed creating form file: %v", err)
	}
	part.Write([]byte(terrariaEggJSON))
	wMulti.Close()

	reqMulti, _ := http.NewRequest("POST", "/api/eggs/import", &b)
	reqMulti.Header.Set("Content-Type", wMulti.FormDataContentType())
	reqMulti.Header.Set("Authorization", "Bearer "+loginResp.Token)
	wMultiRec := httptest.NewRecorder()
	env.router.ServeHTTP(wMultiRec, reqMulti)

	if wMultiRec.Code != http.StatusCreated && wMultiRec.Code != http.StatusOK {
		t.Fatalf("Expected 200/201 for multipart import, got %d: %s", wMultiRec.Code, wMultiRec.Body.String())
	}

	var terrariaEgg models.Egg
	if err := env.db.Where("name = ?", "Terraria TShock").First(&terrariaEgg).Error; err != nil {
		t.Fatalf("Multipart imported egg not found: %v", err)
	}
}

// -------------------------------------------------------------
// Test 10: Admin User Management CRUD
// -------------------------------------------------------------
func TestAdminUserManagement(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Admin login
	wLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)
	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wLogin.Body.Bytes(), &loginResp)
	adminHeaders := map[string]string{"Authorization": "Bearer " + loginResp.Token}

	// 2. GET /api/admin/users
	wList := env.performRequest("GET", "/api/admin/users", nil, adminHeaders)
	if wList.Code != http.StatusOK {
		t.Fatalf("Expected 200 for GET /api/admin/users, got %d", wList.Code)
	}
	var listResp struct {
		Data []models.User `json:"data"`
	}
	_ = json.Unmarshal(wList.Body.Bytes(), &listResp)
	if len(listResp.Data) == 0 {
		t.Error("Expected at least 1 user (admin) in list")
	}

	// 3. POST /api/admin/users (Create new user)
	createReq := map[string]interface{}{
		"username":   "newdeveloper",
		"email":      "developer@pteronext.internal",
		"password":   "supersecretpassword",
		"root_admin": false,
		"name_first": "John",
		"name_last":  "Dev",
	}
	wCreate := env.performRequest("POST", "/api/admin/users", createReq, adminHeaders)
	if wCreate.Code != http.StatusCreated {
		t.Fatalf("Expected 201 for POST /api/admin/users, got %d: %s", wCreate.Code, wCreate.Body.String())
	}
	var createResp struct {
		Data models.User `json:"data"`
	}
	_ = json.Unmarshal(wCreate.Body.Bytes(), &createResp)
	newUserID := createResp.Data.ID
	if newUserID == 0 {
		t.Fatal("Expected created user to have non-zero ID")
	}
	if createResp.Data.Username != "newdeveloper" {
		t.Errorf("Expected username newdeveloper, got %s", createResp.Data.Username)
	}

	// 4. Duplicate creation should fail (409)
	wDup := env.performRequest("POST", "/api/admin/users", createReq, adminHeaders)
	if wDup.Code != http.StatusConflict {
		t.Errorf("Expected 409 conflict for duplicate user, got %d", wDup.Code)
	}

	// 5. PUT /api/admin/users/:id (Update user)
	updateReq := map[string]interface{}{
		"name_first": "Johnny",
		"name_last":  "Developer",
		"email":      "johnny.dev@pteronext.internal",
	}
	wUpdate := env.performRequest("PUT", fmt.Sprintf("/api/admin/users/%d", newUserID), updateReq, adminHeaders)
	if wUpdate.Code != http.StatusOK {
		t.Fatalf("Expected 200 for PUT /api/admin/users/:id, got %d", wUpdate.Code)
	}
	var updated models.User
	env.db.First(&updated, newUserID)
	if updated.NameFirst != "Johnny" || updated.Email != "johnny.dev@pteronext.internal" {
		t.Errorf("User update did not persist: %+v", updated)
	}

	// 6. Test RBAC: newly created user cannot access /api/admin/users
	wUserLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "newdeveloper",
		"password": "supersecretpassword",
	}, nil)
	var userLoginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wUserLogin.Body.Bytes(), &userLoginResp)
	userHeaders := map[string]string{"Authorization": "Bearer " + userLoginResp.Token}

	wForbidden := env.performRequest("GET", "/api/admin/users", nil, userHeaders)
	if wForbidden.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for non-admin on /api/admin/users, got %d", wForbidden.Code)
	}

	// 7. DELETE /api/admin/users/:id (Admin deletes test user)
	wDelete := env.performRequest("DELETE", fmt.Sprintf("/api/admin/users/%d", newUserID), nil, adminHeaders)
	if wDelete.Code != http.StatusOK {
		t.Fatalf("Expected 200 for DELETE /api/admin/users/:id, got %d", wDelete.Code)
	}
	var check models.User
	if err := env.db.First(&check, newUserID).Error; err == nil {
		t.Error("Expected user to be deleted from database")
	}

	// 8. Prevent self-deletion
	var adminUser models.User
	env.db.Where("username = ?", "admin").First(&adminUser)
	wSelfDelete := env.performRequest("DELETE", fmt.Sprintf("/api/admin/users/%d", adminUser.ID), nil, adminHeaders)
	if wSelfDelete.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request when admin attempts self-deletion, got %d", wSelfDelete.Code)
	}
}

// -------------------------------------------------------------
// Test 11: Server Creation with Nest, Egg, Environment & Startup Resolution
// -------------------------------------------------------------
func TestServerCreationWithEggAndEnvironment(t *testing.T) {
	env, cleanup := setupTestEnvironment(t)
	defer cleanup()

	// 1. Authenticate as admin
	wLogin := env.performRequest("POST", "/api/auth/login", map[string]string{
		"user":     "admin",
		"password": "admin123456",
	}, nil)
	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(wLogin.Body.Bytes(), &loginResp)
	authHeaders := map[string]string{"Authorization": "Bearer " + loginResp.Token}

	// 2. Fetch Paper egg from database
	var paperEgg models.Egg
	if err := env.db.Where("name = ?", "Paper").First(&paperEgg).Error; err != nil {
		t.Fatalf("Paper egg not found in DB: %v", err)
	}

	// 3. Create server with nest_id, egg_id, and custom environment variables
	createPayload := map[string]interface{}{
		"name":         "Custom Paper SMP",
		"description":  "Custom survival server with modified jar and settings",
		"node_id":      1,
		"nest_id":      paperEgg.NestID,
		"egg_id":       paperEgg.ID,
		"memory":       3072,
		"disk":         15360,
		"cpu":          300,
		"environment": map[string]interface{}{
			"SERVER_JARFILE":    "custom-purpur.jar",
			"MINECRAFT_VERSION": "1.20.4",
			"EXTRA_VM_FLAG":     "-XX:+UseG1GC",
		},
	}

	wCreate := env.performRequest("POST", "/api/servers", createPayload, authHeaders)
	if wCreate.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for POST /api/servers, got %d: %s", wCreate.Code, wCreate.Body.String())
	}

	var resp struct {
		Server          models.Server `json:"server"`
		ResolvedStartup string        `json:"resolved_startup"`
	}
	if err := json.Unmarshal(wCreate.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed unmarshaling server creation response: %v", err)
	}

	if resp.Server.ID == 0 {
		t.Fatal("Expected server ID to be assigned")
	}
	if resp.Server.EggID == nil || *resp.Server.EggID != paperEgg.ID {
		t.Errorf("Expected server EggID %d, got %v", paperEgg.ID, resp.Server.EggID)
	}
	if resp.Server.NestID == nil || *resp.Server.NestID != paperEgg.NestID {
		t.Errorf("Expected server NestID %d, got %v", paperEgg.NestID, resp.Server.NestID)
	}

	// Verify environment variables were configured properly
	var serverVars []models.ServerVariable
	env.db.Where("server_id = ?", resp.Server.ID).Find(&serverVars)

	var foundJar, foundVer, foundExtra bool
	for _, sv := range serverVars {
		if sv.EnvVariable == "SERVER_JARFILE" && sv.DefaultValue == "custom-purpur.jar" {
			foundJar = true
		}
		if sv.EnvVariable == "MINECRAFT_VERSION" && sv.DefaultValue == "1.20.4" {
			foundVer = true
		}
		if sv.EnvVariable == "EXTRA_VM_FLAG" && sv.DefaultValue == "-XX:+UseG1GC" {
			foundExtra = true
		}
	}
	if !foundJar {
		t.Errorf("SERVER_JARFILE not properly set with custom value: %+v", serverVars)
	}
	if !foundVer {
		t.Errorf("MINECRAFT_VERSION not properly set with custom value: %+v", serverVars)
	}
	if !foundExtra {
		t.Errorf("EXTRA_VM_FLAG not set with dynamic environment value: %+v", serverVars)
	}

	// Verify resolved startup parsed the variables properly
	if !strings.Contains(resp.ResolvedStartup, "custom-purpur.jar") {
		t.Errorf("Resolved startup does not contain custom jar: %s", resp.ResolvedStartup)
	}

	// 4. GET /api/servers/:uuid also resolves startup command correctly
	wGet := env.performRequest("GET", fmt.Sprintf("/api/servers/%s", resp.Server.UUID), nil, authHeaders)
	if wGet.Code != http.StatusOK {
		t.Fatalf("Expected 200 for GET /api/servers/:uuid, got %d", wGet.Code)
	}
	var getResp struct {
		Server          models.Server `json:"server"`
		ResolvedStartup string        `json:"resolved_startup"`
	}
	_ = json.Unmarshal(wGet.Body.Bytes(), &getResp)
	if !strings.Contains(getResp.ResolvedStartup, "custom-purpur.jar") {
		t.Errorf("GET /api/servers/:uuid resolved startup mismatch: %s", getResp.ResolvedStartup)
	}

	// 5. Test Remote Wings Install Data utilizes Egg install script
	wInstall := env.performRequest("GET", fmt.Sprintf("/api/remote/servers/%s/install", resp.Server.UUID), nil, map[string]string{
		"Authorization": "Bearer daemon_node_default.secret_token_pteronext_wings_daemon_key",
	})
	if wInstall.Code != http.StatusOK {
		t.Fatalf("Expected 200 for /api/remote/servers/:uuid/install, got %d", wInstall.Code)
	}
	var installResp struct {
		ContainerImage string `json:"container_image"`
		Script         string `json:"script"`
	}
	_ = json.Unmarshal(wInstall.Body.Bytes(), &installResp)
	if !strings.Contains(installResp.Script, "Paper Installation Script") {
		t.Errorf("Expected Paper installation script, got: %s", installResp.Script)
	}
}

