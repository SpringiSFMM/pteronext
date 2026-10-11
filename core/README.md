# PteroNext Panel Core (Next-Gen Pterodactyl Backend)

The high-performance, lightweight Go backend core for the Next-Gen Pterodactyl Panel ecosystem.

Built to be blisteringly fast, resource-efficient, and compatible with the official **Wings** daemon (`github.com/pterodactyl/wings`), this core replaces legacy PHP runtimes with a single native Go binary backed by an embedded SQLite database running in **WAL mode**.

---

## Key Features

1. **Pure Go & High Performance**
   - Built on Go 1.27 + Gin Web Framework.
   - Zero-CGO SQLite engine via `github.com/glebarez/sqlite` (pure Go SQLite driver based on `modernc.org/sqlite`).
   - SQLite configured with `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, and high-concurrency pooling for millisecond response times.

2. **Automated Database Migrations & Seeding**
   - Auto-migrates tables for: `Users`, `Roles`, `Permissions`, `Subusers`, `Servers`, `ServerVariables`, `Nodes`, `Allocations`, `Schedules`, `Tasks`, `AuditLogs`, `Databases`, `DatabaseHosts`, `APIKeys`, and `Backups`.
   - Built-in seeder initializes default administrator account, roles, permissions, node, allocations, and demo server.

3. **Wings Compatibility API (`/api/remote/*`)**
   - Complete drop-in compatibility with the Wings daemon remote client requirements.
   - Authentication via Wings daemon tokens: `Authorization: Bearer <daemon_token_id>.<daemon_token_secret>`.
   - `/api/remote/servers`: Paginated server configuration lists with `settings` and `process_configuration` formats expected by Wings.
   - `/api/remote/servers/:uuid`: Single-server details for daemon self-recovery.
   - `/api/remote/servers/reset`: Daemon reboot state cleanup.
   - `/api/remote/activity`: Wings real-time activity and security audit ingestion.
   - `/api/remote/servers/:uuid/install`: Installation container and bash scripts.
   - `/api/remote/backups/:backup`: Remote backup upload endpoints, status reporting, and restore notifications.
   - `/api/remote/sftp/auth`: Daemon SFTP authentication endpoint for internal SFTP server.

4. **Panel REST & WebSocket API**
   - **Authentication**: JWT authentication (`/api/auth/login`, `/api/auth/register`, `/api/auth/me`) + `ptl_` API key support.
   - **RBAC**: Role-based access control and granular server permissions.
   - **Server Management**: Full CRUD (`/api/servers`), environment variable configuration, and allocation management.
   - **Power Actions**: `/api/servers/:uuid/power` (`start`, `stop`, `restart`, `kill`) forwarded to the Wings daemon on nodes with local fallback.
   - **Console / Terminal WebSocket**: `/api/servers/:uuid/ws` with live interactive shell, command execution, and telemetry streaming.
   - **System Telemetry**: `/api/system/stats` (Go runtime, memory alloc, goroutines, DB size, server counts).
   - **Node Management & Config Generator**: `/api/nodes/:id/configuration` generates ready-to-use Wings `config.yml`.

5. **Single-Binary Frontend Integration**
   - Ready to mount embedded frontend SPA distributions via `pkg/web`.

---

## Quick Start

### Build
```bash
cd /Users/springi_sfm/panel/core
go build -o pteronext-core main.go
```

### Run
```bash
./pteronext-core --port 8080 --db ./pteronext.db
```

### Default Credentials
Upon initial boot, the database is auto-seeded:
- **Admin Username**: `admin`
- **Admin Email**: `admin@pteronext.internal`
- **Admin Password**: `admin123456`
- **Default Node**: `Local Wings Node` (`127.0.0.1:8080`)
- **Default Daemon Token ID**: `daemon_node_default`
- **Default Daemon Token Secret**: `secret_token_pteronext_wings_daemon_key`

---

## API Summary

### Remote Wings Daemon Endpoints (`/api/remote/*`)
*Headers: `Authorization: Bearer <token_id>.<token_secret>`*
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/remote/servers` | Server configurations list for Wings |
| `POST` | `/api/remote/servers/reset` | Cleans stuck installing/restoring states on node boot |
| `GET` | `/api/remote/servers/:uuid` | Single server configuration for self-recovery |
| `POST` | `/api/remote/activity` | Ingests daemon event logs |
| `GET` | `/api/remote/servers/:uuid/install` | Installation container and script |
| `POST` | `/api/remote/servers/:uuid/install` | Installation outcome report |
| `GET` | `/api/remote/backups/:backup` | Backup upload metadata |
| `POST` | `/api/remote/backups/:backup` | Backup completion report |
| `POST` | `/api/remote/backups/:backup/restore` | Backup restoration report |
| `POST` | `/api/remote/sftp/auth` | Daemon internal SFTP user authentication |

### Panel Client REST API (`/api/*`)
*Headers: `Authorization: Bearer <JWT or ptl_key>`*
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login and obtain JWT token |
| `POST` | `/api/auth/register` | Register new account |
| `GET` | `/api/auth/me` | Current user profile & permissions |
| `GET` | `/api/system/stats` | Panel runtime performance metrics |
| `GET` | `/api/servers` | List servers |
| `POST` | `/api/servers` | Create a new server container |
| `GET` | `/api/servers/:uuid` | Server details & resolved startup command |
| `PATCH` | `/api/servers/:uuid` | Update server configuration |
| `DELETE` | `/api/servers/:uuid` | Delete server container |
| `POST` | `/api/servers/:uuid/power` | Power actions (`start`, `stop`, `restart`, `kill`) |
| `GET` | `/api/servers/:uuid/resources` | Container memory, CPU, disk, network telemetry |
| `GET` | `/api/servers/:uuid/ws` | Live WebSocket console terminal & stats proxy |
| `GET` | `/api/servers/:uuid/schedules` | Automated cron schedules |
| `POST` | `/api/servers/:uuid/schedules` | Create automated schedule |
| `GET` | `/api/servers/:uuid/databases` | Server databases |
| `POST` | `/api/servers/:uuid/databases` | Provision new database |
| `GET` | `/api/nodes` | List nodes (Admin only) |
| `POST` | `/api/nodes` | Create node (Admin only) |
| `GET` | `/api/nodes/:id/configuration` | Generate Wings `config.yml` |
| `GET` | `/api/account/api-keys` | List account API keys |
| `POST` | `/api/account/api-keys` | Generate new API key (`ptl_...`) |
| `GET` | `/api/audit-logs` | Query activity and security audit trail |

---

## Testing

Run the full integration test suite:
```bash
go test -v ./tests
```
All integration tests verify WAL mode, auto-migrations, JWT & API key authentication, RBAC, remote Wings endpoints, power actions, WebSockets, and system telemetry.
