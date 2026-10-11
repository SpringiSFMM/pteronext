package security_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/pteronext/panel-core/pkg/security"
	"golang.org/x/crypto/bcrypt"
)

func TestSecurityManagerIntegration(t *testing.T) {
	pm := security.NewPasswordManagerWithOptions(
		security.AlgorithmArgon2id,
		security.FastArgon2idParams(),
		bcrypt.MinCost,
	)

	customRoleStore := security.NewMemoryRoleStore()
	customAuditSink := security.NewMemoryAuditStore(200)

	sec := security.New(
		security.WithTOTPIssuer("PteroNext-Cluster"),
		security.WithPasswordManager(pm),
		security.WithRoleStore(customRoleStore),
		security.WithAuditSink(customAuditSink),
		security.WithAuditBufferSize(0), // sync logging for testing
	)
	defer sec.Close()

	ctx := context.Background()
	serverID := "srv-production-01"
	ownerUserID := "usr_alice"
	modUserID := "usr_bob"

	// Configure server owner
	_ = sec.Authorizer.Store().SetServerOwner(ctx, serverID, ownerUserID)

	// Assign Moderator role to Bob
	_, err := sec.Authorizer.AssignRole(ctx, serverID, modUserID, security.SystemRoleModeratorID, nil, nil)
	if err != nil {
		t.Fatalf("failed to assign role: %v", err)
	}

	// 1. AuthorizeAndAudit - Owner doing power restart (Allowed)
	allowed := sec.AuthorizeAndAudit(
		ctx,
		ownerUserID,
		"192.168.1.10",
		serverID,
		security.PermissionServerPowerRestart,
		"server.power.restart",
		map[string]any{"action": "restart"},
	)
	if !allowed {
		t.Errorf("expected owner to be authorized")
	}

	// 2. AuthorizeAndAudit - Mod doing database delete (Denied)
	allowed = sec.AuthorizeAndAudit(
		ctx,
		modUserID,
		"192.168.1.20",
		serverID,
		security.PermissionServerDatabaseDelete,
		"server.database.delete",
		map[string]any{"database": "production_db"},
	)
	if allowed {
		t.Errorf("expected moderator to be denied for database.delete")
	}

	// 3. Verify that both actions were logged in the audit sink
	logs, count, err := sec.Audit.Query(ctx, security.AuditFilter{TargetID: serverID})
	if err != nil || count != 2 {
		t.Fatalf("expected 2 audit entries, got count=%d, err=%v", count, err)
	}

	var hasSuccess, hasDenied bool
	for _, l := range logs {
		if l.Status == security.AuditStatusSuccess && l.UserID == ownerUserID {
			hasSuccess = true
		}
		if l.Status == security.AuditStatusDenied && l.UserID == modUserID {
			hasDenied = true
		}
	}
	if !hasSuccess || !hasDenied {
		t.Errorf("expected both success and denied audit logs in sink")
	}

	// 4. Enforce test
	err = sec.Enforce(ctx, ownerUserID, "127.0.0.1", serverID, security.PermissionServerPower, "test", nil)
	if err != nil {
		t.Errorf("expected Enforce to succeed for owner, got: %v", err)
	}

	err = sec.Enforce(ctx, modUserID, "127.0.0.1", serverID, security.PermissionServerDatabaseCreate, "test", nil)
	if err != security.ErrAccessDenied {
		t.Errorf("expected ErrAccessDenied for unauthorized mod, got: %v", err)
	}
}

func TestGinSecurityMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sec := security.New(security.WithAuditBufferSize(0))
	defer sec.Close()

	ctx := context.Background()
	serverID := "srv-game-77"
	ownerUserID := "usr_owner_guy"
	regularUserID := "usr_guest_guy"
	adminUserID := "usr_super_admin"

	_ = sec.Authorizer.Store().SetServerOwner(ctx, serverID, ownerUserID)
	_ = sec.Authorizer.Store().SetGlobalAdmin(ctx, adminUserID, true)

	r := gin.New()

	// Protected server route
	r.POST("/api/client/servers/:server/power", func(c *gin.Context) {
		// simulate auth middleware setting user_id from token header
		c.Set("user_id", c.GetHeader("X-User-ID"))
		c.Next()
	}, sec.RequirePermission(security.PermissionServerPowerStart), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "power signal sent"})
	})

	// Protected admin route
	r.GET("/api/application/nodes", func(c *gin.Context) {
		c.Set("user_id", c.GetHeader("X-User-ID"))
		c.Next()
	}, sec.RequireAdmin(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"nodes": []string{"node1", "node2"}})
	})

	// 1. Owner accessing server power -> 200 OK
	req1 := httptest.NewRequest(http.MethodPost, "/api/client/servers/"+serverID+"/power", nil)
	req1.Header.Set("X-User-ID", ownerUserID)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for server owner, got %d", w1.Code)
	}

	// 2. Regular user accessing server power -> 403 Forbidden
	req2 := httptest.NewRequest(http.MethodPost, "/api/client/servers/"+serverID+"/power", nil)
	req2.Header.Set("X-User-ID", regularUserID)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unprivileged user, got %d", w2.Code)
	}

	// 3. Regular user accessing admin route -> 403 Forbidden
	req3 := httptest.NewRequest(http.MethodGet, "/api/application/nodes", nil)
	req3.Header.Set("X-User-ID", regularUserID)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin, got %d", w3.Code)
	}

	// 4. Admin accessing admin route -> 200 OK
	req4 := httptest.NewRequest(http.MethodGet, "/api/application/nodes", nil)
	req4.Header.Set("X-User-ID", adminUserID)
	w4 := httptest.NewRecorder()
	r.ServeHTTP(w4, req4)
	if w4.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin, got %d", w4.Code)
	}
}
