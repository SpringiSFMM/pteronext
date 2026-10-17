import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Shield,
  Zap,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  ArrowUpRight,
  Download,
  AlertCircle,
  ExternalLink,
  Rocket,
} from 'lucide-react';

interface Release {
  version: string;
  title: string;
  title_en?: string;
  date: string;
  tag?: string;
  tag_en?: string;
  highlights?: string[];
  highlights_en?: string[];
  features?: string[];
  features_en?: string[];
  security?: string[];
  security_en?: string[];
  improvements?: string[];
  improvements_en?: string[];
}

interface UpdateStatus {
  update_available: boolean;
  current_version: string;
  latest_version: string;
  commit_sha?: string;
  commit_message?: string;
  commit_date?: string;
  commit_author?: string;
  repo_url?: string;
  checked_at?: string;
}

export const ChangelogView: React.FC = () => {
  const { language } = useTranslation();
  const { addToast } = useApp();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReleases, setExpandedReleases] = useState<Record<string, boolean>>({
    'v2.9.2': true,
    'v2.9.1': false,
    'v2.9.0': false,
    'v2.8.8': false,
    'v2.8.7': false,
    'v2.8.6': false,
    'v2.8.5': false,
  });

  // Multi-Page Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4;

  // GitHub Update State
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);

  const toggleRelease = (version: string) => {
    setExpandedReleases((prev) => ({
      ...prev,
      [version]: prev[version] === undefined ? false : !prev[version],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    displayReleases.forEach((r) => {
      all[r.version] = true;
    });
    setExpandedReleases(all);
  };

  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    displayReleases.forEach((r) => {
      all[r.version] = false;
    });
    setExpandedReleases(all);
  };

  const fetchChangelog = async () => {
    try {
      setLoading(true);
      const res = await api.changelog.get(language);
      if (res?.releases) {
        setReleases(res.releases);
      }
    } catch (err) {
      console.error('Failed to load changelog:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkForUpdates = async (isManual = false) => {
    try {
      setCheckingUpdate(true);
      const res = await api.updates.check();
      setUpdateStatus(res);
      if (isManual) {
        if (res?.update_available) {
          addToast({
            title: language === 'de' ? `Update verfügbar (${res.latest_version})` : `Update Available (${res.latest_version})`,
            description: res.commit_message
              ? `${res.commit_message} (${res.commit_sha?.slice(0, 7) || 'HEAD'})`
              : (language === 'de' ? 'Ein neuer Versionsstand ist auf GitHub verfügbar.' : 'A new version is available on GitHub.'),
            type: 'info',
          });
        } else {
          addToast({
            title: language === 'de' ? `System ist aktuell (${res.current_version})` : `System is up to date (${res.current_version})`,
            description: res.commit_message
              ? `${language === 'de' ? 'Neuester Commit' : 'Latest commit'}: "${res.commit_message}" (${res.commit_sha?.slice(0, 7) || 'HEAD'})`
              : (language === 'de' ? 'Alle Komponenten entsprechen dem neuesten GitHub-Stand.' : 'All components match the latest GitHub version.'),
            type: 'success',
          });
        }
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
      if (isManual) {
        addToast({
          title: language === 'de' ? 'Prüfung fehlgeschlagen' : 'Update Check Failed',
          description: err.message || (language === 'de' ? 'Verbindung zu GitHub konnte nicht hergestellt werden.' : 'Could not connect to GitHub.'),
          type: 'error',
        });
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handle1ClickInstall = async () => {
    try {
      setInstallingUpdate(true);
      addToast({
        title: language === 'de' ? 'Sicherheits-Backup & Update' : 'Safety Backup & Update',
        description: language === 'de'
          ? 'Automatisches SQLite-Backup wird erstellt & PteroNext aktualisiert...'
          : 'Creating automated SQLite backup & updating PteroNext...',
        type: 'info',
      });
      const res = await api.updates.install();
      addToast({
        title: language === 'de' ? 'Update erfolgreich initialisiert' : 'Update Successfully Initialized',
        description: res.message || (language === 'de' ? 'PteroNext startet im Hintergrund sicher neu...' : 'PteroNext restarting safely in background...'),
        type: 'success',
      });
      setTimeout(() => {
        window.location.reload();
      }, 3500);
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Update fehlgeschlagen' : 'Update Failed',
        description: err.message || 'Error executing update',
        type: 'error',
      });
      setInstallingUpdate(false);
    }
  };

  useEffect(() => {
    fetchChangelog();
    checkForUpdates(false);
  }, [language]);

  const defaultReleases: Release[] = [
    {
      version: 'v2.9.2',
      title: language === 'de'
        ? 'Minecraft World Manager, Uptime Status Portal, React Portal Modals & Discord Bot Telemetrie'
        : 'Minecraft World Manager, Uptime Status Portal, React Portal Modals & Discord Bot Telemetry',
      date: 'October 2026',
      tag: 'LATEST STABLE',
      features: language === 'de'
        ? [
            'Minecraft World Manager: Multi-World Übersicht, 1-Klick Dimension Resets (Nether/End) & Gamerule-Steuerung',
            'Gehostete Uptime- & Statusseiten unter pteronext.com/status/{project} mit 1-Seiten-Quota',
            'Dynamisches Discord Status-Board (#📊・status) mit Homepage-Echtzeit-Synchronisation & @Downtime Alert Ping',
            'React Portal Modal-Architektur: Kein Viewport-Abschneiden mehr durch Portierung in document.body',
            'Discord Bot Updates Ping: Automatisches Pingen von @Updates Ping bei neuen Releases & Commits',
            'Community Egg Marketplace: 1-Klick-Import geprüfter Eggs direkt in Panel-Nests',
            'Resend E-Mail-Verifikation & sicherer Passwort-Reset',
            'Aufgeräumte Admin-Sidebar ohne Pfad-URLs',
          ]
        : [
            'Minecraft World Manager: Multi-world overview, 1-click dimension resets (Nether/End) & gamerule controls',
            'Hosted Uptime & Status Pages system at pteronext.com/status/{project} with 1-page quota limit',
            'Dynamic Discord Status Board (#📊・status) with homepage realtime sync & @Downtime Alert Ping',
            'React Portal Modal Architecture: Zero viewport clipping via document.body portals',
            'Discord Bot Updates Ping: Automated @Updates Ping role mentions on new releases & commits',
            'Community Egg Marketplace: 1-click import of verified eggs directly into panel nests',
            'Resend email verification & secure password reset flow',
            'Decluttered admin sidebar stripped of path URLs',
          ],
    },
    {
      version: 'v2.9.1',
      title: language === 'de'
        ? 'Discord Bot Operations Suite, FileManager Kontextmenüs & Kill-Priorität'
        : 'Discord Bot Operations Suite, FileManager Context Menus & Power Priority',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'PteroNext Discord Bot Integration (Discord.js v14 & Components V2) mit 15 Slash-Commands und Echtzeit-Status-Sync',
            'FileManager UX-Update: Getrennte Icons für Editor (Cyan) & Rename (Bernstein) plus natives Rechtsklick-Kontextmenü',
            'Behebung des Re-Render- und Endlos-Reloads im .env & Secrets Tab',
            'Power Action Kill-Priorität: Sofortiges SIGKILL ohne Verzögerung und Abbruch anhängiger Neustarts',
            'Dynamische Git-Deployment-Historie ohne Dummy-Einträge bei neuen Servern',
            'Workload-basiertes Dateiseeding ohne Minecraft-Dateileichen bei Bots',
          ]
        : [
            'PteroNext Discord Bot integration (Discord.js v14 & Components V2) with 15 slash commands and live status sync',
            'FileManager UX overhaul: Dedicated icons for Editor (Cyan) & Rename (Amber) plus full native right-click context menu',
            'Resolved infinite reload / freeze loop in .env & Secrets tab',
            'Power action Kill priority: Immediate SIGKILL cancellation of pending restart sequences',
            'Dynamic Git deployment history eliminating dummy mock items on new servers',
            'Workload-aware server file seeding without Minecraft config residue on bots',
          ],
      security: language === 'de'
        ? [
            'Priorisierte Kill-Abschaltung unterbindet unkontrollierte Neustart-Schleifen',
            'Robuste 502/503 Fehlerabschirmung im Discord-Bot-Statusmonitor mit Backoff & Cache-Fallback',
          ]
        : [
            'Prioritized Kill execution terminates processes immediately, preventing restart loops',
            'Robust 502/503 error shielding in Discord bot status polling with backoff and cache fallback',
          ],
      improvements: language === 'de'
        ? [
            'In-Memory Caching für Dokumentations- und Status-APIs (Latenz von 4s auf <15ms reduziert)',
            'Erhöhte UX-Klarheit durch getrennte Editor- und Umbenennen-Buttons',
          ]
        : [
            'In-memory caching for Documentation and Status APIs (latency reduced from 4s to <15ms)',
            'Enhanced UI clarity with separated editor and rename buttons',
          ],
    },
    {
      version: 'v2.9.0',
      title: language === 'de'
        ? '1-Click Server-Importer, Egg Drag&Drop, CLI Updater & Cloudflare DNS'
        : '1-Click Server Importer, Egg Drag&Drop, CLI Updater & Cloudflare DNS',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'Systemweite Versions-Synchronisation auf v2.9.0 mit dynamischer Erkennung aus VERSION / Environment',
            'PteroNext Safe CLI Updater (pteronext update) mit automatischem SQLite-Backup ohne Datenverlust',
            '1-Click Importer für herkömmliche Panels zur nahtlosen Migration aller Server und Quotas',
            'Offline Drag&Drop Import für Egg-Templates und Manifeste',
            'Automatisierte Cloudflare DNS E-Mail-Routing & MX/SPF/DMARC Konfiguration',
          ]
        : [
            'System-wide version synchronization to v2.9.0 with dynamic detection from VERSION / environment',
            'PteroNext safe CLI updater (pteronext update) with automated SQLite backup without data loss',
            '1-Click importer for legacy panels for seamless migration of servers and quotas',
            'Offline drag-and-drop import for egg templates and manifests',
            'Automated Cloudflare DNS email routing & MX/SPF/DMARC configuration',
          ],
      security: language === 'de'
        ? [
            'Automatische Zensur (Masking) sensibler Tokens, Passwörter und API-Keys in Konsolen-Logs',
            'Datenbank-Snapshot vor jedem Update zur Vermeidung jeglicher Datenverluste',
          ]
        : [
            'Automatic redaction and masking of sensitive credentials in console logs',
            'Pre-update automated database snapshots guaranteeing zero data loss',
          ],
      improvements: language === 'de'
        ? [
            'Verbesserte Update-Prüfung: Korrekte Statusanzeige wenn installierte Version >= GitHub-Stand ist',
            'Robuste Versionsvergleichslogik über alle Systemmodule',
          ]
        : [
            'Improved update checker: Correct status reporting when installed version is >= GitHub tag',
            'Robust semver comparison logic across all system components',
          ],
    },
    {
      version: 'v2.8.8',
      title: language === 'de'
        ? 'Semgrep-Sicherheits-Hardening, DOMPurify XSS-Schutz, TLS 1.2+ & Dokumentation'
        : 'Semgrep Security Hardening, DOMPurify Console XSS Hardening, TLS 1.2+ & Documentation',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'Systemweite Versions-Synchronisation auf v2.8.8 in Navbar, Sidebar, Footer, Dashboard und Changelog mit automatischem GitHub-Abgleich',
            'DOMPurify Web-Konsolen-Härtung: Bereinigt Live-Terminal- und Log-Ausgaben gegen XSS-Injektionen',
            'Modernes TLS 1.2+ als Mindeststandard in SSL- und Reverse-Proxy-Konfigurationen erzwungen',
            '5.400+ Zeilen Enterprise System- & Sicherheitsdokumentation (DOCUMENTATION.md) hinzugefügt',
            'Dependabot Dependency Monitoring zur proaktiven Überwachung aller npm- und Go-Pakete',
          ]
        : [
            'System-wide version synchronization to v2.8.8 across navbar, sidebar, footer, dashboard and changelog with automated GitHub sync',
            'DOMPurify web console hardening: Sanitizes terminal and log output stream against XSS injections',
            'Modern TLS 1.2+ minimum protocol enforced across SSL and reverse proxy configurations',
            '5,400+ line enterprise system & security manual (DOCUMENTATION.md) added',
            'Dependabot dependency monitoring for proactive npm and Go dependency updates',
          ],
      security: language === 'de'
        ? [
            'Behebung sämtlicher von Semgrep markierter Sicherheitslücken in Controllern und Services',
            'DOMPurify XSS-Filterung im Server-Konsolen-Stream',
            'Veraltete TLS-Protokolle (TLS 1.0/1.1) vollständig deaktiviert',
          ]
        : [
            'Remediation of all Semgrep-flagged security vulnerabilities in backend controllers and services',
            'DOMPurify XSS sanitization for server console stream',
            'Deprecated TLS protocols (TLS 1.0/1.1) completely disabled',
          ],
      improvements: language === 'de'
        ? [
            'Automatischer Abgleich der Changelog-Releases und Tags direkt mit GitHub',
            'Einheitliche dynamische Versionsanzeige über alle Komponenten ohne manuelle Sync-Notwendigkeit',
          ]
        : [
            'Automatic synchronization of changelog releases and tags directly with GitHub',
            'Unified dynamic version display across all components without manual sync overhead',
          ],
    },
    {
      version: 'v2.8.7',
      title: language === 'de'
        ? 'Live Player Position, Server-Löschung mit Passwort, SFTP-Fix & Sub-User-Verwaltung'
        : 'Live Player Positions, Password-Protected Server Deletion, SFTP Fix & Sub-User Management',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'Echtzeit-Spielerpositionen: In-Game-Koordinaten aktualisieren sich live und synchronisieren sich ohne Join-Verzögerung',
            'Legacy 2D World & Chunks Tab vollständig entfernt',
            'Sicherheits-Serverlöschung: Erfordert zwingend Eingabe und Verifizierung des Account-Passworts',
            'Serverseitige Backup-Sperre mit AES-256-Verschlüsselung',
            'Sub-User Berechtigungs- und Rollenbearbeitung über PUT /api/servers/:uuid/subusers/:id',
            'Wings SFTP Prefix- und Username-Fix für zuverlässige SFTP-Verbindungen',
          ]
        : [
            'Realtime player tracking: In-game player coordinates update live without join delays',
            'Legacy 2D World & Chunks tab completely cleaned and removed',
            'Password-protected server deletion requiring account password verification',
            'Server-side backup locking with AES-256 encryption',
            'Sub-user permission editing via PUT /api/servers/:uuid/subusers/:id',
            'Wings SFTP prefix and username auth fix for reliable SFTP logins',
          ],
      security: language === 'de'
        ? [
            'Passwort-Bestätigung bei destruktiver Server-Entfernung',
            'AES-256-GCM Backup-Archiv-Schutz und Löschblockade',
          ]
        : [
            'Password confirmation for destructive server removal',
            'AES-256-GCM backup archive protection and deletion guard',
          ],
    },
    {
      version: 'v2.8.6',
      title: language === 'de'
        ? 'Security-Hardening, RBAC-Isolierung, Live Chat Relay i18n & Player Realtime Sync'
        : 'Security Hardening, RBAC Isolation, Live Chat Relay i18n & Player Realtime Sync',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'Strikte RBAC-Sicherheitsarchitektur mit Default-Deny für Admin-Endpunkte',
            'Live Chat Relay mit voller Multi-Language (i18n) Anbindung',
            'Flackerfreie Spielerüberwachung ohne UI-Reload',
            'Clean Collapsed Sidebar UI ohne störende Scrollbars',
          ]
        : [
            'Strict RBAC security architecture with default-deny on admin endpoints',
            'Live Chat Relay with comprehensive bilingual i18n support',
            'Flicker-free player monitoring without visual reload flashes',
            'Clean collapsed sidebar UI without scrollbars',
          ],
    },
    {
      version: 'v2.7.3',
      title: language === 'de'
        ? 'Live-Player Tracking Fix & Bereinigung des In-Game Chat Relays'
        : 'Live Player Tracking Fix & In-Game Chat Relay Cleanup',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'Präzises Live-Player Tracking: Abfrage des tatsächlichen Serverzustands via TCP Server List Ping und Join/Leave-Log-Auswertung statt statischem usercache.json',
            'Keine Geisterspieler mehr: Ausgeloggte oder getrennte Spieler verschwinden sofort aus der Liste der aktiven Spieler',
            'Bereinigter Spieler-Chat: Vollständige Entfernung von System-Gateways, Node-Statusmeldungen und Daemon-Logs aus dem In-Game-Chat',
            'Automatisches Leeren der aktiven Spieler bei gestopptem oder suspendiertem Server',
          ]
        : [
            'Accurate live player tracking: Queries actual server state via TCP Server List Ping and real join/leave logs instead of static usercache.json',
            'No more ghost players: Disconnected or offline players are immediately removed from active players',
            'Cleaned player chat relay: Complete removal of system gateway ads, node status reports, and daemon console logs from player chat',
            'Automatic player list reset when server is offline or suspended',
          ],
      security: language === 'de'
        ? [
            'Entfernung aller statischen Mock-Daten und Platzhalter-Benutzer aus der API',
          ]
        : [
            'Elimination of all static mock data and placeholder demo users from the API',
          ],
      improvements: language === 'de'
        ? [
            'Direkte Echtzeit-Synchronisation der aktiven Spieler über WebSocket und Server-Ping',
            'Strikter Filter für In-Game-Chat-Relay verhindert jegliches Einfließen von Konsole-Bannern',
          ]
        : [
            'Direct real-time active player synchronization via WebSocket and server ping',
            'Strict filter for in-game chat relay preventing console banners and node statuses from leaking',
          ],
    },
    {
      version: 'v2.7.2',
      title: language === 'de'
        ? 'Crash-Analyzer, File-Time-Machine, Cloudflare DNS, Server-Staging & Suspension Enforcement'
        : 'Crash Analyzer, File Time-Machine, Cloudflare DNS, Server Staging & Suspension Enforcement',
      date: 'October 2026',
      tag: 'STABLE',
      features: language === 'de'
        ? [
            'Intelligenter Crash-Analyzer: Erkennt Java-Mismatch, Portkonflikte, OOM und YAML-Syntax mit 1-Klick-Lösung',
            'File-Time-Machine: Automatische Revisionshistorie bei jedem Speichern mit Split-View-Diff (Rot/Grün) und 1-Klick-Zurücksetzen',
            'Zero-Config Cloudflare DNS: Automatische Erstellung von A- & SRV-Records für nahtloses Verbinden ohne manuelle Portangabe',
            'Instant Server-Klon / 1-Klick-Staging: Dupliziert Server-Dateien und Ports in Sekundenschnelle für risikofreie Testumgebungen',
            'Strikte Suspension-Sperre: Suspendierte Server werden sofort gestoppt, Dateimanager und Power-Aktionen gesperrt',
            'Automatischer GitHub-Changelog Feed & Zero-Data-Loss 1-Klick-Updater mit automatischem Datenbank-Backup',
          ]
        : [
            'Intelligent Crash Analyzer: Detects Java mismatch, port collisions, OOM, and YAML indentation with 1-click automated fix',
            'File Time-Machine: Micro-snapshots on every save with red/green split diff view and 1-click revision restore',
            'Zero-Config Cloudflare DNS: Automated A and SRV DNS records for direct player connections without cumbersome ports',
            'Instant Server Clone / 1-Click Staging: Effortlessly duplicates server directories and ports for isolated sandbox testing',
            'Strict Suspension Lock: Suspended servers immediately terminate, file editing, uploads, and power actions locked down',
            'Automated GitHub Changelog feed & zero-data-loss 1-click updater with automated SQLite database snapshots',
          ],
      security: language === 'de'
        ? [
            'Administrative Suspendierung blockiert nun konsequent Schreibzugriffe, Uploads, Löschungen und Konsolenbefehle',
            'Automatisches SQLite-Sicherheits-Backup vor jedem System-Update zur Vermeidung jeglichen Datenverlusts',
          ]
        : [
            'Server suspension strictly locks out file modifications, uploads, deletions, and power execution',
            'Automated SQLite safety backups before system upgrades ensuring zero data loss',
          ],
      improvements: language === 'de'
        ? [
            'Live GitHub Changelog-Erkennung: Neue Commits und Releases werden automatisch abgefragt und dargestellt',
            'Prüfen-Button liefert sofortiges visuelles Toast-Feedback mit den neuesten Repository-Metadaten',
          ]
        : [
            'Live GitHub Changelog Recognition: Queries and presents new commits and releases on the fly',
            'Check button delivers immediate toast feedback detailing latest repository metadata',
          ],
    },
    {
      version: 'v2.7.1',
      title: language === 'de'
        ? 'Discord Bot DM-Code-Verifikation, Server-Mitgliedschaftsprüfung & Globale Profilbilder'
        : 'Discord Bot DM Code Verification, Server Membership Check & Global Avatars',
      date: 'October 2026',
      tag: 'LATEST STABLE',
      features: language === 'de'
        ? [
            'Discord Bot DM-Verifikation: Automatischer 6-stelliger Sicherheitscode direkt per privater Nachricht vom Bot',
            'Server-Mitgliedschaftsprüfung: Nutzer müssen Mitglied des Discord-Servers sein, sonst weist der Bot die Anfrage ab',
            'Globale Profilbilder: Eigene hochgeladene Avatare werden nun durchgängig in Sidebar, Header und Co-Pilot-Admin-Präsenz angezeigt',
            'Sicherer Ablauf mit 10-Minuten-Code-Ablaufdatum und automatischer DM-Erfolgsbestätigung',
            'Footer-Versionsbadge und GitHub-Updater synchronisiert auf v2.7.1',
          ]
        : [
            'Discord Bot DM Verification: Automated 6-digit security code delivered directly via private bot message',
            'Guild Membership Check: Enforces that users must belong to the Discord server before receiving a DM',
            'Global Profile Avatars: Custom uploaded avatars render consistently across navigation, header, and Co-Pilot',
            'Secure lifecycle with 10-minute expiration window and automated Discord success confirmation message',
            'Footer version badge and GitHub updater synchronized to v2.7.1',
          ],
      security: language === 'de'
        ? [
            'Kryptografisch zufällige 6-stellige Einmalcodes mit Verfallszeit',
            'Ratenbegrenzung und serverseitige Validierung der Discord-User-ID',
          ]
        : [
            'Cryptographically secure 6-digit one-time verification tokens with expiry',
            'Rate limiting and server-side Discord snowflake validation',
          ],
      improvements: language === 'de'
        ? [
            'Sidebar-Profilschaltfläche zeigt nun echte Benutzer-Avatare statt nur Initialen',
            'Co-Pilot Online-Admins zeigen individuelle Profilbilder der Moderatoren',
          ]
        : [
            'Sidebar user profile trigger now displays custom user avatars instead of initials',
            'Co-Pilot active administrators render individualized moderator avatars',
          ],
    },
    {
      version: 'v2.7.0',
      title: language === 'de'
        ? 'Discord Bot & OAuth2, Auto-Sleep Modus, Command History & 1-Klick GitHub Updater'
        : 'Discord Bot & OAuth2, Auto-Sleep Mode, Command History & 1-Click GitHub Updater',
      date: 'October 2026',
      tag: 'LATEST RELEASE',
      features: language === 'de'
        ? [
            'Discord-Bot & OAuth2-Authentifizierung im Admin-Bereich mit Bot-Token-Verwaltung und 1-Klick Discord-Login',
            'Server Resource Auto-Scaler / Sleep-Modus: Automatische Container-Pause bei 0 Spielern mit Sofort-Aufweckung',
            'RCON & Terminal Befehls-Historie mit Pfeiltasten Hoch/Runter sowie Autovervollständigung für Standardbefehle',
            'Direkter Profilbild-Upload in den Benutzereinstellungen (PNG, JPG, WebP) mit Live-Vorschau',
            'Echte Browser-URLs (Deep Linking) für alle Ansichten (/changelog, /admin/*, /servers/*, /settings)',
            'Automatischer GitHub-Update-Checker und 1-Klick-Installation direkt über das Repository',
            'Vollständig automatische Übersetzung aller Changelogs zwischen Deutsch und Englisch',
          ]
        : [
            'Discord Bot & OAuth2 Authentication in Admin area with bot token management and 1-click Discord login',
            'Server Resource Auto-Scaler / Sleep Mode: Automatic container suspension when 0 players are active',
            'RCON & Terminal Command History with Up/Down arrow navigation and smart autocomplete for server commands',
            'Direct Profile Picture / Avatar upload in User Settings (PNG, JPG, WebP) with instant live preview',
            'Real Browser URLs & Deep Linking for every view (/changelog, /admin/*, /servers/*, /settings)',
            'Automatic GitHub update check & 1-click installation directly from the GitHub repository',
            '100% full automatic translation of all changelog entries between German and English',
          ],
      security: language === 'de'
        ? [
            'Sichere Token-Speicherung für Discord-Bot-Tokens mit Maskierung in API-Antworten',
            'Fokus-Border-Bereinigung in der Befehlspalette (CMD+K) ohne unschöne Browser-Ringe',
            'Exakte Cluster- und Host-Arbeitsspeicherberechnung ohne Fehlanzeigen',
          ]
        : [
            'Secure token storage for Discord Bot tokens with sensitive value masking in API responses',
            'Focus border sanitization in Command Palette (CMD+K) removing intrusive browser rings',
            'Accurate host and cluster memory metrics reporting real server allocations',
          ],
      improvements: language === 'de'
        ? [
            'Cluster Nodes Matrix zeigt nun die exakte Anzahl realer Server anstelle von Port-Allokationen',
            'Speicher-Metriken synchronisieren nun Host-RAM und Node-Kapazitäten zuverlässig',
          ]
        : [
            'Cluster Nodes Matrix now displays exact unique server instances instead of total port allocations',
            'Memory telemetry metrics accurately synchronize host RAM and node allocations',
          ],
    },
    {
      version: 'v2.6.0',
      title: language === 'de'
        ? 'Enterprise Themes, Custom CSS Studio, Smooth Accordions & 2FA Recovery'
        : 'Enterprise Themes, Custom CSS Studio, Smooth Accordions & 2FA Recovery',
      date: 'October 2026',
      tag: 'STABLE RELEASE',
      features: language === 'de'
        ? [
            '11 Handgefertigte Themes mit vollständiger Farbharmonie (Cyberpunk, Midnight, Sakura, Aurora, Matrix)',
            '4 Dynamische Hintergrund-Leinwände: Ambient Dynamic Glow, Cyber Mesh Grid, Pure OLED Black & Classic Dark',
            'Custom CSS Live Studio in den Benutzereinstellungen mit sofortiger Vorschau ohne Reload',
            'Zwei-Faktor-Authentifizierung (2FA) Härtung: Case-insensitives Login & serverseitiger Notfall-Reset-CLI-Befehl (-reset-2fa)',
            'Multi-User Co-Pilot Admin-Präsenz mit interaktiver Liste aller aktiven Admins und deren Aktivitäten',
            'Sanfte Accordion-Transitions (CSS Grid Animations) im Server-Dashboard und in der Plattform-Navigation',
          ]
        : [
            '11 Handcrafted themes with full color harmony (Cyberpunk, Midnight, Sakura, Aurora, Matrix)',
            '4 Dynamic background canvases: Ambient Dynamic Glow, Cyber Mesh Grid, Pure OLED Black & Classic Dark',
            'Custom CSS Live Studio in user account settings with instant preview without page reloads',
            'Two-Factor Authentication (2FA) hardening: Case-insensitive login & emergency CLI reset (-reset-2fa)',
            'Multi-User Co-Pilot Admin presence with interactive list of active administrators and their activities',
            'Smooth accordion transitions (CSS Grid animations) in server dashboard and platform navigation',
          ],
      security: language === 'de'
        ? [
            '2FA-Aussperrschutz mit automatischem Fallback und Notfall-Reset via CLI (/opt/pteronext/pteronext -reset-2fa)',
            'Robuste Session-Verifikation mit Argon2id & JWT-Tokens',
          ]
        : [
            '2FA lockout prevention with automatic fallback and emergency CLI reset',
            'Robust session verification using Argon2id and JWT tokens',
          ],
      improvements: language === 'de'
        ? [
            'Fehlerbehebung und zentrierte Ausrichtung für Suchleiste im Workload-Dashboard',
            'Co-Pilot Admin-Präsenz mit interaktiver Liste, Avatar-Indikatoren und Letztgesehen-Telemetrie',
          ]
        : [
            'Bug fix and centered alignment for search bar in workload dashboard',
            'Co-Pilot Admin presence with interactive roster, avatars, and last-seen telemetry',
          ],
    },
    {
      version: 'v2.4.0',
      title: 'Enterprise Security, Sidecars & Co-Pilot',
      date: 'October 2026',
      tag: 'MAJOR RELEASE',
      features: language === 'de'
        ? [
            'Player- & Community-Dashboard mit Live-Spielerliste, Web-Chat-Relay und Ban-/Mute-Tabelle',
            'Port- & Netzwerk-Manager mit Multi-Port Allocation Pool und 1-Click Primary Switch',
            'Integrierte Container-Sidecars (Redis, PostgreSQL, SQLite) mit Auto-Credential-Injection',
            'Integrierter Web-DB-Viewer (Table Browser & Safe Query Explorer)',
          ]
        : [
            'Player & Community Dashboard with live player roster, web chat relay, and ban/mute controls',
            'Port & Network Manager with multi-port allocation pool and 1-click primary switch',
            'Integrated Container Sidecars (Redis, PostgreSQL, SQLite) with auto-credential injection',
            'Built-in Web Database Viewer (Table Browser & Safe Query Explorer)',
          ],
      security: language === 'de'
        ? [
            'Automatische Zensur sensibler Tokens, Passwörter und API-Keys in Konsolen-Logs',
          ]
        : [
            'Automatic redaction and masking of sensitive credentials in console logs',
          ],
      improvements: language === 'de'
        ? [
            'Multi-Node Load Balancing (automatische Zuweisung nach tatsächlicher RAM/CPU-Auslastung)',
          ]
        : [
            'Multi-Node Load Balancing based on live RAM/CPU telemetry',
          ],
    },
  ];

  const displayReleases = releases.length > 0 ? releases : defaultReleases;

  const filteredReleases = displayReleases.filter((release) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const titleMatch = release.title.toLowerCase().includes(q);
    const versionMatch = release.version.toLowerCase().includes(q);
    const featuresMatch = (release.features || release.highlights || []).some((f) =>
      f.toLowerCase().includes(q)
    );
    const securityMatch = (release.security || []).some((s) => s.toLowerCase().includes(q));
    const improvementMatch = (release.improvements || []).some((i) => i.toLowerCase().includes(q));
    return titleMatch || versionMatch || featuresMatch || securityMatch || improvementMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReleases.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedReleases = filteredReleases.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="cyber-glass rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-wide font-sans">
              {language === 'de' ? 'System-Changelog & Release Notes' : 'System Changelog & Release Notes'}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {language === 'de'
              ? 'Übersicht aller Plattform-Updates, Sicherheitserweiterungen, neuer Sidecar-Module und Leistungsoptimierungen für PteroNext.'
              : 'Overview of platform updates, security hardenings, sidecar modules, and performance optimizations for PteroNext.'}
          </p>
        </div>

        <button
          onClick={fetchChangelog}
          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors self-start md:self-auto"
          title={language === 'de' ? 'Aktualisieren' : 'Refresh'}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* GitHub Auto-Update & 1-Click Install Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-indigo-950/40 border border-indigo-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">
                PteroNext GitHub Feed
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  updateStatus?.update_available
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {updateStatus?.latest_version || updateStatus?.current_version || 'v2.9.0'}{' '}
                {updateStatus?.update_available
                  ? language === 'de'
                    ? 'UPDATE VERFÜGBAR'
                    : 'UPDATE AVAILABLE'
                  : 'LATEST'}
              </span>
              <a
                href="https://github.com/SpringiSFMM/pteronext"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono transition-colors"
              >
                <span>SpringiSFMM/pteronext</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {updateStatus?.commit_message
                ? `${language === 'de' ? 'Letzter Commit:' : 'Latest commit:'} "${updateStatus.commit_message}" (${updateStatus.commit_sha || 'f3e29f6'})`
                : language === 'de'
                ? 'Automatische Synchronisation mit dem GitHub-Repository aktiv.'
                : 'Automatic synchronization with GitHub repository active.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => checkForUpdates(true)}
            disabled={checkingUpdate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-slate-700 hover:border-slate-500 text-xs font-mono text-slate-200 hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{language === 'de' ? 'Auf Updates prüfen' : 'Check for Updates'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Accordion Controls */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={
              language === 'de'
                ? 'Suche in Update-Notizen, Features oder Sicherheits-Fixes...'
                : 'Search release notes, features, or security fixes...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 border-none outline-none ring-0 focus:outline-none focus:ring-0 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
          <button
            onClick={expandAll}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono transition-colors"
          >
            {language === 'de' ? 'Alle ausklappen' : 'Expand All'}
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono transition-colors"
          >
            {language === 'de' ? 'Alle einklappen' : 'Collapse All'}
          </button>
        </div>
      </div>

      {/* Release Timeline (Collapsible Accordions with Connected Timeline) */}
      <div className="relative pl-6 sm:pl-10 space-y-4">
        {/* Continuous Connected Vertical Timeline Line */}
        <div
          className="absolute left-2.5 sm:left-4 top-4 bottom-8 w-0.5 bg-gradient-to-b from-indigo-500 via-cyan-500/60 to-emerald-500/20 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.35)]"
          aria-hidden="true"
        />

        {paginatedReleases.map((release, index) => {
          const isLatest = index === 0 && validCurrentPage === 1;
          const isExpanded = expandedReleases[release.version] ?? (release.version === (displayReleases[0]?.version || 'v2.9.0'));
          const featureItems =
            release.features && release.features.length > 0
              ? release.features
              : release.highlights && release.highlights.length > 0
              ? release.highlights
              : [];

          const securityItems = release.security || [];
          const improvementItems = release.improvements || [];
          const totalCount = featureItems.length + securityItems.length + improvementItems.length;

          return (
            <div
              key={release.version}
              className="relative cyber-glass rounded-2xl border border-slate-800 hover:border-slate-700/80 transition-all shadow-lg"
            >
              {/* Milestone Icon Node on Connected Timeline */}
              <div className="absolute -left-[30px] sm:-left-[38px] top-6 flex items-center justify-center z-10">
                {/* Pulse ring for latest version */}
                {isLatest && (
                  <span className="absolute -inset-1 rounded-xl bg-indigo-500/35 animate-ping opacity-75 pointer-events-none" />
                )}
                <div
                  className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
                    isLatest
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-300 shadow-emerald-500/30 ring-2 ring-emerald-500/40'
                      : release.version.startsWith('v2.9')
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-300 shadow-emerald-500/30'
                      : release.version === 'v2.8.8'
                      ? 'bg-indigo-950/95 border-indigo-400 text-indigo-300 shadow-indigo-500/30'
                      : release.version === 'v2.8.7'
                      ? 'bg-cyan-950/95 border-cyan-400 text-cyan-300 shadow-cyan-500/30'
                      : 'bg-[#161b22] border-slate-700 text-indigo-400 shadow-slate-900/40'
                  }`}
                >
                  {release.version.startsWith('v2.9') ? (
                    <Rocket className="w-3.5 h-3.5" />
                  ) : release.version === 'v2.8.8' ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : release.version === 'v2.8.7' ? (
                    <Zap className="w-3.5 h-3.5" />
                  ) : (
                    <GitBranch className="w-3.5 h-3.5" />
                  )}

                  {/* Pulse Dot indicator on latest version */}
                  {isLatest && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#161b22] animate-pulse" />
                  )}
                </div>

                {/* Horizontal connector stem */}
                <div className="hidden sm:block absolute left-full top-1/2 -translate-y-1/2 w-2 h-0.5 bg-indigo-500/40" />
              </div>

              {/* Clickable Header Button */}
              <button
                onClick={() => toggleRelease(release.version)}
                className="w-full p-5 sm:p-6 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors select-none group rounded-2xl"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`text-sm font-mono font-bold px-3 py-1 rounded-xl transition-colors ${
                      release.version === (displayReleases[0]?.version || 'v2.9.0')
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : release.version === 'v2.8.8'
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        : release.version === 'v2.8.7'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : release.version === 'v2.8.6'
                        ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                        : release.version === 'v2.7.3'
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {release.version}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors font-sans truncate">
                      {release.title}
                    </h2>
                    {!isExpanded && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {totalCount} {language === 'de' ? 'Änderungen enthalten • Klicken zum Ausklappen' : 'changes included • Click to expand'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d1117] border border-slate-700/80 text-xs text-slate-300 font-mono shadow-sm">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{release.date}</span>
                  </div>
                  {release.tag && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        release.version === (displayReleases[0]?.version || 'v2.9.0')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : release.version === 'v2.8.8'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : release.version === 'v2.8.7'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : release.tag.includes('MAJOR')
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {release.tag}
                    </span>
                  )}
                  <div className="p-1 rounded-lg bg-slate-800/80 group-hover:bg-slate-700 text-slate-400 group-hover:text-white transition-colors">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="px-5 pb-6 sm:px-6 space-y-5 border-t border-slate-800/80 pt-5 view-enter">
                  {/* Highlights / Features */}
                  {featureItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>{language === 'de' ? 'HIGHLIGHTS & NEUE FEATURES' : 'HIGHLIGHTS & NEW FEATURES'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {featureItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5"
                          >
                            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-slate-200 leading-relaxed font-sans">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Security Guardrails */}
                  {securityItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>{language === 'de' ? 'SICHERHEIT & SCHUTZ' : 'SECURITY & GUARDRAILS'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {securityItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-2.5"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-emerald-200/90 leading-relaxed font-sans">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improvements & Fixes */}
                  {improvementItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>{language === 'de' ? 'VERBESSERUNGEN & FIXES' : 'PERFORMANCE & IMPROVEMENTS'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {improvementItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-start gap-2.5"
                          >
                            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span className="text-xs text-amber-200/90 leading-relaxed font-sans">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Multi-Page Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[#11141a] border border-[#30363d] shadow-lg">
          <div className="text-xs font-mono text-slate-400">
            {language === 'de'
              ? `Zeige Seite ${validCurrentPage} von ${totalPages} (${filteredReleases.length} Versionen gesamt)`
              : `Showing page ${validCurrentPage} of ${totalPages} (${filteredReleases.length} releases total)`}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage <= 1}
              className="p-2 rounded-xl bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Vorherige Seite"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-xl font-bold transition-all ${
                  validCurrentPage === pageNum
                    ? 'bg-[var(--theme-accent,#e5a93c)] text-slate-950 shadow-md font-extrabold'
                    : 'bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] text-slate-300 hover:text-white'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage >= totalPages}
              className="p-2 rounded-xl bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Nächste Seite"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
