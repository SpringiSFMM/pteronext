package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ReleaseItem struct {
	Version      string   `json:"version"`
	Date         string   `json:"date"`
	Title        string   `json:"title"`
	TitleEN      string   `json:"title_en"`
	Description  string   `json:"description"`
	DescriptionEN string  `json:"description_en"`
	Tag          string   `json:"tag"`
	TagEN        string   `json:"tag_en"`
	IsLatest     bool     `json:"is_latest"`
	Highlights   []string `json:"highlights"`
	HighlightsEN []string `json:"highlights_en"`
	Features     []string `json:"features"`
	FeaturesEN   []string `json:"features_en"`
	Security     []string `json:"security"`
	SecurityEN   []string `json:"security_en"`
	Improvements []string `json:"improvements"`
	ImprovementsEN []string `json:"improvements_en"`
}

type GitHubRelease struct {
	TagName     string    `json:"tag_name"`
	Name        string    `json:"name"`
	Body        string    `json:"body"`
	PublishedAt time.Time `json:"published_at"`
	Prerelease  bool      `json:"prerelease"`
}

type GitHubTag struct {
	Name   string `json:"name"`
	Commit struct {
		SHA string `json:"sha"`
	} `json:"commit"`
}

type ChangelogController struct {
	githubRepo    string
	mu            sync.RWMutex
	cachedGitHub  []ReleaseItem
	lastFetchTime time.Time
}

func NewChangelogController() *ChangelogController {
	return &ChangelogController{
		githubRepo: "SpringiSFMM/pteronext",
	}
}

func (ch *ChangelogController) fetchGitHubSync() []ReleaseItem {
	ch.mu.RLock()
	if time.Since(ch.lastFetchTime) < 5*time.Minute && ch.cachedGitHub != nil {
		cached := ch.cachedGitHub
		ch.mu.RUnlock()
		return cached
	}
	ch.mu.RUnlock()

	ch.mu.Lock()
	defer ch.mu.Unlock()

	if time.Since(ch.lastFetchTime) < 5*time.Minute && ch.cachedGitHub != nil {
		return ch.cachedGitHub
	}

	client := &http.Client{Timeout: 4 * time.Second}
	var gitHubReleases []ReleaseItem

	// 1. Fetch GitHub official releases if available
	req, err := http.NewRequest("GET", fmt.Sprintf("https://api.github.com/repos/%s/releases", ch.githubRepo), nil)
	if err == nil {
		req.Header.Set("User-Agent", "PteroNext-Panel-Changelog")
		req.Header.Set("Accept", "application/vnd.github.v3+json")
		if resp, err := client.Do(req); err == nil && resp.StatusCode == http.StatusOK {
			var ghRels []GitHubRelease
			if err := json.NewDecoder(resp.Body).Decode(&ghRels); err == nil {
				for _, r := range ghRels {
					tag := "STABLE"
					if r.Prerelease {
						tag = "BETA"
					}
					gitHubReleases = append(gitHubReleases, ReleaseItem{
						Version:       r.TagName,
						Date:          r.PublishedAt.Format("January 2006"),
						Title:         r.Name,
						TitleEN:       r.Name,
						Description:   r.Body,
						DescriptionEN: r.Body,
						Tag:           tag,
						TagEN:         tag,
						Highlights:    []string{fmt.Sprintf("Synchronisiert von GitHub Release: %s", r.TagName)},
						HighlightsEN:  []string{fmt.Sprintf("Synchronized from GitHub Release: %s", r.TagName)},
					})
				}
			}
			resp.Body.Close()
		}
	}

	// 2. Fetch GitHub tags
	tagReq, err := http.NewRequest("GET", fmt.Sprintf("https://api.github.com/repos/%s/tags", ch.githubRepo), nil)
	if err == nil {
		tagReq.Header.Set("User-Agent", "PteroNext-Panel-Changelog")
		tagReq.Header.Set("Accept", "application/vnd.github.v3+json")
		if resp, err := client.Do(tagReq); err == nil && resp.StatusCode == http.StatusOK {
			var ghTags []GitHubTag
			if err := json.NewDecoder(resp.Body).Decode(&ghTags); err == nil {
				for _, t := range ghTags {
					found := false
					for _, existing := range gitHubReleases {
						if existing.Version == t.Name {
							found = true
							break
						}
					}
					if !found {
						shortSHA := t.Commit.SHA
						if len(shortSHA) > 7 {
							shortSHA = shortSHA[:7]
						}
						gitHubReleases = append(gitHubReleases, ReleaseItem{
							Version:       t.Name,
							Date:          "GitHub Release",
							Title:         fmt.Sprintf("Release %s (GitHub)", t.Name),
							TitleEN:       fmt.Sprintf("Release %s (GitHub)", t.Name),
							Description:   fmt.Sprintf("Automatisch synchronisierter Release-Stand von GitHub Repository %s.", ch.githubRepo),
							DescriptionEN: fmt.Sprintf("Automatically synchronized release state from GitHub repository %s.", ch.githubRepo),
							Tag:           "STABLE",
							TagEN:         "STABLE",
							Highlights:    []string{fmt.Sprintf("GitHub Commit SHA: %s", shortSHA)},
							HighlightsEN:  []string{fmt.Sprintf("GitHub Commit SHA: %s", shortSHA)},
						})
					}
				}
			}
			resp.Body.Close()
		}
	}

	ch.cachedGitHub = gitHubReleases
	ch.lastFetchTime = time.Now()
	return ch.cachedGitHub
}

