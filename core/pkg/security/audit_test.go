package security_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/pkg/security"
)

func TestAuditLogEngine(t *testing.T) {
	store := security.NewMemoryAuditStore(100)
	logger := security.NewAuditLogger(store, 0) // synchronous for immediate assertion
	ctx := context.Background()

	// Record administrative action
	err := logger.LogAdminAction(
		ctx,
		"usr_admin_1",
		"192.168.1.50",
		string(security.PermissionAdminNodesWrite),
		"node",
		"node_eu_1",
		security.AuditStatusSuccess,
		map[string]any{"fqdn": "node.eu.pteronext.test", "memory": 32768},
	)
	if err != nil {
		t.Fatalf("failed to log admin action: %v", err)
	}

	// Record server action
	err = logger.LogServerAction(
		ctx,
		"usr_mod_2",
		"10.0.0.12",
		string(security.PermissionServerPowerStart),
		"srv_minecraft_9",
		security.AuditStatusSuccess,
		map[string]any{"signal": "start"},
	)
	if err != nil {
		t.Fatalf("failed to log server action: %v", err)
	}

	// Record denied server action
	err = logger.Log(ctx, &security.AuditEntry{
		UserID:       "usr_guest_3",
		IP:           "172.16.0.4",
		Action:       string(security.PermissionServerDatabaseDelete),
		Target:       "server:srv_minecraft_9",
		TargetType:   "server",
		TargetID:     "srv_minecraft_9",
		Status:       security.AuditStatusDenied,
		ErrorMessage: "Insufficient privileges",
	})
	if err != nil {
		t.Fatalf("failed to log denied action: %v", err)
	}

	// Record auth action
	err = logger.LogAuthAction(
		ctx,
		"usr_auth_user",
		"192.168.1.50",
		"auth.login.totp",
		security.AuditStatusSuccess,
		map[string]any{"method": "totp"},
	)
	if err != nil {
		t.Fatalf("failed to log auth action: %v", err)
	}

	// Query all
	all, total, err := logger.Query(ctx, security.AuditFilter{})
	if err != nil || total != 4 || len(all) != 4 {
		t.Fatalf("expected 4 entries, got total=%d len=%d err=%v", total, len(all), err)
	}

	// Filter by User
	userEntries, count, _ := logger.Query(ctx, security.AuditFilter{UserID: "usr_admin_1"})
	if count != 1 || userEntries[0].TargetID != "node_eu_1" {
		t.Errorf("user filter failed")
	}

	// Filter by TargetID
	_, count, _ = logger.Query(ctx, security.AuditFilter{TargetID: "srv_minecraft_9"})
	if count != 2 {
		t.Errorf("expected 2 server entries, got %d", count)
	}

	// Filter by Action Prefix
	_, count, _ = logger.Query(ctx, security.AuditFilter{ActionPrefix: "admin."})
	if count != 1 {
		t.Errorf("expected 1 admin action, got %d", count)
	}

	// Filter by Status
	deniedEntries, count, _ := logger.Query(ctx, security.AuditFilter{Status: security.AuditStatusDenied})
	if count != 1 || deniedEntries[0].ErrorMessage != "Insufficient privileges" {
		t.Errorf("expected 1 denied action")
	}

	// Get by ID
	single, err := logger.GetByID(ctx, all[0].ID)
	if err != nil || single.ID != all[0].ID {
		t.Errorf("GetByID failed: %v", err)
	}
}

func TestAsyncAuditLogger(t *testing.T) {
	store := security.NewMemoryAuditStore(100)
	logger := security.NewAuditLogger(store, 50) // async channel
	ctx := context.Background()

	for i := 0; i < 20; i++ {
		_ = logger.LogServerAction(
			ctx,
			"usr_test",
			"127.0.0.1",
			string(security.PermissionServerPowerRestart),
			"srv_1",
			security.AuditStatusSuccess,
			map[string]any{"iter": i},
		)
	}

	// Graceful close flushes async channel
	logger.Close()

	entries, count, err := store.Query(ctx, security.AuditFilter{})
	if err != nil || count != 20 || len(entries) != 20 {
		t.Errorf("expected 20 entries flushed, got count=%d, err=%v", count, err)
	}
}

func TestMemoryAuditStoreEviction(t *testing.T) {
	store := security.NewMemoryAuditStore(5)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		_ = store.Write(ctx, &security.AuditEntry{
			UserID: "user",
			Action: "test.action",
			Target: "target",
			Status: security.AuditStatusSuccess,
		})
	}

	entries, count, err := store.Query(ctx, security.AuditFilter{})
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 5 || len(entries) != 5 {
		t.Errorf("expected bounded capacity of 5, got %d", count)
	}
}

func TestGinAuditMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := security.NewMemoryAuditStore(100)
	logger := security.NewAuditLogger(store, 0)
	router := gin.New()

	router.Use(func(c *gin.Context) {
		c.Set("user_id", "usr_web_client")
		c.Next()
	})
	router.Use(security.GinAuditMiddleware(logger, "http.server.power"))

	router.POST("/api/servers/:server/power", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "starting"})
	})

	router.DELETE("/api/servers/:server", func(c *gin.Context) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
	})

	// Test 200 OK request
	req1 := httptest.NewRequest(http.MethodPost, "/api/servers/srv-node-1/power", nil)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w1.Code)
	}

	// Test 403 Forbidden request
	req2 := httptest.NewRequest(http.MethodDelete, "/api/servers/srv-node-1", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w2.Code)
	}

	entries, count, err := logger.Query(context.Background(), security.AuditFilter{})
	if err != nil || count != 2 {
		t.Fatalf("expected 2 audit entries recorded by middleware, got %d", count)
	}

	// Check that denied status was recorded for 403
	var deniedFound, successFound bool
	for _, e := range entries {
		if e.Status == security.AuditStatusDenied {
			deniedFound = true
		}
		if e.Status == security.AuditStatusSuccess {
			successFound = true
		}
		if e.TargetID != "srv-node-1" {
			t.Errorf("expected target ID srv-node-1, got %s", e.TargetID)
		}
	}

	if !deniedFound || !successFound {
		t.Errorf("expected both success and denied audit entries to be logged by middleware")
	}
}
