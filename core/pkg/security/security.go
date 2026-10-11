package security

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

var (
	ErrAccessDenied = errors.New("access denied: insufficient permissions")
)

// Config configures the unified SecurityManager.
type Config struct {
	TOTPIssuer      string
	AuditBufferSize int
	AuditCapacity   int
	RoleStore       RoleStore
	AuditSink       AuditSink
	PasswordManager *PasswordManager
	Registry        *Registry
}

// Option modifies the SecurityManager configuration.
type Option func(*Config)

// WithTOTPIssuer sets the 2FA issuer name displayed in authenticator apps.
func WithTOTPIssuer(issuer string) Option {
	return func(c *Config) {
		c.TOTPIssuer = issuer
	}
}

// WithAuditBufferSize sets the asynchronous audit log channel buffer size.
func WithAuditBufferSize(size int) Option {
	return func(c *Config) {
		c.AuditBufferSize = size
	}
}

// WithRoleStore overrides the default in-memory role store.
func WithRoleStore(store RoleStore) Option {
	return func(c *Config) {
		c.RoleStore = store
	}
}

// WithAuditSink overrides the default in-memory audit log store.
func WithAuditSink(sink AuditSink) Option {
	return func(c *Config) {
		c.AuditSink = sink
	}
}

// WithPasswordManager sets a custom configured password manager.
func WithPasswordManager(pm *PasswordManager) Option {
	return func(c *Config) {
		c.PasswordManager = pm
	}
}

// SecurityManager is the central facade providing RBAC, Cryptography, 2FA, and Audit Logging.
type SecurityManager struct {
	Registry        *Registry
	Authorizer      *Authorizer
	PasswordManager *PasswordManager
	TOTP            *TOTPHelper
	Audit           *AuditLogger
}

// New creates a fully initialized SecurityManager with all subsystems wired together.
func New(opts ...Option) *SecurityManager {
	cfg := Config{
		TOTPIssuer:      "PteroNext",
		AuditBufferSize: 1000,
		AuditCapacity:   50000,
	}
	for _, opt := range opts {
		opt(&cfg)
	}

	if cfg.Registry == nil {
		cfg.Registry = DefaultRegistry()
	}
	if cfg.RoleStore == nil {
		cfg.RoleStore = NewMemoryRoleStore()
	}
	if cfg.AuditSink == nil {
		cfg.AuditSink = NewMemoryAuditStore(cfg.AuditCapacity)
	}
	if cfg.PasswordManager == nil {
		cfg.PasswordManager = NewPasswordManager()
	}

	authorizer := NewAuthorizer(cfg.RoleStore, cfg.Registry)
	totp := NewTOTPHelper(cfg.TOTPIssuer)
	audit := NewAuditLogger(cfg.AuditSink, cfg.AuditBufferSize)

	return &SecurityManager{
		Registry:        cfg.Registry,
		Authorizer:      authorizer,
		PasswordManager: cfg.PasswordManager,
		TOTP:            totp,
		Audit:           audit,
	}
}

// Close gracefully flushes audit logs and releases resources.
func (sm *SecurityManager) Close() {
	if sm.Audit != nil {
		sm.Audit.Close()
	}
}

// AuthorizeAndAudit checks whether a user has permission on a server, and automatically
// records the decision in the audit log.
func (sm *SecurityManager) AuthorizeAndAudit(
	ctx context.Context,
	userID string,
	ip string,
	serverID string,
	perm Permission,
	action string,
	payload map[string]any,
) bool {
	allowed := sm.Authorizer.Can(ctx, userID, serverID, perm)

	status := AuditStatusSuccess
	var errMsg string
	if !allowed {
		status = AuditStatusDenied
		errMsg = fmt.Sprintf("Missing required permission %q", perm)
	}

	target := "system"
	targetType := "system"
	targetID := ""
	if serverID != "" {
		target = "server:" + serverID
		targetType = "server"
		targetID = serverID
	}

	_ = sm.Audit.Log(ctx, &AuditEntry{
		UserID:         userID,
		IP:             ip,
		Action:         action,
		Target:         target,
		TargetType:     targetType,
		TargetID:       targetID,
		Status:         status,
		ErrorMessage:   errMsg,
		PayloadSummary: payload,
	})

	return allowed
}

// Enforce evaluates the permission, logs the audit entry, and returns ErrAccessDenied if unauthorized.
func (sm *SecurityManager) Enforce(
	ctx context.Context,
	userID string,
	ip string,
	serverID string,
	perm Permission,
	action string,
	payload map[string]any,
) error {
	if !sm.AuthorizeAndAudit(ctx, userID, ip, serverID, perm, action, payload) {
		return ErrAccessDenied
	}
	return nil
}

// --- Gin RBAC Route Middleware ---

// RequirePermission returns Gin middleware enforcing a specific permission on a server.
// It retrieves the authenticated user ID and server ID from the context or parameters.
func (sm *SecurityManager) RequirePermission(perm Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			return
		}

		serverID := c.Param("server")
		if serverID == "" {
			serverID = c.Param("server_id")
		}

		action := fmt.Sprintf("%s %s", c.Request.Method, c.FullPath())
		allowed := sm.AuthorizeAndAudit(
			c.Request.Context(),
			userID,
			c.ClientIP(),
			serverID,
			perm,
			action,
			map[string]any{
				"permission": string(perm),
				"route":      c.FullPath(),
			},
		)

		if !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":      "You do not have permission to perform this action",
				"permission": string(perm),
			})
			return
		}

		c.Next()
	}
}

// RequireAdmin returns Gin middleware requiring global administrative privileges.
func (sm *SecurityManager) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			return
		}

		isAdmin, err := sm.Authorizer.Store().IsGlobalAdmin(c.Request.Context(), userID)
		if err != nil || !isAdmin {
			_ = sm.Audit.Log(c.Request.Context(), &AuditEntry{
				UserID:       userID,
				IP:           c.ClientIP(),
				Action:       fmt.Sprintf("%s %s", c.Request.Method, c.FullPath()),
				Target:       "admin:panel",
				TargetType:   "admin",
				Status:       AuditStatusDenied,
				ErrorMessage: "Global admin required",
			})

			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Administrative privileges required",
			})
			return
		}

		c.Next()
	}
}