func (ch *ChangelogController) GetChangelog(c *gin.Context) {
	lang := strings.ToLower(c.DefaultQuery("lang", "de"))

	rawReleases := []ReleaseItem{
		{
			Version:       "v2.8.8",
			Date:          "October 2026",
			Title:         "Semgrep-Sicherheits-Hardening, DOMPurify XSS-Schutz, TLS 1.2+ & Dokumentation",
			TitleEN:       "Semgrep Security Hardening, DOMPurify Console XSS Hardening, TLS 1.2+ & Documentation",
			Description:   "Umfangreiches Sicherheits- und Stabilitäts-Release: Behebung aller von Semgrep identifizierten Sicherheitslücken, Härtung der Web-Konsole gegen XSS mittels DOMPurify, Erzwingung von modernem TLS 1.2+ für alle SSL-Endpunkte, systemweite Synchronisierung der Versionsanzeige auf v2.8.8 über alle Komponenten (Sidebar, Footer, Navbar, Dashboard & Changelog) sowie Hinzufügen einer 5.400+ Zeilen umfassenden Enterprise-Dokumentation (DOCUMENTATION.md).",
			DescriptionEN: "Comprehensive security and stability release: Remediation of all Semgrep-identified vulnerabilities, hardening the server web console against XSS via DOMPurify, enforcement of modern TLS 1.2+ across SSL endpoints, synchronized v2.8.8 version display across all components (Sidebar, Footer, Navbar, Dashboard & Changelog), and addition of a 5,400+ line enterprise architecture and deployment manual (DOCUMENTATION.md).",
			Tag:           "LATEST STABLE",
			TagEN:         "LATEST STABLE",
			IsLatest:      true,
			Highlights: []string{
				"Semgrep Security Hardening: Vollständige Bereinigung aller gemeldeten Schwachstellen in Controller- und Backend-Services",
				"DOMPurify XSS-Schutz: Web-Konsole filtert Terminal- und Log-Ausgaben gegen Cross-Site-Scripting ab",
				"Modern TLS 1.2+ Enforced: Veraltete SSL/TLS-Protokolle deaktiviert; ausschließlich sichere Cipher-Suites",
				"Globaler Versions-Sync v2.8.8: Einheitliche Versionsanzeige in Sidebar, Navbar, Footer, Dashboard und Changelog",
				"Umfassende Dokumentation: 5.400+ Zeilen Enterprise-Architektur-, Sicherheits- und Deployment-Dokumentation in DOCUMENTATION.md",
			},
			HighlightsEN: []string{
				"Semgrep Security Hardening: Complete remediation of all flagged security vulnerabilities across backend controllers and services",
				"DOMPurify Console XSS Hardening: Web console sanitizes terminal stream and log payloads against XSS attacks",
				"Modern TLS 1.2+ Enforced: Deprecated SSL/TLS protocols disabled with strict modern cipher suites",
				"Global Version Sync v2.8.8: Unified versioning across Sidebar, Navbar, Footer, Dashboard, and Changelog",
				"Comprehensive Documentation: 5,400+ line enterprise architecture, security, and deployment manual in DOCUMENTATION.md",
			},
			Features: []string{
				"DOMPurify HTML-Sanitizing im Minecraft- und Server-Konsolen-Stream",
				"Systemweite Versions-Synchronisation v2.8.8",
				"DOCUMENTATION.md mit vollständiger API-, Sicherheits- und Architektur-Referenz",
				"Dependabot-Integration zur automatischen Dependency-Überwachung",
			},
			FeaturesEN: []string{
				"DOMPurify HTML sanitization for server web console output stream",
				"System-wide v2.8.8 version synchronization",
				"DOCUMENTATION.md with comprehensive API, security, and architecture reference",
				"Dependabot configuration for automated dependency security monitoring",
			},
			Security: []string{
				"Semgrep Security Rules Auditing & Remediation",
				"DOMPurify XSS Filterung im Console-Stream",
				"TLS 1.2+ Mindeststandard in Nginx- und Daemon-Konfigurationen",
				"Bereinigte Fehler- und Exception-Rückgaben ohne Server-Interna",
			},
			SecurityEN: []string{
				"Semgrep security rules auditing and code remediation",
				"DOMPurify XSS filtering for console output stream",
				"TLS 1.2+ minimum protocol enforcement in SSL configurations",
				"Sanitized error and exception responses without leaking internal server paths",
			},
		},
		{
			Version:       "v2.8.7",
			Date:          "October 2026",
			Title:         "Live Player Position, Server-Löschung mit Passwort, SFTP-Fix & Sub-User-Verwaltung",
			TitleEN:       "Live Player Positions, Password-Protected Server Deletion, SFTP Fix & Sub-User Management",
			Description:   "Umfassendes Feature- und Stabilitätsrelease: Echte Echtzeit-Spielerpositionen (mit asynchronem Save-All-Flush), vollständige Entfernung der veralteten 2D-Weltkarte, obligatorische Passwortabfrage bei Serverlöschung, serverseitige AES-256-Verschlüsselung für gesicherte Backups, vollständige Sub-User-Bearbeitung, SFTP-Präfix- & Benutzerauthentifizierungs-Korrektur, nahtlose Login-Weiterleitung zum Dashboard sowie Live-Suche und Detailinspektion für Admin-Benutzer inklusive Sub-User-Status.",
			DescriptionEN: "Comprehensive feature and stability release: Real live player positions (via background save-all flush), complete removal of legacy 2D world map, mandatory account password verification upon server deletion, server-side AES-256 encryption on locked backups, full sub-user permission editing, SFTP prefix and username authentication fix, seamless login redirect to dashboard, and admin user search with sub-user badges and full details inspection modal.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Echtzeit-Spielerpositionen: In-Game-Koordinaten (X, Y, Z, Dimension, Health) aktualisieren sich live und synchronisieren sich ohne Join-Verzögerung",
				"2D World & Chunks Tab entfernt: Vollständig aus Navigation, Routing und Komponenten bereinigt",
				"Sicherheits-Serverlöschung: Erfordert zwingend die Eingabe und serverseitige Verifizierung des eigenen Account-Passworts",
				"Serverseitige Backup-Sperre & AES-256-Verschlüsselung: Beim Klick auf das Schloss wird das Backup serverseitig verschlüsselt und vor Löschung geschützt",
				"Sub-User Bearbeitung: Delegierte Berechtigungen, Rollenvorlagen und Regeln können jetzt direkt über das Interface aktualisiert werden",
				"SFTP-Verbindungsfix: Wings SFTP-Authentifizierung unterstützt jetzt Server-Präfixe, Volle UUIDs und flexible Benutzernamen",
				"Dashboard Login-Weiterleitung: Nach dem Login landet man immer direkt im Dashboard",
				"Admin Users Suche & Inspektion: Suchleiste nach Benutzernamen/E-Mail, Sub-User Kennzeichnung und Detail-Inspektions-Modal",
			},
			HighlightsEN: []string{
				"Realtime Player Tracking: In-game player coordinates update live with background save-all flushing without join delays",
				"2D World & Chunks Cleaned: Completely removed from navigation, views, and routes",
				"Password-Protected Server Deletion: Mandatory account password verification before permanent server container deletion",
				"Server-Side Backup Lock & AES-256 Encryption: Locking a snapshot encrypts archive on-disk and protects from deletion",
				"Sub-User Editing: Full capability to edit sub-user roles, permissions, and guardrails with instant synchronization",
				"Wings SFTP Connection Fix: Prefix matching and case-insensitive user lookup for reliable SFTP logins",
				"Dashboard Login Redirection: Authenticated logins consistently route directly to Dashboard",
				"Admin Users Search & Inspector: Search filter for users/emails, explicit Sub-User badge, and deep inspection modal",
			},
			Features: []string{
				"Server Deletion Account Password Prompt (Frontend Modal & Backend Verification)",
				"Server-Side Lock Encryption with AES-256-GCM for Backups",
				"Sub-User Editing Modal & PUT /api/servers/:uuid/subusers/:id Endpoint",
				"SFTP Node Prefix & Identifier Matching in Remote Controller",
				"Admin Users Search Filter & Inspection Modal with Sub-User Delegations",
				"Minecraft Realtime Player Coordinate Synchronization",
			},
			FeaturesEN: []string{
				"Server Deletion Account Password Prompt (Frontend Modal & Backend Verification)",
				"Server-Side Lock Encryption with AES-256-GCM for Backups",
				"Sub-User Editing Modal & PUT /api/servers/:uuid/subusers/:id Endpoint",
				"SFTP Node Prefix & Identifier Matching in Remote Controller",
				"Admin Users Search Filter & Inspection Modal with Sub-User Delegations",
				"Minecraft Realtime Player Coordinate Synchronization",
			},
			Security: []string{
				"Password Confirmation for Destructive Server Removal",
				"AES-256-GCM Backup Archive Protection & Deletion Guard",
				"Strict Subuser Permission Verification for SFTP Access",
			},
			SecurityEN: []string{
				"Password Confirmation for Destructive Server Removal",
				"AES-256-GCM Backup Archive Protection & Deletion Guard",
				"Strict Subuser Permission Verification for SFTP Access",
			},
		},
		{
			Version:       "v2.8.6",
			Date:          "October 2026",
			Title:         "Security-Hardening, RBAC-Isolierung, Live Chat Relay i18n & Player Realtime Sync",
			TitleEN:       "Security Hardening, RBAC Isolation, Live Chat Relay i18n & Player Realtime Sync",
			Description:   "Kritisches Sicherheits- und Stabilitätsrelease: Vollständige serverseitige Durchsetzung von RBAC (Default-Deny für Admin-Endpunkte und fremde Server-IDs), strikte Trennung von Benutzer- und Admin-Dashboards, Live Chat Relay mit voller Multi-Language-Unterstützung (i18n), flackerfreie Spielerliste mit <= 5s Positions-Sync, 3x3 Chunk-Vorladung auf der 2D-Weltkarte und Beseitigung der Scrollbar bei eingeklappter Sidebar.",
			DescriptionEN: "Critical security and stability release: Full server-side RBAC enforcement (default deny for admin endpoints and foreign servers), strict separation of tenant and admin dashboards, Live Chat Relay with full multi-language i18n support, flicker-free active players list with <= 5s position sync, 3x3 preloaded chunk caching on the 2D world map, and removal of collapsed sidebar scrollbars.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Strikte RBAC-Sicherheitsarchitektur: Vollständige serverseitige Autorisierung aller Endpunkte; normale Benutzer sehen ausschließlich autorisierte Server und keine Node-/Cluster-Interna",
				"Live Chat Relay Multi-Language: Vollständige bilinguale i18n-Anbindung für Benachrichtigungen, Badges, Chat-Aktionen und Rollen",
				"Flackerfreie Spielerüberwachung: Intelligenter Hintergrund-Sync ohne störenden Ladezustand und <= 5s Koordinaten-Updates",
				"2D World Map 3x3 Chunk-Vorladung: Diagonale und angrenzende Regionen werden nahtlos vorregistriert; Chunks werden ohne Null-Reset im Cache gehalten",
				"Clean Collapsed Sidebar UI: Keine horizontalen oder unteren Scrollbars mehr bei minimierter Navigation",
			},
			HighlightsEN: []string{
				"Strict RBAC Security Architecture: Complete server-side endpoint authorization; standard users only see authorized servers and zero node/cluster telemetry",
				"Live Chat Relay Multi-Language: Comprehensive bilingual i18n support across notifications, badges, chat actions, and staff identifiers",
				"Flicker-Free Player Monitoring: Intelligent background sync without visual reload flashes and <= 5s coordinate updates",
				"2D World Map 3x3 Chunk Preload: Diagonal and adjacent regions preloaded smoothly; chunks cached without null reset",
				"Clean Collapsed Sidebar UI: Elimination of all horizontal and bottom scrollbars when sidebar is collapsed",
			},
			Features: []string{
				"Live Chat Relay: t('chat_*') Integration mit dynamischer Spracherkennung",
				"Echtzeit Player-Positionierung: NBT-Pfadauflösung für Paper/Purpur (hyphenated & unhyphenated)",
				"Nahtlose Chunks: 3x3 Grid-Prefetching bei Bewegung auf der 2D-Weltkarte",
			},
			FeaturesEN: []string{
				"Live Chat Relay: Complete t('chat_*') integration with dynamic locale detection",
				"Realtime Player Tracking: Dual NBT path resolution for Paper/Purpur (hyphenated & unhyphenated)",
				"Seamless Chunks: 3x3 grid prefetching when panning on the 2D world map",
			},
			Security: []string{
				"Default-Deny für alle Admin-Routen und Server-Workloads",
				"Vollständiger Flush von Auth-Tokens, Query-Caches und Redirects bei Benutzerwechsel",
				"Echtzeit-Validierung von Sessions und Berechtigungen",
			},
			SecurityEN: []string{
				"Default-deny across all admin routes and server workloads",
				"Complete flush of auth tokens, query caches, and redirects on user change",
				"Realtime validation of sessions and permissions",
			},
			Improvements: []string{
				"Beseitigung von Scrollbars bei eingeklappter Navigationsleiste",
				"Verbesserte Latenz bei API-Abfragen durch asynchrones Caching",
			},
			ImprovementsEN: []string{
				"Removal of stray scrollbars on collapsed sidebar",
				"Improved API query latency via asynchronous caching",
			},
		},
		{
			Version:       "v2.8.5",
			Date:          "October 2026",
			Title:         "World Map Live-Tracking, Lag-Dump Auto-Trigger & Spieler-Inspektion",
			TitleEN:       "World Map Live Tracking, Lag Dump Auto Trigger & Player Inspection",
			Description:   "Umfassendes Performance- und Usability-Update: Bringt 3s Live-Spieler-Standortverfolgung und dynamisches Chunk-Nachladen auf der 2D-Weltkarte, automatisches Lag-Dump-Profiling ab TPS <= 18, vollständige Subuser-Persistenz, detaillierte Spieler-Inspektion in Liste und Chat sowie vollständige bilinguale i18n-Anbindung.",
			DescriptionEN: "Comprehensive performance and usability update: Features 3-second live player tracking and dynamic chunk loading on the 2D world map, automated lag dump profiling when TPS drops below 18, persistent subuser delegations, rich player inspection modal in player list and chat, and complete bilingual i18n coverage.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"World Map Live-Tracking: Spielerpositionen werden alle 3 Sekunden aktualisiert; Chunks laden beim Verschieben nahtlos nach",
				"Lag-Dump Auto-Trigger: Automatisierte Snapshot-Erstellung bei TPS <= 18.0 oder MSPT >= 45.0",
				"Spieler-Inspektionsmodal: Klick auf Spieler in Liste oder Chat zeigt IP, Welt, XYZ-Koordinaten mit 1-Klick /tp und Aktionen",
				"Subuser-Persistenz: Automatische Benutzer-Provisionierung und verlässliche Filterung in der Serverliste nach Logout",
				"Uptime-Präzision & Icon-Harmonisierung: Exakte Sekundenanzeige bei Serverstart und moderne Lucide-Icons statt Emojis",
			},
			HighlightsEN: []string{
				"World Map Live Tracking: Player positions update every 3 seconds; chunks load seamlessly when panning across region borders",
				"Lag Dump Auto Trigger: Automated diagnostic snapshot triggered when TPS <= 18.0 or MSPT >= 45.0",
				"Player Inspection Modal: Click on player in list or live chat to inspect IP, world, XYZ coordinates with 1-click /tp copy",
				"Subuser Persistence: Automatic account provisioning during invites and reliable delegation listing across logins",
				"Uptime Precision & Modern Icons: Exact second formatting on server boot and modern Lucide icons replacing emojis",
			},
		},
		{
			Version:       "v2.8.4",
			Date:          "October 2026",
			Title:         "Dynamisches Theme-Glow, Authentifizierungs-Härtung & System-Synchronisation",
			TitleEN:       "Dynamic Theme Glow, Authentication Hardening & System Synchronization",
			Description:   "Stabilitäts- und UI-Feinschliff-Update: Führt dynamische themenspezifische Akzente und Glow-Effekte für Server-Karten ein, bereinigt Authentifizierungs-Standardwerte für maximale Sicherheit und synchronisiert API-Versions-Endpunkte nahtlos.",
			DescriptionEN: "Stability and UI enhancement update: Introduces dynamic theme-aware accent and glow effects on server cards, cleans authentication defaults for maximum security, and synchronizes system API version endpoints seamlessly.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Dynamisches Theme-Glow: Reaktive Akzentlinien und Ambient-Glow auf Server-Karten angepasst an Panel-Themes",
				"Authentifizierungs-Härtung: Bereinigung von Mock-Benutzerwerten und strikte Session-Validierung",
				"Changelog- & Update-Sync: Nahtlose Bereitstellung der Systemversions-Informationen an Frontend-Komponenten",
				"Optimierte Build-Pipeline: Schnelle statische Verifikation und Single-Binary-Bereitstellung",
			},
			HighlightsEN: []string{
				"Dynamic Theme Glow: Reactive accent lines and ambient glow on server cards adhering to active panel theme",
				"Authentication Hardening: Sanitized mock user credentials and strict session validation",
				"Changelog & Update Sync: Seamless propagation of system version metadata to frontend components",
				"Optimized Build Pipeline: High-speed static verification and single-binary packaging",
			},
			Features: []string{
				"Dynamische Theme-Border und Accent-Farben auf Server-Karten",
				"Bereinigte AppContext-Initialisierung ohne statische Mock-Accounts",
			},
			FeaturesEN: []string{
				"Dynamic theme border and accent glow effects on server cards",
				"Sanitized AppContext initialization removing static mock accounts",
			},
		},
		{
			Version:       "v2.8.3",
			Date:          "October 2026",
			Title:         "Dauerhafte Datei-Löschung & Reseed-Schutz bei Seiten-Reload",
			TitleEN:       "Permanent File Deletion & Reload Persistence Safeguard",
			Description:   "Kritisches Stabilitäts-Update für das Dateisystem: Verhindert zuverlässig, dass gelöschte Dateien nach einem Seiten- oder Hard-Reload im Panel wieder auftauchen. Beinhaltet die Entfernung automatischer Reseed-Vorgänge im Backend via Initialisierungs-Marker, Bereinigung von Frontend-Mock-Fallbacks, asynchrone Lösch-Bestätigung und sofortige Verzeichnis-Aktualisierung.",
			DescriptionEN: "Critical filesystem stability update: permanently prevents deleted files or folders from reappearing after page or hard reloads. Introduces one-time setup initialization markers in the backend, eliminates legacy frontend mock file fallbacks, and guarantees synchronous node storage deletion with instant directory refreshing.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Dauerhaftes Löschen: Gelöschte Dateien und Ordner bleiben auch nach Reload und Hard Reload permanent gelöscht",
				"Backend Reseed-Schutz: Kein automatisches Neuerstellen von Standarddateien mehr dank .pteronext_initialized Marker",
				"Mock-Fallback Bereinigung: Leere Ordner und gelöschte Serververzeichnisse werden nicht mehr durch Mockdaten überschrieben",
				"Asynchrones Deletion-Handling: Warten auf Bestätigung des Node-Dateisystems und sofortige automatische Verzeichnis-Aktualisierung",
			},
			HighlightsEN: []string{
				"Permanent Deletion: Deleted files and folders remain permanently removed across page and hard reloads",
				"Backend Reseed Safeguard: Prevents unwanted re-creation of default files via .pteronext_initialized marker",
				"Mock Fallback Removal: Truly empty directories are preserved without fallback data injection",
				"Asynchronous Deletion Sync: Reliable node volume confirmation and instant directory refresh",
			},
			Features: []string{
				"Verbesserte Pfad-Bereinigung für Einzel- und Stapellöschungen im Dateimanager",
				"Direkte Synchronisation zwischen physischem Node-Storage, Backend-Service und Frontend-Cache",
			},
			FeaturesEN: []string{
				"Enhanced path normalization for single and batch file deletions in file manager",
				"Direct synchronization between physical node storage, backend daemon, and client cache",
			},
		},
		{
			Version:       "v2.8.2",
			Date:          "October 2026",
			Title:         "File-Time-Machine Snapshot-Fix & Automatische Revisionssicherung",
			TitleEN:       "File-Time-Machine Snapshot Fix & Automatic Revision Protection",
			Description:   "Wartungs- & Stabilitäts-Update für den Web-Code-Editor: Automatisches Erstellen von Datei-Snapshots bei jedem Speichervorgang in der Time-Machine, Behebung des URL-Query-Parameter Mismatches (?path= vs ?file=), Normalisierung von Dateipfaden mit führenden Slashes, dynamische Revision-Nummerierung und sichere 1-Klick-Wiederherstellung inklusive Pre-Restore Snapshot.",
			DescriptionEN: "Maintenance & stability update for the web code editor: automatic file snapshots on save in File-Time-Machine, fix query parameter mismatch (?path= vs ?file=), uniform path normalization, dynamic revision numbering and size display, and safe 1-click restore with pre-restore safety snapshot.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"File-Time-Machine Snapshots: Zuverlässiges Speichern jedes vorherigen Dateistands beim Klick auf 'Speichern' im Code-Editor",
				"Pfad-Normalisierung: Einheitliche Zuordnung von absoluten und relativen Dateipfaden (/server.properties vs. server.properties)",
				"API-Query Parameter Fix: Vollständige Unterstützung für '?path=' und '?file=' in allen Revisions-Endpunkten",
				"Revisions-Zähler & Dateigröße: Saubere Anzeige von Rev #N und formatierter Dateigröße im Time-Machine-Vergleich",
				"Pre-Restore Sicherung: Automatischer Sicherheits-Snapshot vor jeder Wiederherstellung, um keinen Zwischenstand zu verlieren",
			},
			HighlightsEN: []string{
				"File-Time-Machine Snapshots: Reliable micro-snapshot capture on every file save in the code editor",
				"Path Normalization: Uniform matching for absolute and relative paths (/server.properties vs. server.properties)",
				"API Query Param Compatibility: Full support for both '?path=' and '?file=' query parameters",
				"Revision Counter & Size: Accurate Rev #N numbering and formatted file size in the Time Machine diff view",
				"Pre-Restore Safeguard: Automatic snapshot before restoring any revision to prevent accidental data loss",
			},
			Features: []string{
				"Nahtlose Integration im Web-Code-Editor mit Live-Diff-Gegenüberstellung (Alt vs. Neu)",
				"Automatisches Nachladen der Revisionsliste direkt nach dem Speichern bei geöffneter Time-Machine",
			},
			FeaturesEN: []string{
				"Seamless integration in web code editor with side-by-side diff comparison (Old vs. New)",
				"Automatic background refresh of revision list right after saving while Time-Machine is open",
			},
			Improvements: []string{
				"Robuste Fallbacks für Revision-Nummern und Größen-Berechnung im UI",
			},
			ImprovementsEN: []string{
				"Robust fallbacks for revision number display and size calculation in frontend UI",
			},
		},
		{
			Version:       "v2.8.1",
			Date:          "October 2026",
			Title:         "Bugfixes, 2D Map Pan/Zoom, Disk Space Balancer & Multi-Language i18n",
			TitleEN:       "Bugfixes, 2D Map Pan/Zoom, Disk Space Balancer & Multi-Language i18n",
			Description:   "Wartungs- & Funktions-Update: Korrektur der Entwickler-Signatur Springi_SFM, interaktive Maus-Steuerung (Pan/Zoom/Chunk-Inspektion) im 2D Region-Viewer, Server-Löschung aus dem UI-State, Multi-Node Disk Space Balancer (>90% Warnung & 14-Tage Log-Auto-Clean), Container-Watchdog und lückenlose Mehrsprachigkeit (DE/EN) für Admin- und Spieler-Bereiche.",
			DescriptionEN: "Maintenance & feature update: corrected developer credit to Springi_SFM, interactive mouse pan/zoom/chunk inspector on 2D world map, fixed server deletion from client state, Multi-Node Disk Space Balancer (>90% alert & 14-day log auto-clean), container health watchdog, and comprehensive multi-language i18n.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Footer & Branding: Exakte Entwickler-Signatur 'Entwickelt von Springi_SFM'",
				"2D World & Chunks: Flüssiges Ziehen (Drag-to-Pan), Mausrad-Zoom und interaktiver Chunk-Datei-Inspektor",
				"Server-Löschung: Sofortiges Entfernen aus UI-State & Navigation nach physischem Hard-Delete",
				"Modularisierte Server-Settings: Saubere Sub-Sektionen (Allgemein, SFTP, Versionen, Startup, Auto-Scaler, Danger Zone)",
				"Disk Space Balancer & Watchdog: 90% Festplatten-Warnung, 14-Tage Log-Clean & Erkennung unresponsiver Container",
				"Vollständige i18n Lokalisierung: Lückenlose Übersetzungen für Admin-Benutzer, Ban-Listen und Spielerverwaltung",
			},
			HighlightsEN: []string{
				"Footer & Branding: Correct developer signature 'Developed by Springi_SFM'",
				"2D World & Chunks: Fluid drag-to-pan, scroll wheel zoom, and interactive chunk file inspector",
				"Server Deletion: Immediate UI-state cleanup and redirect after physical deletion",
				"Modular Server Settings: Clean sub-sections (General, SFTP, Versions, Startup, Auto-Scaler, Danger Zone)",
				"Disk Space Balancer & Watchdog: 90% storage warning, 14-day log auto-clean & unresponsive container watchdog",
				"Full Multi-Language Support: Comprehensive DE/EN localization across admin and player views",
			},
			Features: []string{
				"Drag-to-Pan & Scroll-Zoom auf Canvas-Karten",
				"Detaillierter Chunk-Inspektor mit Region-Dateipfad und Block-Koordinaten",
				"Smart Storage Alerts bei Host-Speicherauslastung über 90%",
				"Log-Rotation & 14-Tage Auto-Clean",
				"Container-Watchdog zur Erkennung hängender Ticks",
			},
			FeaturesEN: []string{
				"Drag-to-pan & scroll-to-zoom on canvas maps",
				"Detailed chunk inspector with region file path and block boundaries",
				"Smart storage alerts for host nodes exceeding 90% disk capacity",
				"Log rotation & 14-day auto-clean",
				"Container health watchdog for unresponsive processes",
			},
			Security: []string{
				"Entfernung statischer Mock-Bans für authentische Server-Sicherheit",
				"Sichere State-Bereinigung und Session-Isolation",
			},
			SecurityEN: []string{
				"Removed static mock bans for genuine operational security",
				"Safe state clearance and session isolation",
			},
			Improvements: []string{
				"Strukturierte Server-Settings mit modularen Tabs",
				"Behebung des schwarzen Hintergrund-Overlays beim Erstellen neuer Benutzer",
				"Konsistente Lokalisierung für Spieler-, Ban- und Admin-Verwaltung",
			},
			ImprovementsEN: []string{
				"Modular server settings with clean navigation pills",
				"Fixed background blackout when creating new users",
				"Consistent localization across player, ban, and admin views",
			},
		},
		{
			Version:       "v2.8.0",
			Date:          "October 2026",
			Title:         "Major Release: Physical Server Purge, 2D Anvil Region-Viewer, Auto-Updater & Smart SFTP-Keys",
			TitleEN:       "Major Release: Physical Server Purge, 2D Anvil Region-Viewer, Auto-Updater & Smart SFTP-Keys",
			Description:   "Großes Funktions-Update: Physische und kaskadierende Server-Löschung, 5-Stufen Setup-Wizard mit Lockfile, Canvas-basierter Minecraft Region-Viewer (.mca), Core Auto-Updater mit 60s Crash Auto-Revert und temporäre SFTP-Gast-Keys mit TTL & IP-Whitelisting.",
			DescriptionEN: "Major feature release: physical & cascading server purge, 5-step onboarding wizard with lockfile, canvas-based Minecraft anvil region viewer (.mca), core auto-updater with 60s crash auto-revert, and temporary SFTP guest keys with TTL & IP whitelisting.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Physische Server-Bereinigung: Synchrone Wings-Löschung & kaskadierender DB-Purge",
				"ModernNavbar: Live GitHub/Local Versionsabgleich & globales Theme im Admin-Dashboard",
				"First-Run Setup-Wizard: 5-Schritte Assistent (DB, Discord, Cloudflare, Root Admin Springi_SFM) & .setup_locked Lockfile",
				"Minecraft 2D Region-Viewer: Canvas-Top-Down-Karte für .mca Chunks, Biome, Höhen & Live-Marker",
				"Core Auto-Updater: Paper/Purpur/Velocity Streams mit 04:00 Uhr Nightly-Cron & 60s Crash Auto-Revert",
				"Smart SFTP-Keys: Gast-Keys mit TTL, IP-Whitelisting & 1-Klick FileZilla / WinSCP URI",
			},
			HighlightsEN: []string{
				"Physical Server Purge: Synchronous Wings deletion & cascading database purge",
				"ModernNavbar: Live GitHub/local version sync & global theme selector in admin dashboard",
				"First-Run Setup Wizard: 5-step onboarding (DB, Discord, Cloudflare, Root Admin Springi_SFM) & .setup_locked lockfile",
				"Minecraft 2D Region Viewer: Canvas top-down map for .mca chunks, biomes, elevations & live markers",
				"Core Auto-Updater: Paper/Purpur/Velocity streams with 04:00 AM nightly cron & 60s crash auto-revert",
				"Smart SFTP Keys: Temporary guest keys with TTL, IP whitelisting & 1-click FileZilla / WinSCP URIs",
			},
			Features: []string{
				"Automatischer Pre-Update Snapshot für Server-Cores",
				"Direkte Anvil .mca Header-Extraktion für 32x32 Chunks",
				"Sicherheits-Lockfile verhindert unautorisierten Re-Setup",
			},
			FeaturesEN: []string{
				"Automated pre-update snapshots for server core jars",
				"Direct anvil .mca header extraction for 32x32 chunks",
				"Security lockfile prevents unauthorized re-setup",
			},
			Security: []string{
				"IP-Whitelisting pro SFTP-Schlüssel verhindert unberechtigte Remote-Logins",
				"Automatische TTL-Ungültigkeit für Gast-Keys schützt Serverdaten",
			},
			SecurityEN: []string{
				"Per-key IP whitelisting prevents unauthorized remote logins",
				"Automated TTL expiration for guest keys protects server data",
			},
			Improvements: []string{
				"Restrukturiertes Server-Dashboard mit aufgeräumten Quick-Actions und Telemetrie",
			},
			ImprovementsEN: []string{
				"Restructured server dashboard with streamlined quick actions and telemetry",
			},
		},
		{
			Version:       "v2.7.4",
			Date:          "October 2026",
			Title:         "Neues Panel-Logo, Entfernung von Mock-Daten & Bereinigung von ANSI-Farbcodes",
			TitleEN:       "New Panel Logo, Removal of Mock Data & ANSI Color Code Cleanup",
			Description:   "Integriert das neue PteroNext-Logo, entfernt alle verbliebenen Mock-Daten im Diagnostik-Radar/Lag-Dump und bereinigt ANSI-Farbcode-Reste bei Spielernamen.",
			DescriptionEN: "Integrates the new PteroNext logo, removes all remaining mock data in Diagnostics Radar and Lag Dumps, and cleans ANSI color code artifacts from player names.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Neues modernes Origami-Logo im Header, Login-Screen und Favicon",
				"Bereinigung von ANSI-Farbcodes: Keine fehlerhaften Präfixe wie 93m mehr in Spielernamen",
				"Entfernung sämtlicher Mock-Daten im Radar- und Lag-Dump-System",
				"Saubere Empty-States für Welten- und Thread-Diagnostik",
			},
			HighlightsEN: []string{
				"New modern origami logo across header, login screen, and favicon",
				"ANSI escape code stripping: No corrupted prefixes like 93m in player usernames",
				"Removal of all mock radar hotspots and mock automated lag dumps",
				"Clean empty states for world entity radar and thread analysis",
			},
		},
		{
			Version:       "v2.7.3",
			Date:          "October 2026",
			Title:         "Live-Player Tracking Fix & Bereinigung des In-Game Chat Relays",
			TitleEN:       "Live Player Tracking Fix & In-Game Chat Relay Cleanup",
			Description:   "Behebt dauerhaft angezeigte Geister-Spieler (Ghost Players) durch direkte Live-Server-Abfrage und entfernt System-/Daemon-Ausgaben aus dem Spieler-Chat.",
			DescriptionEN: "Fixes ghost players remaining indefinitely in active players list via live server query, and removes system/daemon logs from the in-game player chat relay.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Präzises Live-Player Tracking: Abfrage des tatsächlichen Serverzustands via TCP Server List Ping und Join/Leave-Log-Auswertung statt statischem usercache.json",
				"Keine Geisterspieler mehr: Ausgeloggte oder getrennte Spieler verschwinden sofort aus der Liste der aktiven Spieler",
				"Bereinigter Spieler-Chat: Vollständige Entfernung von System-Gateways, Node-Statusmeldungen und Daemon-Logs aus dem In-Game-Chat",
				"Automatisches Leeren der aktiven Spieler bei gestopptem oder suspendiertem Server",
			},
			HighlightsEN: []string{
				"Accurate live player tracking: Queries actual server state via TCP Server List Ping and real join/leave logs instead of static usercache.json",
				"No more ghost players: Disconnected or offline players are immediately removed from active players",
				"Cleaned player chat relay: Complete removal of system gateway ads, node status reports, and daemon console logs from player chat",
				"Automatic player list reset when server is offline or suspended",
			},
			Features: []string{
				"Direkte Echtzeit-Synchronisation der aktiven Spieler über WebSocket und Server-Ping",
				"Strikter Filter für In-Game-Chat-Relay verhindert jegliches Einfließen von Konsole-Bannern",
			},
			FeaturesEN: []string{
				"Direct real-time active player synchronization via WebSocket and server ping",
				"Strict filter for in-game chat relay preventing console banners and node statuses from leaking",
			},
			Security: []string{
				"Entfernung aller statischen Mock-Daten und Platzhalter-Benutzer",
			},
			SecurityEN: []string{
				"Elimination of all static mock data and placeholder users",
			},
		},
		{
			Version:       "v2.7.2",
			Date:          "October 2026",
			Title:         "Crash-Analyzer, File-Time-Machine, Cloudflare DNS, Server-Staging & Suspension Enforcement",
			TitleEN:       "Crash Analyzer, File Time-Machine, Cloudflare DNS, Server Staging & Suspension Enforcement",
			Description:   "5 mächtige Enterprise-Erweiterungen: Intelligenter 1-Klick Crash-Analyzer, Mikro-Snapshots mit Diff-View im Dateimanager, Zero-Config Cloudflare DNS & SRV Automation, 1-Klick Instant Server-Staging sowie administrative Sperre suspendierter Server.",
			DescriptionEN: "5 major enterprise features: Intelligent 1-click Crash Analyzer, File Time-Machine micro-snapshots with diff-view, Zero-Config Cloudflare DNS & SRV automation, 1-click Instant Server Staging, and strict administrative suspension enforcement.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Intelligenter Crash-Analyzer: Erkennt Java-Mismatch, Portkonflikte, OOM und YAML-Syntax mit 1-Klick-Lösung",
				"File-Time-Machine: Automatische Revisionshistorie bei jedem Speichern mit Split-View-Diff (Rot/Grün) und 1-Klick-Zurücksetzen",
				"Zero-Config Cloudflare DNS: Automatische Erstellung von A- & SRV-Records für nahtloses Verbinden ohne manuelle Portangabe",
				"Instant Server-Klon / 1-Klick-Staging: Dupliziert Server-Dateien und Ports in Sekundenschnelle für risikofreie Testumgebungen",
				"Strikte Suspension-Sperre: Suspendierte Server werden sofort gestoppt, Dateimanager und Power-Aktionen gesperrt",
				"Automatischer GitHub-Changelog Feed & Zero-Data-Loss 1-Klick-Updater mit automatischem Datenbank-Backup",
			},
			HighlightsEN: []string{
				"Intelligent Crash Analyzer: Detects Java mismatch, port collisions, OOM, and YAML indentation with 1-click automated fix",
				"File Time-Machine: Micro-snapshots on every save with red/green split diff view and 1-click revision restore",
				"Zero-Config Cloudflare DNS: Automated A and SRV DNS records for direct player connections without cumbersome ports",
				"Instant Server Clone / 1-Click Staging: Effortlessly duplicates server directories and ports for isolated sandbox testing",
				"Strict Suspension Lock: Suspended servers immediately terminate, file editing, uploads, and power actions locked down",
				"Automated GitHub Changelog feed & zero-data-loss 1-click updater with automated SQLite database snapshots",
			},
			Features: []string{
				"Interaktiver Crash-Banner in Konsole und Server-Header mit automatischer Erkennung und Reparatur-Aktion",
				"Dateimanager Revisions-Drawer: Vergleiche Vorher/Nachher im farbcodierten Unified-Diff und stelle alte Stände wieder her",
				"Cloudflare DNS Manager im Netzwerk-Tab und Admin-Integrations-Panel mit Token-Validierung",
				"Staging-Aktionsbutton im Server-Kontextmenü für sofortiges Duplizieren",
			},
			FeaturesEN: []string{
				"Interactive Crash banner in console and server header with pattern diagnostics and automated fix button",
				"File Manager revision drawer: Inspect side-by-side diffs and restore previous file versions in one click",
				"Cloudflare DNS manager in Network tab and Admin integrations view with token validation",
				"Staging action in server actions dropdown for instant duplicate provisioning",
			},
			Security: []string{
				"Administrative Suspendierung blockiert nun konsequent Schreibzugriffe, Uploads, Löschungen und Konsolenbefehle",
				"Automatisches SQLite-Sicherheits-Backup vor jedem System-Update zur Vermeidung jeglichen Datenverlusts",
			},
			SecurityEN: []string{
				"Server suspension strictly locks out file modifications, uploads, deletions, and power execution",
				"Automated SQLite safety backups before system upgrades ensuring zero data loss",
			},
			Improvements: []string{
				"Live GitHub Changelog-Erkennung: Neue Commits und Releases werden automatisch abgefragt und dargestellt",
				"Prüfen-Button liefert sofortiges visuelles Toast-Feedback mit den neuesten Repository-Metadaten",
			},
			ImprovementsEN: []string{
				"Live GitHub Changelog Recognition: Queries and presents new commits and releases on the fly",
				"Check button delivers immediate toast feedback detailing latest repository metadata",
			},
		},
		{
			Version:       "v2.7.1",
			Date:          "October 2026",
			Title:         "Discord Bot DM-Code-Verifikation, Server-Mitgliedschaftsprüfung & Globale Profilbilder",
			TitleEN:       "Discord Bot DM Code Verification, Server Membership Check & Global Avatars",
			Description:   "Zweistufige Discord-Verifikation mit Bot-DM-Sicherheitscode, Prüfung auf Discord-Server-Mitgliedschaft und globale Einbindung von Benutzer-Profilbildern in Navigation und Co-Pilot.",
			DescriptionEN: "Two-step Discord verification with automated Bot DM security codes, guild membership verification, and global user avatar rendering across sidebar, header, and Co-Pilot.",
			Tag:           "STABLE",
			TagEN:         "STABLE",
			IsLatest:      false,
			Highlights: []string{
				"Discord Bot DM-Verifikation: Automatischer 6-stelliger Sicherheitscode direkt per privater Nachricht vom Bot",
				"Server-Mitgliedschaftsprüfung: Nutzer müssen Mitglied des Discord-Servers sein, sonst weist der Bot die Anfrage ab",
				"Globale Profilbilder: Eigene hochgeladene Avatare werden nun durchgängig in Sidebar, Header und Co-Pilot-Admin-Präsenz angezeigt",
				"Sicherer Ablauf mit 10-Minuten-Code-Ablaufdatum und automatischer DM-Erfolgsbestätigung",
				"Footer-Versionsbadge und GitHub-Updater synchronisiert auf v2.7.1",
			},
			HighlightsEN: []string{
				"Discord Bot DM Verification: Automated 6-digit security code delivered directly via private bot message",
				"Guild Membership Check: Enforces that users must belong to the Discord server before receiving a DM",
				"Global Profile Avatars: Custom uploaded avatars render consistently across navigation, header, and Co-Pilot",
				"Secure lifecycle with 10-minute expiration window and automated Discord success confirmation message",
				"Footer version badge and GitHub updater synchronized to v2.7.1",
			},
			Features: []string{
				"Zweistufiger Discord-Linking-Dialog in den Kontoeinstellungen mit interaktivem Code-Eingabefeld",
				"Fehlerbehandlung für geschlossene DMs mit klaren Handlungsanweisungen für Benutzer",
				"Sofortige Avatar-Vorschau und reibungslose Persistenz in der Datenbank",
			},
			FeaturesEN: []string{
				"Interactive two-step Discord linking modal with dedicated verification code input",
				"Error detection for closed DMs providing clear guidance to enable server direct messages",
				"Instant avatar preview and seamless database persistence",
			},
			Security: []string{
				"Kryptografisch zufällige 6-stellige Einmalcodes mit Verfallszeit",
				"Ratenbegrenzung und serverseitige Validierung der Discord-User-ID",
			},
			SecurityEN: []string{
				"Cryptographically secure 6-digit one-time verification tokens with expiry",
				"Rate limiting and server-side Discord snowflake validation",
			},
			Improvements: []string{
				"Sidebar-Profilschaltfläche zeigt nun echte Benutzer-Avatare statt nur Initialen",
				"Co-Pilot Online-Admins zeigen individuelle Profilbilder der Moderatoren",
			},
			ImprovementsEN: []string{
				"Sidebar user profile trigger now displays custom user avatars instead of initials",
				"Co-Pilot active administrators render individualized moderator avatars",
			},
		},
		{
			Version:       "v2.7.0",
			Date:          "October 2026",
			Title:         "Discord Bot & OAuth2, Auto-Sleep Modus, Command History & 1-Klick GitHub Updater",
			TitleEN:        "Discord Bot & OAuth2, Auto-Sleep Mode, Command History & 1-Click GitHub Updater",
			Description:   "Umfangreiches Update mit Discord-Authentifizierung, Discord-Bot-Konfiguration, automatischem Server Sleep-Modus bei Inaktivität, Terminal Pfeiltasten-Historie mit Autovervollständigung, Profilbild-Upload und echter URL-Navigation.",
			DescriptionEN: "Comprehensive upgrade introducing Discord OAuth2 & Bot Integration, Container Auto-Sleep Mode during inactivity, Terminal Command History with arrow keys and autocomplete, custom Avatar uploads, and deep-linked URLs.",
			Tag:           "FEATURE RELEASE",
			TagEN:         "FEATURE RELEASE",
			IsLatest:      false,
			Highlights: []string{
				"Discord-Bot & OAuth2-Authentifizierung im Admin-Bereich mit Bot-Token-Verwaltung und 1-Klick Discord-Login",
				"Server Resource Auto-Scaler / Sleep-Modus: Automatische Container-Pause bei 0 Spielern mit Sofort-Aufweckung",
				"RCON & Terminal Befehls-Historie mit Pfeiltasten Hoch/Runter sowie Autovervollständigung für Standardbefehle",
				"Direkter Profilbild-Upload in den Benutzereinstellungen (PNG, JPG, WebP) mit Live-Vorschau",
				"Echte Browser-URLs (Deep Linking) für alle Ansichten (/changelog, /admin/*, /servers/*, /settings)",
				"Automatischer GitHub-Update-Checker und 1-Klick-Installation direkt über das Repository",
				"Vollständig automatische Übersetzung aller Changelogs zwischen Deutsch und Englisch",
			},
			HighlightsEN: []string{
				"Discord Bot & OAuth2 Authentication in Admin area with bot token management and 1-click Discord login",
				"Server Resource Auto-Scaler / Sleep Mode: Automatic container suspension when 0 players are active",
				"RCON & Terminal Command History with Up/Down arrow navigation and smart autocomplete for server commands",
				"Direct Profile Picture / Avatar upload in User Settings (PNG, JPG, WebP) with instant live preview",
				"Real Browser URLs & Deep Linking for every view (/changelog, /admin/*, /servers/*, /settings)",
				"Automatic GitHub update check & 1-click installation directly from the GitHub repository",
				"100% full automatic translation of all changelog entries between German and English",
			},
			Features: []string{
				"Discord-Bot Integration: Client ID, Secret, Bot-Token (mit Ein-/Ausblenden) und Discord-Account-Verknüpfung",
				"Auto-Sleep Mode: Wählbare Inaktivitäts-Zeit (10, 15, 30 Min.) und optischer Standby-Status",
				"Terminal Command Buffer: Durchsuche vorherige Befehle mit Pfeil-Hoch und Pfeil-Runter",
				"Befehls-Autovervollständigung für 'stop', 'restart', 'whitelist', 'op', 'reload', 'save-all', 'say', etc.",
				"Avatar-Uploader mit Drag & Drop und Client-Side-Optimierung",
				"Saubere URL-Routen mit Browser-History-Support (Vor/Zurück ohne Seitenverlust)",
			},
			FeaturesEN: []string{
				"Discord Bot Integration: Client ID, Secret, Bot Token (with show/hide toggle) and user Discord account linking",
				"Auto-Sleep Mode: Configurable inactivity threshold (10, 15, 30 min) and intuitive standby state",
				"Terminal Command Buffer: Cycle through previously executed commands with Up and Down arrow keys",
				"Command autocomplete suggestion popup for 'stop', 'restart', 'whitelist', 'op', 'reload', 'save-all', 'say', etc.",
				"Custom Avatar Uploader with Drag & Drop and client-side image optimization",
				"Clean URL routes with full browser history support (Back/Forward buttons and bookmarks)",
			},
			Security: []string{
				"Sichere Token-Speicherung für Discord-Bot-Tokens mit Maskierung in API-Antworten",
				"Fokus-Border-Bereinigung in der Befehlspalette (CMD+K) ohne unschöne Browser-Ringe",
				"Exakte Cluster- und Host-Arbeitsspeicherberechnung ohne Fehlanzeigen",
			},
			SecurityEN: []string{
				"Secure token storage for Discord Bot tokens with sensitive value masking in API responses",
				"Focus border sanitization in Command Palette (CMD+K) removing intrusive browser rings",
				"Accurate host and cluster memory metrics reporting real server allocations",
			},
			Improvements: []string{
				"Cluster Nodes Matrix zeigt nun die exakte Anzahl realer Server anstelle von Port-Allokationen",
				"Speicher-Metriken synchronisieren nun Host-RAM und Node-Kapazitäten zuverlässig",
			},
			ImprovementsEN: []string{
				"Cluster Nodes Matrix now displays exact unique server instances instead of total port allocations",
				"Memory telemetry metrics accurately synchronize host RAM and node allocations",
			},
		},
		{
			Version:       "v2.6.0",
			Date:          "October 2026",
			Title:         "Enterprise Themes, Custom CSS Studio, Smooth Accordions & 2FA Recovery",
			TitleEN:        "Enterprise Themes, Custom CSS Studio, Smooth Accordions & 2FA Recovery",
			Description:   "Umfangreiches Plattform-Upgrade mit 11 visuellen Themes, 4 animierten Hintergründen, Custom CSS Live-Editor, gehärtetem 2FA-Login, Notfall-Wiederherstellung, Co-Pilot Admin-Präsenz und flüssigen Accordions.",
			DescriptionEN: "Platform upgrade featuring 11 visual themes, 4 animated canvas backgrounds, Custom CSS Live Editor, hardened 2FA login, emergency CLI recovery, Co-Pilot Admin presence, and smooth accordions.",
			Tag:           "STABLE RELEASE",
			TagEN:         "STABLE RELEASE",
			IsLatest:      false,
			Highlights: []string{
				"11 Handgefertigte Themes mit vollständiger Farbharmonie (Cyberpunk, Midnight, Sakura, Aurora, Matrix)",
				"4 Dynamische Hintergrund-Leinwände: Ambient Dynamic Glow, Cyber Mesh Grid, Pure OLED Black & Classic Dark",
				"Custom CSS Live Studio in den Benutzereinstellungen mit sofortiger Vorschau ohne Reload",
				"Zwei-Faktor-Authentifizierung (2FA) Härtung: Case-insensitives Login & serverseitiger Notfall-Reset-CLI-Befehl (-reset-2fa)",
				"Multi-User Co-Pilot Admin-Präsenz mit interaktiver Liste aller aktiven Admins und deren Aktivitäten",
				"Sanfte Accordion-Transitions (CSS Grid Animations) im Server-Dashboard und in der Plattform-Navigation",
			},
			HighlightsEN: []string{
				"11 Handcrafted themes with full color harmony (Cyberpunk, Midnight, Sakura, Aurora, Matrix)",
				"4 Dynamic background canvases: Ambient Dynamic Glow, Cyber Mesh Grid, Pure OLED Black & Classic Dark",
				"Custom CSS Live Studio in user account settings with instant preview without page reloads",
				"Two-Factor Authentication (2FA) hardening: Case-insensitive login & emergency server CLI reset (-reset-2fa)",
				"Multi-User Co-Pilot Admin presence with interactive list of active administrators and their activities",
				"Smooth accordion transitions (CSS Grid animations) in server dashboard and platform navigation",
			},
			Features: []string{
				"11 Handgefertigte Themes mit vollständiger Farbharmonie",
				"4 Dynamische Hintergrund-Leinwände",
				"Custom CSS Live Studio in den Benutzereinstellungen",
				"Zwei-Faktor-Authentifizierung (2FA) Härtung",
			},
			FeaturesEN: []string{
				"11 Handcrafted themes with complete color harmony",
				"4 Dynamic animated background canvases",
				"Custom CSS Live Studio in user preferences",
				"Two-Factor Authentication (2FA) hardening",
			},
			Security: []string{
				"2FA-Aussperrschutz mit automatischem Fallback und Notfall-Reset via CLI",
				"Robuste Session-Verifikation mit Argon2id & JWT-Tokens",
			},
			SecurityEN: []string{
				"2FA lockout prevention with automatic fallback and emergency CLI reset",
				"Robust session verification using Argon2id and JWT tokens",
			},
			Improvements: []string{
				"Vollständige deutsche und englische Sprachunterstützung (i18n)",
				"Fehlerbehebung für Suchleiste und konsistente Ausrichtung",
			},
			ImprovementsEN: []string{
				"Comprehensive German and English localization (i18n)",
				"Bug fixes for search bar alignment and layout padding",
			},
		},
		{
			Version:       "v2.4.0",
			Date:          "October 2026",
			Title:         "Enterprise Security, Sidecars & Co-Pilot",
			TitleEN:        "Enterprise Security, Sidecars & Co-Pilot",
			Description:   "Major platform update introducing Player Dashboard, Container Sidecars (Redis/Postgres), Malicious Bytecode Scanner, Incident Freeze Mode, and Granular RBAC Path-Rules.",
			DescriptionEN: "Major platform update introducing Player Dashboard, Container Sidecars (Redis/Postgres), Malicious Bytecode Scanner, Incident Freeze Mode, and Granular RBAC Path-Rules.",
			Tag:           "MAJOR RELEASE",
			TagEN:         "MAJOR RELEASE",
			IsLatest:      false,
			Highlights: []string{
				"Player- & Community-Dashboard mit Live-Spielerliste, Web-Chat-Relay und Ban-/Mute-Tabelle",
				"Port- & Netzwerk-Manager mit Multi-Port Allocation Pool und 1-Click Primary Switch",
				"Integrierte Container-Sidecars (Redis, PostgreSQL, SQLite) mit Auto-Credential-Injection",
				"Integrierter Web-DB-Viewer (Table Browser & Safe Query Explorer)",
			},
			HighlightsEN: []string{
				"Player & Community Dashboard with live player roster, web chat relay, and ban/mute controls",
				"Port & Network Manager with multi-port allocation pool and 1-click primary switch",
				"Integrated Container Sidecars (Redis, PostgreSQL, SQLite) with auto-credential injection",
				"Built-in Web Database Viewer (Table Browser & Safe Query Explorer)",
			},
			Features: []string{
				"Player- & Community-Dashboard mit Live-Spielerliste, Web-Chat-Relay und Ban-/Mute-Tabelle",
				"Port- & Netzwerk-Manager mit Multi-Port Allocation Pool und 1-Click Primary Switch",
			},
			FeaturesEN: []string{
				"Player & Community Dashboard with live player roster, web chat relay, and ban/mute controls",
				"Port & Network Manager with multi-port allocation pool and 1-click primary switch",
			},
			Security: []string{
				"Automatische Zensur (Masking) sensibler Tokens, Passwörter und API-Keys in Konsolen-Logs",
			},
			SecurityEN: []string{
				"Automatic redaction and masking of sensitive credentials in console logs",
			},
			Improvements: []string{
				"Multi-Node Load Balancing (automatische Zuweisung nach tatsächlicher RAM/CPU-Auslastung)",
			},
			ImprovementsEN: []string{
				"Multi-Node Load Balancing based on live RAM/CPU telemetry",
			},
		},
	}

	// Merge GitHub releases/tags that are newer than top version (exclude legacy v1.x upstream tags)
	ghReleases := ch.fetchGitHubSync()
	curatedMap := make(map[string]bool)
	for _, r := range rawReleases {
		curatedMap[r.Version] = true
	}
	topVersion := "v2.8.8"
	if len(rawReleases) > 0 {
		topVersion = rawReleases[0].Version
	}

	var newerGitHubReleases []ReleaseItem
	var olderGitHubReleases []ReleaseItem
	for _, g := range ghReleases {
		if curatedMap[g.Version] {
			continue
		}
		// Ignore legacy v1.x upstream tags from older Pterodactyl base
		if !strings.HasPrefix(g.Version, "v2.") && !strings.HasPrefix(g.Version, "v3.") {
			continue
		}
		if isVersionGreater(g.Version, topVersion) {
			newerGitHubReleases = append(newerGitHubReleases, g)
		} else {
			olderGitHubReleases = append(olderGitHubReleases, g)
		}
	}
	if len(newerGitHubReleases) > 0 {
		rawReleases = append(newerGitHubReleases, rawReleases...)
	}
	if len(olderGitHubReleases) > 0 {
		rawReleases = append(rawReleases, olderGitHubReleases...)
	}

	// Localize if requested
	releases := make([]ReleaseItem, len(rawReleases))
	for i, r := range rawReleases {
		item := r
		if i == 0 {
			item.IsLatest = true
		} else {
			item.IsLatest = false
		}
		if lang == "en" {
			if item.TitleEN != "" {
				item.Title = item.TitleEN
			}
			if item.DescriptionEN != "" {
				item.Description = item.DescriptionEN
			}
			if item.TagEN != "" {
				item.Tag = item.TagEN
			}
			if len(item.HighlightsEN) > 0 {
				item.Highlights = item.HighlightsEN
			}
			if len(item.FeaturesEN) > 0 {
				item.Features = item.FeaturesEN
			}
			if len(item.SecurityEN) > 0 {
				item.Security = item.SecurityEN
			}
			if len(item.ImprovementsEN) > 0 {
				item.Improvements = item.ImprovementsEN
			}
		}
		releases[i] = item
	}

	currentVer := "v2.8.8"
	if len(releases) > 0 && releases[0].Version != "" {
		currentVer = releases[0].Version
	}

	c.JSON(http.StatusOK, gin.H{
		"current_version": currentVer,
		"releases":        releases,
	})
}
