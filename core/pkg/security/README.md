# PteroNext Security & RBAC Engine (`pkg/security`)

A high-performance, enterprise-grade Security and Role-Based Access Control (RBAC) subsystem designed for **PteroNext / Pterodactyl Panel Core** in Go.

---

## Features Overview

1. **Granular RBAC System**:
   - Comprehensive permission catalog (`server.power`, `server.console.read`, `server.console.write`, `server.files.read`, `server.files.write`, `server.database.create`, `server.schedules.manage`, `admin.nodes`, `admin.users`, etc.).
   - Hierarchical wildcard matching (`*`, `server.*`, `server.files.*`) and semantic inheritance (`server.power` implies `server.power.start`, `server.power.stop`, etc.).
   - Permission metadata registry with scopes (`server`, `admin`, `global`), human-readable labels, and categories.
   - High-speed `PermissionSet` with $O(1)$ fast paths.

2. **Server Role Management**:
   - Built-in system roles: **Owner** (full unrestricted control), **Admin** (operational & managerial), **Moderator** (console, power, log inspection), and **Viewer** (read-only observer).
   - Custom server-specific roles: Create, update, and delete roles on a per-server basis.
   - Per-server role assignments supporting both **direct permission grants** and **explicit deny overrides** (deny takes precedence).
   - Fast ownership check and global superadmin bypass.

3. **Modern Cryptographic Token & Password Hashing**:
   - **Argon2id**: OWASP-recommended default with configurable memory, iterations, parallelism, and standard PHC format (`$argon2id$v=19$m=...`).
   - **bcrypt**: Full backward compatibility for legacy hashes (`$2a$`, `$2b$`, `$2y$`).
   - Unified `PasswordManager` with automatic hash-type detection and `NeedsRehash` migration triggers.
   - Secure random token generation (`ptero_...`), constant-time string and SHA-256 token verification.
   - Wings daemon token pair generator (`<token_id>.<token_secret>`).

4. **TOTP Two-Factor Authentication (RFC 6238)**:
   - Compatible with Google Authenticator, 1Password, Bitwarden, Authy, Apple Keychain.
   - Base32 random secrets with standard `otpauth://` URI generation.
   - Instant QR code rendering (raw PNG bytes and direct HTML `data:image/png;base64,...` Data URL).
   - Clock drift skew tolerance (configurable, default $\pm 30\text{s}$) with matched timestamp counter to prevent replay attacks.
   - Single-use recovery backup codes formatted in readable chunks (`ABCD-EFGH`) with hashed storage.

5. **Audit Log Engine**:
   - Automatically records administrative and server-level events with User ID, Client IP, Action, Target, Timestamp, Status, and structured Payload summaries.
   - High-throughput asynchronous worker pool with non-blocking channels and graceful flushing on shutdown.
   - Flexible query filtering by User ID, Target ID, Action Prefix, Status, and date range with pagination.
   - Gin HTTP middleware for automatic audit logging and route protection.

---

## Architecture

```
                      +-----------------------------+
                      |       SecurityManager       |
                      +--------------+--------------+
                                     |
    +-----------------+--------------+--------------+-----------------+
    |                 |                             |                 |
+---+----+      +-----+------+                +-----+-----+     +-----+-----+
|  RBAC  |      |   Crypto   |                |   TOTP    |     |   Audit   |
| Engine |      |  & Tokens  |                |    2FA    |     |  Logger   |
+---+----+      +-----+------+                +-----+-----+     +-----+-----+
    |                 |                             |                 |
Permissions      Argon2id / Bcrypt             RFC 6238          Async Queue
Built-in Roles   Token Pairs                   QR Generation     Query Engine
Custom Roles     Constant-Time Compare         Backup Codes      Gin Interceptor
Server Assgn.
```

---

## Quick Start & Usage Examples

### 1. Initializing the Security Manager

```go
package main

import (
    "github.com/pteronext/panel-core/pkg/security"
)

func main() {
    sec := security.New(
        security.WithTOTPIssuer("My Panel"),
        security.WithAuditBufferSize(1000), // Async queue
    )
    defer sec.Close()
}
```

---

### 2. RBAC & Server Role Assignment

```go
ctx := context.Background()
serverID := "srv-1001"
userID := "usr-2002"

// Assign built-in Moderator role
assignment, err := sec.Authorizer.AssignRole(
    ctx,
    serverID,
    userID,
    security.SystemRoleModeratorID,
    []security.Permission{security.PermissionServerFilesRead}, // Direct grant
    []security.Permission{security.PermissionServerPowerKill}, // Explicit deny
)

// Check permissions
canStart := sec.Authorizer.Can(ctx, userID, serverID, security.PermissionServerPowerStart) // true
canKill := sec.Authorizer.Can(ctx, userID, serverID, security.PermissionServerPowerKill)   // false (denied)
```

---

### 3. Password Hashing & Tokens

```go
// Hash with Argon2id
hash, err := sec.PasswordManager.HashPassword("UserPassword123!")
// Output format: $argon2id$v=19$m=65536,t=3,p=2$...

// Verify (auto-detects Argon2id or legacy bcrypt)
valid, err := sec.PasswordManager.VerifyPassword("UserPassword123!", hash)

// Detect if older bcrypt hash needs automatic upgrade to Argon2id
if sec.PasswordManager.NeedsRehash(legacyHash) {
    newHash, _ := sec.PasswordManager.HashPassword(plaintext)
    // Save newHash to database
}

// Generate Wings Daemon Token Pair (<id>.<secret>)
pair, err := security.GenerateDaemonTokenPair()
fmt.Println("Node Daemon Token:", pair.FullToken)
```

---

### 4. TOTP 2FA Enrollment & Verification

```go
// Generate 2FA setup for user
setup, err := sec.TOTP.GenerateSetup("user@example.com", 10)

fmt.Println("Base32 Secret:", setup.Secret)
fmt.Println("Data URL (ready for <img src=...>):", setup.QRCodeDataURL)
fmt.Println("Recovery Backup Codes:", setup.BackupCodes)

// Store setup.HashedBackupCodes securely in database

// Verify TOTP token from user's authenticator app
valid := sec.TOTP.VerifyCode(setup.Secret, "123456")

// Verify and consume single-use backup code
idx, ok := security.VerifyBackupCode("ABCD-EFGH", userHashedBackupCodes)
if ok {
    // Remove code at idx from stored list
    userHashedBackupCodes = append(userHashedBackupCodes[:idx], userHashedBackupCodes[idx+1:]...)
}
```

---

### 5. Audit Logging & Gin Route Protection

```go
// Enforce permission and automatically record audit log
err := sec.Enforce(
    ctx,
    userID,
    "192.168.1.15",
    serverID,
    security.PermissionServerPowerRestart,
    "server.power.restart",
    map[string]any{"signal": "restart"},
)
if err != nil {
    // Returns security.ErrAccessDenied and logs denied attempt
}

// Gin Middleware Integration
router := gin.Default()

// Enforce specific permission on route
router.POST(
    "/api/client/servers/:server/power",
    authMiddleware,
    sec.RequirePermission(security.PermissionServerPowerStart),
    powerHandler,
)

// Enforce administrative permissions
router.GET(
    "/api/application/nodes",
    authMiddleware,
    sec.RequireAdmin(),
    nodesHandler,
)
```

---

## Test Verification

Run all unit and integration tests with the Go race detector:

```bash
go test -v -race ./pkg/security
```

Check test coverage:

```bash
go test -coverprofile=coverage.out ./pkg/security
go tool cover -func=coverage.out
```

Current test suite coverage: **87.4%** across all components.
