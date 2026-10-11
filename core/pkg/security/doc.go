// Package security provides a comprehensive enterprise-grade Security and Role-Based Access
// Control (RBAC) engine for PteroNext / Pterodactyl Panel Core.
//
// Key Subsystems:
//
//  1. Granular RBAC:
//     - Fine-grained server and admin permission identifiers (e.g. server.power.restart, server.files.read,
//       admin.nodes.write, admin.users).
//     - Hierarchical matching with wildcards (e.g. "*", "server.*", "server.power" implies "server.power.start").
//     - Permission registry with scopes, categories, and human-readable metadata.
//     - Fast, memory-efficient PermissionSet for evaluating single or combined permission requirements.
//
//  2. Multi-Tier Roles & Per-Server Assignments:
//     - Built-in system roles: Owner (full server wildcard), Admin (operational/management),
//       Moderator (console/power/logs), Viewer (read-only observer).
//     - Custom roles created per server with custom permission sets.
//     - ServerRoleAssignment with direct granted permissions and explicit denied permission overrides.
//     - Server ownership resolution and global administrative superuser bypass.
//
//  3. Cryptographic Tokens & Password Hashing:
//     - OWASP-compliant Argon2id password hashing and verification in standard PHC format.
//     - Bcrypt compatibility layer with automatic algorithm detection upon verification.
//     - Rehash detection to smoothly upgrade legacy hashes upon user login.
//     - Cryptographically secure random token generator for session tokens and API keys.
//     - Wings daemon token pair generator (<id>.<secret>) with constant-time verification.
//
//  4. TOTP Two-Factor Authentication (RFC 6238):
//     - Base32 secret generation and otpauth:// provisioning URIs.
//     - Automatic QR Code PNG and base64 Data URL generation for zero-frontend-dependency embedding.
//     - Time skew tolerance (±1 step window).
//     - Replay prevention using time step tracking.
//     - Formatted, cryptographically secure single-use recovery backup codes with hashed storage.
//
//  5. Audit Log Engine:
//     - Automatic recording of administrative, server-level, and authentication events.
//     - Structured entries tracking User ID, Client IP, Action, Target, Timestamp, Status, and Payload Summary.
//     - Thread-safe memory sink with bounded ring buffer eviction and pluggable persistent sink interface.
//     - Optional asynchronous worker queue to decouple audit persistence from latency-critical operations.
//     - Gin HTTP middleware for automatic route interception and access audit recording.
package security
