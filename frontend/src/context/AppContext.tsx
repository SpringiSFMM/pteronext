import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Server,
  ServerStatus,
  PowerAction,
  ActiveView,
  ClusterMetrics,
  NodeInfo,
  ActivityItem,
  FileItem,
  ScheduleTask,
  DatabaseInstance,
  SubUser,
  ServerDetailTab,
  AdminNode,
  AdminUser,
  AdminNest,
  AdminEgg,
  AdminDatabaseHost,
  AdminDatabaseItem,
  EggVariable,
  Note,
  ColorTheme,
  BackgroundEffect,
} from '../types';
import {
  api,
  BackendServer,
  BackendNode,
  BackendDatabase,
  BackendSchedule,
  BackendNest,
  BackendEgg,
  AuthUser,
  onUnauthorized,
} from '../api/client';

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface CurrentUser {
  id?: number;
  username: string;
  role: 'root_admin' | 'admin' | 'user';
  rootAdmin?: boolean;
  email: string;
  avatar: string;
}

// -------------------------------------------------------------
// Data Mappers: Backend REST Models -> Frontend Interfaces
// -------------------------------------------------------------
function mapBackendServerToFrontend(bServer: BackendServer): Server {
  const egg = bServer.egg;
  const eggNameFromBackend = egg?.name;
  const eggCategory = bServer.egg_category || egg?.category;
  const nestName = bServer.nest?.name || bServer.nest_slug;

  const eggName = eggNameFromBackend || (
    bServer.image?.includes('discord') || bServer.name?.toLowerCase().includes('discord') || bServer.name?.toLowerCase().includes('bot')
    ? 'Discord Bot'
    : bServer.image?.includes('nodejs') || bServer.image?.includes('node')
    ? 'Node.js'
    : bServer.image?.includes('python')
    ? 'Python App'
    : bServer.image?.includes('redis')
    ? 'Redis Cache'
    : bServer.image?.includes('java')
    ? 'PaperMC / Java'
    : bServer.name?.toLowerCase().includes('minecraft')
    ? 'Minecraft'
    : 'Container'
  );

  let category: 'Gaming' | 'Database' | 'Applications' | 'Infrastructure' = 'Applications';
  const lowerName = `${bServer.name} ${bServer.image || ''} ${eggNameFromBackend || ''} ${eggCategory || ''} ${nestName || ''}`.toLowerCase();
  if (
    lowerName.includes('bot') ||
    lowerName.includes('discord')
  ) {
    category = 'Applications';
  } else if (
    lowerName.includes('mine') ||
    lowerName.includes('paper') ||
    lowerName.includes('purpur') ||
    lowerName.includes('spigot') ||
    lowerName.includes('forge') ||
    lowerName.includes('fabric') ||
    lowerName.includes('bedrock') ||
    lowerName.includes('game') ||
    lowerName.includes('valheim') ||
    lowerName.includes('rust')
  ) {
    category = 'Gaming';
  } else if (
    lowerName.includes('sql') ||
    lowerName.includes('db') ||
    lowerName.includes('redis') ||
    lowerName.includes('mongo') ||
    lowerName.includes('postgres')
  ) {
    category = 'Database';
  } else if (
    lowerName.includes('proxy') ||
    lowerName.includes('node') ||
    lowerName.includes('daemon') ||
    lowerName.includes('infra')
  ) {
    category = 'Infrastructure';
  }

  const rawAlias = bServer.allocation?.alias?.trim();
  const rawIp = bServer.allocation?.ip?.trim();
  const nodeFqdn = bServer.node?.fqdn?.trim();

  let allocHost = window.location.hostname || '127.0.0.1';
  if (rawAlias && rawAlias !== 'play.example.com') {
    allocHost = rawAlias;
  } else if (nodeFqdn && nodeFqdn !== '127.0.0.1') {
    allocHost = nodeFqdn;
  } else if (rawIp && rawIp !== '0.0.0.0') {
    allocHost = rawIp;
  }

  const allocPort = bServer.allocation?.port || (category === 'Gaming' ? 25565 : 3000);
  const status: ServerStatus = bServer.suspended ? 'stopped' : 'running';

  return {
    id: String(bServer.id),
    uuid: bServer.uuid,
    name: bServer.name,
    description: bServer.description || 'PteroNext Managed Container',
    node: bServer.node?.name || 'Local Wings Node',
    nodeLocation: bServer.node?.fqdn || 'Frankfurt, DE',
    allocation: `${allocHost}:${allocPort}`,
    egg: eggName,
    nest: bServer.nest?.name || bServer.nest_slug || undefined,
    category,
    status,
    stats: {
      cpu: 0,
      memory: 0,
      memoryLimit: bServer.memory || 2048,
      disk: 0,
      diskLimit: bServer.disk || 10240,
      networkRx: 0,
      networkTx: 0,
      uptime: 0,
    },
    dockerImage: bServer.image || (category === 'Gaming' ? 'ghcr.io/pterodactyl/yolks:java_21' : 'ghcr.io/pterodactyl/yolks:nodejs_20'),
    startup: bServer.startup || (category === 'Gaming' ? 'java -jar server.jar' : 'node index.js'),
    cpuLimit: bServer.cpu || 200,
    swapLimit: bServer.swap || 0,
    ioLimit: bServer.io || 500,
    backupsLimit: bServer.backup_limit !== undefined ? bServer.backup_limit : 5,
    isSuspended: Boolean(bServer.suspended),
    suspended: Boolean(bServer.suspended),
    owner: bServer.owner?.username || 'admin',
    ownerEmail: bServer.owner?.email || '',
    identifier: bServer.identifier || '',
    tags: [category.toLowerCase(), bServer.identifier || 'ptero'],
    sftpDetails: {
      host: bServer.node?.fqdn || '127.0.0.1',
      port: bServer.node?.daemon_sftp || 2022,
      user: `${bServer.owner?.username || 'admin'}.${bServer.identifier || 'srv'}`,
    },
  };
}

function mapBackendNodeToFrontend(node: BackendNode): NodeInfo {
  const uniqueServerIds = new Set(
    (node.allocations || []).filter((a) => a.server_id && a.server_id > 0).map((a) => a.server_id)
  );
  const activeSrv = uniqueServerIds.size > 0 ? uniqueServerIds.size : (node.servers?.length || 1);

  return {
    id: String(node.id),
    name: node.name,
    location: node.fqdn || 'Frankfurt, DE',
    flag: 'DE',
    ip: node.fqdn || '127.0.0.1',
    status: node.maintenance_mode ? 'warning' : 'healthy',
    cpuUsage: 14,
    ramUsage: Math.min(100, Math.round(((node.memory || 8192) / 8192) * 25)),
    diskUsage: Math.min(100, Math.round(((node.disk || 51200) / 51200) * 15)),
    activeServers: activeSrv,
    latencyMs: 12,
  };
}

function mapBackendDatabaseToFrontend(db: BackendDatabase): DatabaseInstance {
  return {
    id: String(db.id),
    name: db.database.replace(/^s\d+_/, '') || db.database,
    database: db.database,
    host: db.database_host?.host || '127.0.0.1',
    port: db.database_host?.port || 3306,
    username: db.username,
    password: db.password || '••••••••••••••••',
    connections: 1,
    sizeMB: 2.4,
  };
}

function mapBackendScheduleToFrontend(sch: BackendSchedule): ScheduleTask {
  return {
    id: String(sch.id),
    name: sch.name,
    cron: `${sch.cron_minute || '0'} ${sch.cron_hour || '4'} ${sch.cron_day_of_month || '*'} ${sch.cron_month || '*'} ${sch.cron_day_of_week || '*'}`,
    description: `Automated schedule: ${sch.name}`,
    isActive: sch.is_active,
    lastRun: sch.last_run_at || 'Never',
    nextRun: sch.next_run_at || 'Calculated by cron engine',
    actions: sch.tasks && sch.tasks.length > 0 ? sch.tasks.map((t) => t.action) : ['Command Execution'],
  };
}

// -------------------------------------------------------------
// Admin Mappers: Real backend entities -> Admin view models
// -------------------------------------------------------------
type NodeServerStats = { count: number; memoryMB: number; diskMB: number };

/** Generates a local SVG avatar with initials (no external services). */
function initialsAvatar(name: string): string {
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#21262d"/><text x="32" y="34" dy="0.36em" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="22" font-weight="600" fill="#e6edf3">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function mapBackendNestToAdmin(nest: BackendNest): AdminNest {
  return {
    id: String(nest.id),
    name: nest.name,
    slug: nest.slug,
    description: nest.description || 'No description provided.',
    icon: 'Package',
    eggsCount: nest.eggs?.length ?? 0,
  };
}

function mapBackendEggToAdmin(egg: BackendEgg): AdminEgg {
  return {
    id: String(egg.id),
    nestId: String(egg.nest_id),
    name: egg.name,
    author: egg.nest?.name || `nest #${egg.nest_id}`,
    description: egg.description || 'No description provided.',
    dockerImages: egg.docker_images || {},
    startup: egg.startup_command || '—',
    variables: (egg.variables || []) as EggVariable[],
    scriptInstall: egg.script_install || '',
    scriptContainer: egg.script_container || 'ghcr.io/pterodactyl/installers:alpine',
    scriptEntry: egg.script_entry || 'ash',
    version: 'PTDL',
    createdAt: egg.created_at || '',
  };
}

function mapBackendNodeToAdmin(
  node: BackendNode,
  stats?: NodeServerStats
): AdminNode {
  const ramTotal = node.memory || 1;
  const diskTotal = node.disk || 1;
  const ramAlloc = Math.min(ramTotal, stats?.memoryMB || 0);
  const diskAlloc = Math.min(diskTotal, stats?.diskMB || 0);

  return {
    id: String(node.id),
    uuid: node.uuid || '',
    name: node.name,
    location: node.description || node.fqdn,
    flag: 'GL',
    ip: node.fqdn,
    status: node.maintenance_mode ? 'warning' : 'healthy',
    cpuUsage: 0,
    ramUsage: Math.min(100, Math.round((ramAlloc / ramTotal) * 100)),
    diskUsage: Math.min(100, Math.round((diskAlloc / diskTotal) * 100)),
    activeServers: stats?.count || 0,
    latencyMs: 0,
    fqdn: node.fqdn,
    daemonPort: node.daemon_listen || 8080,
    sftpPort: node.daemon_sftp || 2022,
    ramAllocatedMB: ramAlloc,
    ramTotalMB: ramTotal,
    diskAllocatedMB: diskAlloc,
    diskTotalMB: diskTotal,
    totalAllocations: node.allocations?.length || 0,
    wingsVersion: 'Wings',
    kernel: '—',
    enrollToken: '',
    sslEnabled: (node.scheme || 'https') === 'https',
    memoryOverallocate: node.memory_overallocate || 0,
    diskOverallocate: node.disk_overallocate || 0,
  };
}

function mapBackendUserToAdmin(user: AuthUser & { created_at?: string; avatar_url?: string; avatar?: string; is_subuser?: boolean; subuser_servers?: string[]; servers_count?: number; discord_id?: string; discord_username?: string }, serversCount = 0): AdminUser {
  return {
    id: String(user.id),
    uuid: (user as any).uuid || '',
    username: user.username,
    email: user.email,
    avatar: (user as any).avatar_url || (user as any).avatar || initialsAvatar(user.username),
    rootAdmin: user.root_admin,
    twoFactor: !!user.two_factor_enabled,
    lastLogin: '—',
    createdAt: user.created_at ? user.created_at.slice(0, 10) : '—',
    serversCount: user.servers_count !== undefined ? user.servers_count : serversCount,
    isSubuser: !!(user as any).is_subuser,
    subuserServers: (user as any).subuser_servers || [],
    discordId: (user as any).discord_id || '',
    discordUsername: (user as any).discord_username || '',
  };
}

interface AppContextType {
  // Authentication & Session
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  login: (user: string, password: string, code?: string) => Promise<{ success: boolean; twoFactorRequired?: boolean; error?: string }>;
  logout: () => void;

  // Navigation
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedServer: Server | null;
  setSelectedServer: (serverOrUpdater: Server | null | ((prev: Server | null) => Server | null)) => void;
  activeServerTab: ServerDetailTab;
  setActiveServerTab: (tab: ServerDetailTab) => void;
  selectServerAndNavigate: (server: Server, tab?: ServerDetailTab) => void;
  /** Global view the user came from before entering the server workspace. */
  previousGlobalView: ActiveView;
  /** Returns from the server workspace to the previous global view. */
  navigateBackFromServer: () => void;

  // Mobile drawer & Sidebar Collapse
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapse: () => void;

  // Account Settings Modal
  isAccountSettingsOpen: boolean;
  setIsAccountSettingsOpen: (open: boolean) => void;

  // Current User
  currentUser: CurrentUser;
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser>>;

  // Subuser Permissions for currently selected server
  currentServerPermissions: string[];
  currentServerRole: string;
  canAccessServerTab: (tabId: ServerDetailTab) => boolean;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Data & State
  servers: Server[];
  clusterMetrics: ClusterMetrics;
  nodes: NodeInfo[];
  activities: ActivityItem[];
  files: FileItem[];
  schedules: ScheduleTask[];
  databases: DatabaseInstance[];
  users: SubUser[];
  terminalLogs: string[];

  // Admin Data (loaded from the real panel-core REST API)
  adminNodes: AdminNode[];
  adminUsers: AdminUser[];
  adminNests: AdminNest[];
  adminEggs: AdminEgg[];
  adminLoading: boolean;
  refreshAdminData: () => Promise<void>;
  createNest: (payload: { name: string; description?: string; slug?: string }) => Promise<boolean>;
  deleteNest: (id: string) => Promise<boolean>;
  importEgg: (payload: { json?: string; file?: File; nestId?: string }) => Promise<boolean>;
  deleteEgg: (id: string) => Promise<boolean>;
  createEgg: (payload: {
    nest_id: number;
    name: string;
    description?: string;
    docker_images?: Record<string, string>;
    startup_command?: string;
    config_stop?: string;
    script_install?: string;
    script_container?: string;
    script_entry?: string;
    variables?: any[];
  }) => Promise<boolean>;
  updateEgg: (id: string, payload: any) => Promise<boolean>;
  createAdminNode: (payload: {
    name: string;
    fqdn: string;
    description?: string;
    memory: number;
    memory_overallocate?: number;
    disk: number;
    disk_overallocate?: number;
    daemon_listen?: number;
    daemon_sftp?: number;
  }) => Promise<boolean>;
  deleteAdminNode: (id: string) => Promise<boolean>;
  createAdminUser: (payload: {
    username: string;
    email: string;
    password: string;
    root_admin?: boolean;
  }) => Promise<boolean>;
  deleteAdminUser: (id: string) => Promise<boolean>;

  // Admin Databases
  adminDatabaseHosts: AdminDatabaseHost[];
  adminGlobalDatabases: AdminDatabaseItem[];
  refreshAdminDatabases: () => Promise<void>;
  createDatabaseHost: (payload: {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    node_id?: number;
    max_databases?: number;
  }) => Promise<boolean>;
  deleteDatabaseHost: (id: string) => Promise<boolean>;

  // Account Settings Modal state
  accountSettingsTab: 'profile' | '2fa' | 'api-keys';
  setAccountSettingsTab: (tab: 'profile' | '2fa' | 'api-keys') => void;
  openAccountSettings: (tab?: 'profile' | '2fa' | 'api-keys') => void;

  // Server startup
  updateServerStartup: (uuid: string, startup: string) => Promise<boolean>;

  // Color Themes & User Preferences
  colorTheme: ColorTheme;
  globalColorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  setGlobalColorTheme: (theme: ColorTheme) => Promise<boolean>;
  resetPersonalTheme: () => Promise<boolean>;
  backgroundEffect: BackgroundEffect;
  setBackgroundEffect: (effect: BackgroundEffect) => void;
  customCss: string;
  setCustomCss: (css: string) => void;
  setGlobalCustomCss: (css: string) => Promise<boolean>;
  language: 'de' | 'en';
  setLanguage: (lang: 'de' | 'en') => void;

  // Command Palette
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;

  // Server Creation & Import Modal
  isCreateServerOpen: boolean;
  setIsCreateServerOpen: (open: boolean) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
  createServer: (payload: any) => Promise<boolean>;

  // Node & Server Administration
  updateAdminNode: (id: string, updates: any) => Promise<boolean>;
  updateServerAdminSettings: (serverId: string, updates: any) => Promise<boolean>;
  deleteServer: (serverId: string, password?: string) => Promise<boolean>;
  toggleServerSuspension: (serverId: string) => Promise<boolean>;
  reinstallServer: (serverId: string) => Promise<boolean>;

  // Dashboard Notes (persisted locally)
  notes: Note[];
  addNote: (note: { title: string; body: string }) => void;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'pinned'>>) => void;
  deleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;

  // Actions
  handlePowerAction: (serverId: string, action: PowerAction) => void;
  addTerminalCommand: (command: string) => void;
  clearTerminal: () => void;
  saveFileContent: (path: string, newContent: string) => void;
  createFile: (file: FileItem) => void;
  createFolder: (path: string, name: string) => void;
  deleteFile: (path: string) => Promise<boolean>;
  renameFile: (oldPath: string, newPath: string, newName: string) => void;
  uploadFiles: (newFiles: FileItem[]) => void;
  uploadRawFiles: (root: string, rawFiles: File[], onProgress?: (percent: number, loaded: number, total: number) => void) => Promise<boolean>;
  installMinecraftVersion: (version: string, jarFileName?: string) => void;
  toggleSchedule: (scheduleId: string) => void;
  triggerScheduleNow: (scheduleId: string) => void;
  addSchedule: (schedule: Omit<ScheduleTask, 'id' | 'lastRun'>) => void;
  addDatabase: (db: Omit<DatabaseInstance, 'id' | 'connections' | 'sizeMB'>) => void;
  deleteDatabase: (id: string) => void;
  addUser: (user: Omit<SubUser, 'id' | 'addedAt'>) => void;
  updateUser: (id: string, user: Partial<SubUser> & { path_rules?: any; command_rules?: any }) => Promise<boolean>;
  deleteUser: (id: string) => void;

  // Refresh Helpers
  refreshServers: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshDatabases: () => Promise<void>;
  loadDirectory: (dir?: string) => Promise<FileItem[]>;

  // DNS Revocation Global Notification Modal
  dnsRevocationAlert: {
    id: number;
    subdomain: string;
    full_domain: string;
    reason: string;
    serverUuid?: string;
  } | null;
  setDnsRevocationAlert: React.Dispatch<
    React.SetStateAction<{
      id: number;
      subdomain: string;
      full_domain: string;
      reason: string;
      serverUuid?: string;
    } | null>
  >;
  dismissDnsRevocationAlert: () => Promise<void>;

  // System Version
  systemVersion: string;
  setSystemVersion: (version: string) => void;
  checkSystemVersion: () => Promise<void>;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getInitialFilesForServer(serverUuid: string): FileItem[] {
  try {
    const raw = localStorage.getItem(`pteronext_files_${serverUuid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

function saveFilesForServer(serverUuid: string, newFiles: FileItem[]) {
  try {
    localStorage.setItem(`pteronext_files_${serverUuid}`, JSON.stringify(newFiles));
  } catch (e) {
    console.error('Failed saving server files to localStorage:', e);
  }
}

export function getParentDir(path: string): string {
  const normalized = path.replace(/\/+$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return normalized.substring(0, lastSlash);
}

export interface ParsedRoute {
  view: ActiveView;
  serverIdentifier?: string;
  serverTab?: ServerDetailTab;
}

export function parseRouteFromPath(pathname: string): ParsedRoute {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (!clean) return { view: 'dashboard' };

  const segments = clean.split('/');
  const first = segments[0].toLowerCase();

  if (first === 'server' || first === 'servers') {
    if (segments.length === 1) {
      return { view: 'servers' };
    }
    const serverIdentifier = segments[1];
    let serverTab: ServerDetailTab = 'console';
    if (segments.length >= 3) {
      const tabStr = segments[2].toLowerCase();
      if (tabStr === 'files' || tabStr === 'filemanager' || tabStr === 'file-manager') serverTab = 'files';
      else if (tabStr === 'backups' || tabStr === 'backup') serverTab = 'backups';
      else if (tabStr === 'plugins' || tabStr === 'pluginstore' || tabStr === 'plugin-store') serverTab = 'plugin-store';
      else if (tabStr === 'databases' || tabStr === 'database') serverTab = 'databases';
      else if (tabStr === 'schedules' || tabStr === 'schedule') serverTab = 'schedules';
      else if (tabStr === 'users' || tabStr === 'subusers') serverTab = 'users';
      else if (tabStr === 'worlds' || tabStr === 'world' || tabStr === 'world-manager') serverTab = 'world-manager';
      else if (tabStr === 'config' || tabStr === 'game-config') serverTab = 'game-config';
      else if (tabStr === 'webhooks' || tabStr === 'webhook') serverTab = 'webhooks';
      else if (tabStr === 'settings') serverTab = 'settings';
      else if (tabStr === 'console') serverTab = 'console';
    }
    return { view: 'server-detail', serverIdentifier, serverTab };
  }

  if (first === 'admin') {
    if (segments.length === 1 || segments[1] === 'dashboard') return { view: 'admin-dashboard' };
    if (segments[1] === 'servers') return { view: 'admin-servers' };
    if (segments[1] === 'nodes') return { view: 'admin-nodes' };
    if (segments[1] === 'users') return { view: 'admin-users' };
    if (segments[1] === 'eggs' || segments[1] === 'nests') return { view: 'admin-eggs' };
    if (segments[1] === 'databases') return { view: 'admin-databases' };
    if (segments[1] === 'discord-bot' || segments[1] === 'discord' || segments[1] === 'bot') return { view: 'admin-discord-bot' };
    if (segments[1] === 'status' || segments[1] === 'status-pages' || segments[1] === 'statuspage' || segments[1] === 'uptime') return { view: 'admin-status-pages' };
    if (segments[1] === 'api-keys' || segments[1] === 'api' || segments[1] === 'apikeys') return { view: 'admin-api-keys' };
    return { view: 'admin-dashboard' };
  }

  if (first === 'dashboard') return { view: 'dashboard' };
  if (first === 'schedules') return { view: 'schedules' };
  if (first === 'databases') return { view: 'databases' };
  if (first === 'activity') return { view: 'activity' };
  if (first === 'changelog' || first === 'updates') return { view: 'changelog' };
  if (first === 'setup') return { view: 'setup' };

  return { view: 'dashboard' };
}

export function buildPathForRoute(view: ActiveView, server?: Server | null, tab?: ServerDetailTab): string {
  if (view === 'server-detail' && server) {
    const id = server.identifier || server.uuid || server.id;
    const t = tab || 'console';
    return `/server/${id}/${t}`;
  }
  switch (view) {
    case 'servers': return '/servers';
    case 'schedules': return '/schedules';
    case 'databases': return '/databases';
    case 'activity': return '/activity';
    case 'changelog': return '/changelog';
    case 'admin':
    case 'admin-dashboard': return '/admin/dashboard';
    case 'admin-servers': return '/admin/servers';
    case 'admin-nodes': return '/admin/nodes';
    case 'admin-users': return '/admin/users';
    case 'admin-eggs': return '/admin/eggs';
    case 'admin-databases': return '/admin/databases';
    case 'admin-discord-bot': return '/admin/discord-bot';
    case 'admin-status-pages': return '/admin/status';
    case 'admin-api-keys': return '/admin/api-keys';
    case 'dashboard': default: return '/';
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRoute = useRef<ParsedRoute>(parseRouteFromPath(typeof window !== 'undefined' ? window.location.pathname : ''));
  const consoleSocketRef = useRef<WebSocket | null>(null);

  const [activeView, setActiveViewState] = useState<ActiveView>(() => {
    return initialRoute.current.view;
  });

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServerState] = useState<Server | null>(null);

  const [activeServerTab, setActiveServerTabState] = useState<ServerDetailTab>(() => {
    return initialRoute.current.serverTab || 'console';
  });

  const syncUrl = useCallback((view: ActiveView, server?: Server | null, tab?: ServerDetailTab) => {
    try {
      if (typeof window === 'undefined') return;
      const newPath = buildPathForRoute(view, server, tab);
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    } catch {}
  }, []);

  const setActiveView = useCallback((view: ActiveView) => {
    setActiveViewState(view);
    syncUrl(view, selectedServer, activeServerTab);
    try {
      localStorage.setItem('pteronext_active_view', view);
    } catch {}
  }, [selectedServer, activeServerTab, syncUrl]);

  const setSelectedServer = useCallback((serverOrUpdater: Server | null | ((prev: Server | null) => Server | null)) => {
    setSelectedServerState((prev) => {
      const next = typeof serverOrUpdater === 'function' ? serverOrUpdater(prev) : serverOrUpdater;
      try {
        if (next?.uuid) {
          localStorage.setItem('pteronext_selected_server', next.uuid);
        }
      } catch {}
      return next;
    });
  }, []);

  const setActiveServerTab = useCallback((tab: ServerDetailTab) => {
    setActiveServerTabState(tab);
    if (selectedServer) {
      syncUrl('server-detail', selectedServer, tab);
    }
    try {
      localStorage.setItem('pteronext_active_tab', tab);
    } catch {}
  }, [selectedServer, syncUrl]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => api.auth.isAuthenticated());
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pteronext_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const setIsSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed);
    try {
      localStorage.setItem('pteronext_sidebar_collapsed', String(collapsed));
    } catch {}
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pteronext_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [systemVersion, setSystemVersion] = useState<string>('v2.9.2');

  const checkSystemVersion = useCallback(async () => {
    try {
      const res = await api.updates.check();
      if (res?.current_version) {
        setSystemVersion(res.current_version);
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkSystemVersion();
  }, [checkSystemVersion]);

  const [searchQuery, setSearchQuery] = useState('');
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleTask[]>([]);
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [users, setUsers] = useState<SubUser[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    username: '',
    role: 'user',
    email: '',
    avatar: '',
  });

  const [currentServerPermissions, setCurrentServerPermissions] = useState<string[]>(['*']);
  const [currentServerRole, setCurrentServerRole] = useState<string>('Owner');

  const canAccessServerTab = useCallback((tabId: ServerDetailTab): boolean => {
    // 1. Root admin or Owner has unrestricted access
    if (currentUser?.rootAdmin || currentUser?.role === 'root_admin') return true;
    if (currentServerRole === 'Owner' || currentServerRole === 'Admin') return true;
    if (currentServerPermissions.includes('*')) return true;

    // 2. Map tabs to standard Pterodactyl permission keys
    const TAB_PERMISSIONS_MAP: Record<ServerDetailTab, string[]> = {
      'console': ['console.view', 'control.console'],
      'diagnostics': ['admin.diagnostics', 'server.diagnostics'],
      'files': ['file.read', 'file.list'],
      'backups': ['backup.read', 'backup.list'],
      'players': ['player.read', 'player.list', 'console.view'],
      'network': ['allocation.read', 'allocation.list'],
      'webhooks': ['webhook.read', 'webhook.list'],
      'plugin-store': ['file.read', 'file.write', 'plugin.install'],
      'game-config': ['file.read', 'file.write', 'startup.read'],
      'sidecars': ['database.read', 'database.create'],
      'databases': ['database.read', 'database.list'],
      'schedules': ['schedule.read', 'schedule.list'],
      'security': ['admin.security', 'settings.view'],
      'users': ['user.read', 'user.list'],
      'audit': ['audit.read', 'audit.list'],
      'settings': ['settings.view', 'settings.edit', 'startup.read'],
      'env-vault': ['file.read', 'file.write', 'startup.read'],
      'git-deploy': ['control.console', 'startup.read', 'file.write'],
      'steam-query': ['console.view', 'control.console'],
      'voice-dashboard': ['console.view', 'control.console'],
      'web-suite': ['allocation.read', 'settings.view'],
      'bot-suite': ['file.read', 'file.write', 'control.console'],
      'world-manager': ['file.read', 'file.write', 'control.console'],
    };

    const needed = TAB_PERMISSIONS_MAP[tabId];
    if (!needed || needed.length === 0) return true;

    // Check if user has any of the needed permissions
    return needed.some((perm) => {
      if (currentServerPermissions.includes(perm)) return true;
      const prefix = perm.split('.')[0] + '.*';
      return currentServerPermissions.includes(prefix);
    });
  }, [currentUser, currentServerRole, currentServerPermissions]);

  const [adminNodes, setAdminNodes] = useState<AdminNode[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminNests, setAdminNests] = useState<AdminNest[]>([]);
  const [adminEggs, setAdminEggs] = useState<AdminEgg[]>([]);
  const [adminDatabaseHosts, setAdminDatabaseHosts] = useState<AdminDatabaseHost[]>([]);
  const [adminGlobalDatabases, setAdminGlobalDatabases] = useState<AdminDatabaseItem[]>([]);
  const [accountSettingsTab, setAccountSettingsTab] = useState<'profile' | '2fa' | 'api-keys'>('profile');
  const [adminLoading, setAdminLoading] = useState(false);
  const [previousGlobalView, setPreviousGlobalView] = useState<ActiveView>('dashboard');

  // Color Theme & User Palette Preference
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    try {
      return (localStorage.getItem('pteronext_theme') as ColorTheme) || 'zinc';
    } catch {
      return 'zinc';
    }
  });

  const [globalColorTheme, setGlobalColorThemeState] = useState<ColorTheme>('zinc');
  const personalThemeRef = useRef<string | null>(null);

  // Sets personal user theme (Account Settings / Command Palette / Navbar)
  const setColorTheme = useCallback((theme: ColorTheme) => {
    personalThemeRef.current = theme;
    setColorThemeState(theme);
    try {
      localStorage.setItem('pteronext_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.remove('theme-zinc', 'theme-violet', 'theme-emerald', 'theme-orange', 'theme-amber');
      document.documentElement.classList.add(`theme-${theme}`);
    } catch {}

    // Persist personal theme preference to backend for the current user
    if (api.auth.isAuthenticated()) {
      api.theme.updateUserTheme({ theme }).catch((err) => {
        console.warn('Could not sync user theme to backend:', err);
      });
    }
  }, []);

  // Sets global panel theme (Admin Dashboard only)
  const setGlobalColorTheme = useCallback(async (theme: ColorTheme): Promise<boolean> => {
    try {
      setGlobalColorThemeState(theme);
      await api.theme.updateGlobalTheme({ theme });

      // If current user has NO personal theme set, apply the global theme immediately
      if (!personalThemeRef.current) {
        setColorThemeState(theme);
        try {
          localStorage.setItem('pteronext_theme', theme);
          document.documentElement.setAttribute('data-theme', theme);
          document.documentElement.classList.remove('theme-zinc', 'theme-violet', 'theme-emerald', 'theme-orange', 'theme-amber');
          document.documentElement.classList.add(`theme-${theme}`);
        } catch {}
      }
      return true;
    } catch (err: any) {
      console.warn('Could not update global theme:', err);
      return false;
    }
  }, []);

  // Resets personal theme back to following the global theme
  const resetPersonalTheme = useCallback(async (): Promise<boolean> => {
    try {
      personalThemeRef.current = null;
      if (api.auth.isAuthenticated()) {
        await api.theme.updateUserTheme({ theme: '' });
      }
      setColorThemeState(globalColorTheme);
      try {
        localStorage.setItem('pteronext_theme', globalColorTheme);
        document.documentElement.setAttribute('data-theme', globalColorTheme);
        document.documentElement.classList.remove('theme-zinc', 'theme-violet', 'theme-emerald', 'theme-orange', 'theme-amber');
        document.documentElement.classList.add(`theme-${globalColorTheme}`);
      } catch {}
      return true;
    } catch (err: any) {
      console.warn('Could not reset personal theme:', err);
      return false;
    }
  }, [globalColorTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
    document.documentElement.classList.remove('theme-zinc', 'theme-violet', 'theme-emerald', 'theme-orange', 'theme-amber');
    document.documentElement.classList.add(`theme-${colorTheme}`);
  }, [colorTheme]);

  // Language (DE/EN)
  const [language, setLanguageState] = useState<'de' | 'en'>(() => {
    try {
      return (localStorage.getItem('pteronext_lang') as 'de' | 'en') || 'de';
    } catch {
      return 'de';
    }
  });

  const setLanguage = useCallback((lang: 'de' | 'en') => {
    setLanguageState(lang);
    try {
      localStorage.setItem('pteronext_lang', lang);
    } catch {}
  }, []);

  // Global DNS Revocation Alert State
  const [dnsRevocationAlert, setDnsRevocationAlert] = useState<{
    id: number;
    subdomain: string;
    full_domain: string;
    reason: string;
    serverUuid?: string;
  } | null>(null);

  const dismissDnsRevocationAlert = useCallback(async () => {
    if (!dnsRevocationAlert) return;
    const { id, serverUuid } = dnsRevocationAlert;
    if (serverUuid && id > 0) {
      try {
        await api.dns.dismissNotification(serverUuid, id);
      } catch (e) {
        console.warn('Failed to dismiss revocation notification:', e);
      }
    }
    setDnsRevocationAlert(null);
  }, [dnsRevocationAlert]);

  // Background Effect
  const [backgroundEffect, setBackgroundEffectState] = useState<BackgroundEffect>(() => {
    try {
      return (localStorage.getItem('pteronext_bg_effect') as BackgroundEffect) || 'ambient';
    } catch {
      return 'ambient';
    }
  });

  const setBackgroundEffect = useCallback((effect: BackgroundEffect) => {
    setBackgroundEffectState(effect);
    try {
      localStorage.setItem('pteronext_bg_effect', effect);
      document.body.setAttribute('data-bg', effect);
    } catch {}
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-bg', backgroundEffect);
  }, [backgroundEffect]);

  // Custom CSS Injection (Personal vs Global)
  const [customCss, setCustomCssState] = useState<string>(() => {
    try {
      return localStorage.getItem('pteronext_custom_css') || '';
    } catch {
      return '';
    }
  });

  const setCustomCss = useCallback((css: string) => {
    setCustomCssState(css);
    try {
      localStorage.setItem('pteronext_custom_css', css);
      let styleEl = document.getElementById('pteronext-custom-css');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'pteronext-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    } catch {}

    if (api.auth.isAuthenticated()) {
      api.theme.updateUserTheme({ theme: colorTheme, custom_css: css }).catch((err) => {
        console.warn('Could not sync user custom css to backend:', err);
      });
    }
  }, [colorTheme]);

  const setGlobalCustomCss = useCallback(async (css: string): Promise<boolean> => {
    try {
      await api.theme.updateGlobalTheme({ theme: colorTheme, custom_css: css });
      return true;
    } catch (err: any) {
      console.warn('Could not update global custom css:', err);
      return false;
    }
  }, [colorTheme]);

  useEffect(() => {
    let styleEl = document.getElementById('pteronext-custom-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'pteronext-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = customCss;
  }, [customCss]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Keyboard shortcut CMD+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openAccountSettings = useCallback((tab?: 'profile' | '2fa' | 'api-keys') => {
    if (tab) setAccountSettingsTab(tab);
    setIsAccountSettingsOpen(true);
  }, []);

  // Dashboard notes – persisted in localStorage so they survive reloads.
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const raw = localStorage.getItem('pteronext_notes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Note[];
      }
    } catch {
      /* corrupted storage -> start empty */
    }
    return [];
  });


  const [clusterMetrics, setClusterMetrics] = useState<ClusterMetrics>({
    totalServers: 0,
    runningServers: 0,
    activeNodes: 0,
    totalNodes: 0,
    cpuUsedPercent: 0,
    cpuCores: 0,
    ramUsedGB: 0,
    ramTotalGB: 0,
    diskUsedGB: 0,
    diskTotalGB: 0,
    networkThroughput: '0 KB/s',
  });

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -------------------------------------------------------------
  // Data Fetching: Backend REST API
  // -------------------------------------------------------------
  const refreshServers = useCallback(async () => {
    try {
      const srvRes = await api.servers.list();
      const raw = srvRes?.data || [];
      const mapped = raw.map(mapBackendServerToFrontend);
      setServers(mapped);

      // Check URL route for server
      if (initialRoute.current.serverIdentifier) {
        const id = initialRoute.current.serverIdentifier.toLowerCase();
        const found = mapped.find(
          (s) => s.id === id || s.uuid.toLowerCase() === id || s.identifier?.toLowerCase() === id || s.uuid.toLowerCase().startsWith(id)
        );
        if (found) {
          setSelectedServerState(found);
          setActiveViewState('server-detail');
          if (initialRoute.current.serverTab) {
            setActiveServerTabState(initialRoute.current.serverTab);
          }
          return;
        }
      }

      setSelectedServerState((prev) => {
        const savedUuid = localStorage.getItem('pteronext_selected_server');
        if (prev) {
          const match = mapped.find((s) => s.uuid === prev.uuid || s.id === prev.id);
          if (match) return match;
        }
        if (savedUuid) {
          const match = mapped.find((s) => s.uuid === savedUuid || s.id === savedUuid);
          if (match) return match;
        }
        return mapped[0] || null;
      });
    } catch (e) {
      console.warn('[AppContext] Failed to refresh servers:', e);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromPath(window.location.pathname);
      setActiveViewState(route.view);
      if (route.serverTab) {
        setActiveServerTabState(route.serverTab);
      }
      if (route.serverIdentifier && servers.length > 0) {
        const id = route.serverIdentifier.toLowerCase();
        const found = servers.find(
          (s) => s.id === id || s.uuid.toLowerCase() === id || s.identifier?.toLowerCase() === id || s.uuid.toLowerCase().startsWith(id)
        );
        if (found) {
          setSelectedServerState(found);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [servers]);

  const refreshStats = useCallback(async () => {
    try {
      const statsRes = await api.stats.getSystemStats();
      if (statsRes) {
        const totalRAM = (statsRes.host_memory_total_mb && statsRes.host_memory_total_mb > 0)
          ? +(statsRes.host_memory_total_mb / 1024).toFixed(1)
          : (statsRes.total_node_ram_mb && statsRes.total_node_ram_mb > 0 ? +(statsRes.total_node_ram_mb / 1024).toFixed(1) : 8.0);
        const usedRAM = (statsRes.allocated_server_ram_mb && statsRes.allocated_server_ram_mb > 0)
          ? +(statsRes.allocated_server_ram_mb / 1024).toFixed(1)
          : (statsRes.host_memory_used_mb && statsRes.host_memory_used_mb > 0 ? +(statsRes.host_memory_used_mb / 1024).toFixed(1) : 2.0);

        setClusterMetrics((prev) => ({
          ...prev,
          totalServers: statsRes.counts.servers || prev.totalServers,
          activeNodes: statsRes.counts.nodes || prev.activeNodes,
          totalNodes: statsRes.counts.nodes || prev.totalNodes,
          cpuUsedPercent: Math.min(100, Math.max(5, Math.round(statsRes.memory_alloc_mb * 3.5))),
          cpuCores: statsRes.num_cpu || prev.cpuCores,
          ramTotalGB: totalRAM,
          ramUsedGB: usedRAM,
        }));
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh system stats:', e);
    }
  }, []);

  const refreshDatabases = useCallback(async () => {
    if (!selectedServer?.uuid) return;
    try {
      const dbRes = await api.databases.list(selectedServer.uuid);
      if (dbRes?.data) {
        setDatabases(dbRes.data.map(mapBackendDatabaseToFrontend));
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh databases:', e);
    }
  }, [selectedServer?.uuid]);

  const loadDirectory = useCallback(async (dir: string = '/') => {
    if (!selectedServer?.uuid) return [];
    try {
      const res = await api.files.list(selectedServer.uuid, dir);
      if (res?.data && Array.isArray(res.data)) {
        setFiles((prev) => {
          const cleanDir = dir === '/' ? '/' : dir.replace(/\/+$/, '');
          const other = prev.filter((f) => {
            const parent = getParentDir(f.path);
            return parent !== cleanDir;
          });
          const merged = [...other, ...res.data];
          saveFilesForServer(selectedServer.uuid, merged);
          return merged;
        });
        return res.data;
      }
    } catch (e) {
      console.warn('[AppContext] Failed to load directory:', e);
    }
    return [];
  }, [selectedServer?.uuid]);

  // -------------------------------------------------------------
  // Admin Data: loads REAL nests, eggs, nodes and users from panel-core.
  // There is intentionally no mock fallback – empty states are rendered
  // when the backend is unreachable or returns no records.
  // -------------------------------------------------------------
  const refreshAdminData = useCallback(async () => {
    setAdminLoading(true);
    try {
      const [nestsRes, eggsRes, nodesRes, usersRes, serversRes, dbHostsRes, dbsRes] = await Promise.allSettled([
        api.nests.list(),
        api.eggs.list(),
        api.nodes.list(),
        api.users.list(),
        api.servers.list(),
        api.adminDatabases.listHosts(),
        api.adminDatabases.listDatabases(),
      ]);

      const rawServers: BackendServer[] =
        serversRes.status === 'fulfilled' ? serversRes.value?.data || [] : [];

      // Aggregate per-node and per-owner server usage from real records
      const perNode = new Map<number, NodeServerStats>();
      const perOwner = new Map<number, number>();
      rawServers.forEach((s) => {
        const stat = perNode.get(s.node_id) || { count: 0, memoryMB: 0, diskMB: 0 };
        stat.count += 1;
        stat.memoryMB += s.memory || 0;
        stat.diskMB += s.disk || 0;
        perNode.set(s.node_id, stat);
        if (s.owner_id) {
          perOwner.set(s.owner_id, (perOwner.get(s.owner_id) || 0) + 1);
        }
      });

      if (nodesRes.status === 'fulfilled' && nodesRes.value?.data) {
        setAdminNodes(nodesRes.value.data.map((n) => mapBackendNodeToAdmin(n, perNode.get(n.id))));
      }

      if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
        setAdminUsers(
          usersRes.value.data.map((u) => mapBackendUserToAdmin(u, perOwner.get(u.id) || 0))
        );
      }

      if (eggsRes.status === 'fulfilled' && eggsRes.value?.data) {
        setAdminEggs(eggsRes.value.data.map(mapBackendEggToAdmin));
      }

      if (nestsRes.status === 'fulfilled' && nestsRes.value?.data) {
        const eggsForCounts =
          eggsRes.status === 'fulfilled' ? eggsRes.value?.data || [] : [];
        setAdminNests(
          nestsRes.value.data.map((nest) => ({
            ...mapBackendNestToAdmin(nest),
            eggsCount: eggsForCounts.filter((e) => e.nest_id === nest.id).length,
          }))
        );
      }

      if (dbHostsRes.status === 'fulfilled' && dbHostsRes.value?.data) {
        setAdminDatabaseHosts(
          dbHostsRes.value.data.map((h: any) => ({
            id: String(h.id),
            name: h.name,
            host: h.host,
            port: h.port || 3306,
            username: h.username,
            nodeId: h.node_id,
            maxDatabases: h.max_databases,
            databaseCount: h.database_count || 0,
            createdAt: h.created_at,
          }))
        );
      }

      if (dbsRes.status === 'fulfilled' && dbsRes.value?.data) {
        setAdminGlobalDatabases(
          dbsRes.value.data.map((d: any) => ({
            id: String(d.id),
            serverId: d.server_id,
            databaseHostId: d.database_host_id,
            name: d.name || d.database,
            username: d.username,
            remote: d.remote || '%',
            maxConnections: d.max_connections || 0,
            createdAt: d.created_at,
            host: d.host,
          }))
        );
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh admin data:', e);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    let isRoot = false;
    try {
      const meRes = await api.auth.me();
      if (meRes?.user) {
        const u = meRes.user as any;
        isRoot = !!u.root_admin;
        setCurrentUser({
          id: u.id,
          username: u.username,
          role: isRoot ? 'root_admin' : 'user',
          rootAdmin: isRoot,
          email: u.email,
          avatar: u.avatar_url || u.avatar || initialsAvatar(u.username),
        });
      }
    } catch (e) {
      console.warn('[AppContext] Could not fetch current user (/api/auth/me):', e);
    }

    refreshServers();
    refreshStats();
    if (isRoot) {
      refreshAdminData();
    }

    try {
      const nodeRes = await api.nodes.list();
      if (nodeRes?.data) {
        setNodes(nodeRes.data.map(mapBackendNodeToFrontend));
      }
    } catch {}

    try {
      const auditRes = await api.audit.list();
      if (auditRes?.data) {
        setActivities(
          auditRes.data.map((a: any) => ({
            id: String(a.id),
            actor: a.username || a.user?.username || a.actor || 'system',
            action: a.action || a.event || 'system action',
            target: a.target || a.entity || 'system',
            details: a.details || a.properties || '',
            ip: a.ip || a.ip_address || '127.0.0.1',
            rawTimestamp: a.timestamp || a.created_at || '',
            timestamp: a.timestamp || a.created_at ? new Date(a.timestamp || a.created_at).toLocaleString() : 'just now',
            severity:
              a.severity === 'danger' || a.severity === 'warning' || a.severity === 'success'
                ? a.severity
                : 'info',
          }))
        );
      }
    } catch {}
  }, [refreshServers, refreshStats, refreshAdminData]);

  const login = useCallback(
    async (
      user: string,
      password: string,
      code?: string
    ): Promise<{ success: boolean; twoFactorRequired?: boolean; error?: string }> => {
      try {
        const res = await api.auth.login({ user, password, code });
        if (res.two_factor_required) {
          return { success: false, twoFactorRequired: true };
        }
        if (res.token) {
          setIsAuthenticated(true);
          if (res.user) {
            const u = res.user as any;
            const isRoot = !!u.root_admin;
            setCurrentUser({
              id: u.id,
              username: u.username,
              role: isRoot ? 'root_admin' : 'user',
              rootAdmin: isRoot,
              email: u.email,
              avatar: u.avatar_url || u.avatar || initialsAvatar(u.username),
            });

            // Always route to dashboard on login (as long as user is authenticated)
            setActiveViewState('dashboard');
            window.history.replaceState({}, '', '/');
          }
          await refreshUserData();
          return { success: true };
        }
        return { success: false, error: res.error || 'Login failed' };
      } catch (err: any) {
        const is2FA = !!err?.data?.two_factor_required;
        return {
          success: false,
          twoFactorRequired: is2FA,
          error: err?.message || 'Login failed',
        };
      }
    },
    [refreshUserData]
  );

  const logout = useCallback(() => {
    api.auth.logout();
    setIsAuthenticated(false);
    setCurrentUser({
      username: '',
      role: 'user',
      email: '',
      avatar: '',
      rootAdmin: false,
    });
    setServers([]);
    setSelectedServer(null);
    setNodes([]);
    setAdminNodes([]);
    setAdminUsers([]);
    setAdminEggs([]);
    setAdminNests([]);
    setAdminDatabaseHosts([]);
    setAdminGlobalDatabases([]);
    setActivities([]);
    setClusterMetrics({
      totalServers: 0,
      runningServers: 0,
      activeNodes: 0,
      totalNodes: 0,
      cpuUsedPercent: 0,
      cpuCores: 0,
      ramUsedGB: 0,
      ramTotalGB: 0,
      diskUsedGB: 0,
      diskTotalGB: 0,
      networkThroughput: '0 KB/s',
    });
    setActiveViewState('dashboard');
    setActiveServerTabState('console');
    setCurrentServerPermissions([]);
    setCurrentServerRole('None');
    try {
      localStorage.removeItem('pteronext_selected_server');
      localStorage.removeItem('pteronext_active_tab');
      localStorage.removeItem('pteronext_active_view');
      sessionStorage.clear();
      window.history.replaceState({}, '', '/');
    } catch {}
  }, []);

  // Initial Load on Provider Mount
  useEffect(() => {
    let isMounted = true;

    async function initBackend() {
      // 0. Check initial production setup status
      try {
        const setupRes = await api.system.getSetupStatus();
        if (isMounted && setupRes && !setupRes.setup_completed && setupRes.user_count === 0) {
          setActiveView('setup');
          setIsAuthChecking(false);
          return;
        }
      } catch (e) {
        console.warn('[AppContext] Setup status check skipped:', e);
      }

      // 0. Check for discord_token in URL query params from OAuth2 callback
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlDiscordToken = urlParams.get('discord_token');
        if (urlDiscordToken) {
          api.auth.setToken(urlDiscordToken);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      // 1. Check if token exists
      const token = api.auth.getToken();
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsAuthChecking(false);
        }
        return;
      }

      // 2. Validate token and load user info from GET /api/auth/me
      let meRes: any = null;
      try {
        meRes = await api.auth.me();
        if (isMounted && meRes?.user) {
          const u = meRes.user as any;
          const isRoot = !!u.root_admin;
          setCurrentUser({
            id: u.id,
            username: u.username,
            role: isRoot ? 'root_admin' : 'user',
            rootAdmin: isRoot,
            email: u.email,
            avatar: u.avatar_url || u.avatar || initialsAvatar(u.username),
          });
          setIsAuthenticated(true);

          // Route Guard: if authenticated user is non-admin and activeView is an admin view, immediately kick to dashboard
          if (!isRoot) {
            setActiveViewState((currentView) => {
              if (currentView.startsWith('admin-')) {
                window.history.replaceState({}, '', '/');
                return 'dashboard';
              }
              return currentView;
            });
          }
        } else {
          if (isMounted) setIsAuthenticated(false);
          api.auth.clearToken();
          if (isMounted) setIsAuthChecking(false);
          return;
        }
      } catch (e) {
        console.warn('[AppContext] Session verification failed (/api/auth/me):', e);
        if (isMounted) setIsAuthenticated(false);
        api.auth.clearToken();
        if (isMounted) setIsAuthChecking(false);
        return;
      }

      // 2b. Load user's personal theme or fallback to global theme
      try {
        const themeRes = await api.theme.getUserTheme();
        if (isMounted && themeRes) {
          if (themeRes.global_theme) {
            setGlobalColorThemeState(themeRes.global_theme as ColorTheme);
          }
          if (themeRes.personal_theme) {
            personalThemeRef.current = themeRes.personal_theme;
          } else {
            personalThemeRef.current = null;
          }

          const effTheme = (themeRes.effective_theme || themeRes.personal_theme || themeRes.global_theme || 'zinc') as ColorTheme;
          setColorThemeState(effTheme);
          localStorage.setItem('pteronext_theme', effTheme);
          document.documentElement.setAttribute('data-theme', effTheme);
          document.documentElement.classList.remove('theme-zinc', 'theme-violet', 'theme-emerald', 'theme-orange', 'theme-amber');
          document.documentElement.classList.add(`theme-${effTheme}`);

          if (themeRes.personal_custom_css) {
            setCustomCssState(themeRes.personal_custom_css);
            localStorage.setItem('pteronext_custom_css', themeRes.personal_custom_css);
          }
        }
      } catch (e) {
        console.warn('[AppContext] Could not fetch user theme preferences:', e);
      }

      // 3. Load servers from GET /api/servers
      try {
        const srvRes = await api.servers.list();
        if (isMounted) {
          const raw = srvRes?.data || [];
          const mapped = raw.map(mapBackendServerToFrontend);
          setServers(mapped);
          const savedUuid = localStorage.getItem('pteronext_selected_server');
          const matched = mapped.find((s) => s.uuid === savedUuid || s.id === savedUuid);
          setSelectedServer(matched || mapped[0] || null);
        }
      } catch (e) {
        console.warn('[AppContext] Could not fetch servers (/api/servers):', e);
      }

      // 4. Load system stats from GET /api/system/stats (Only meaningful for root admin)
      if (meRes?.user?.root_admin) {
        try {
          const statsRes = await api.stats.getSystemStats();
          if (isMounted && statsRes) {
            const totalRAM = (statsRes.host_memory_total_mb && statsRes.host_memory_total_mb > 0)
              ? +(statsRes.host_memory_total_mb / 1024).toFixed(1)
              : (statsRes.total_node_ram_mb && statsRes.total_node_ram_mb > 0 ? +(statsRes.total_node_ram_mb / 1024).toFixed(1) : 8.0);
            const usedRAM = (statsRes.allocated_server_ram_mb && statsRes.allocated_server_ram_mb > 0)
              ? +(statsRes.allocated_server_ram_mb / 1024).toFixed(1)
              : (statsRes.host_memory_used_mb && statsRes.host_memory_used_mb > 0 ? +(statsRes.host_memory_used_mb / 1024).toFixed(1) : 2.0);

            setClusterMetrics((prev) => ({
              ...prev,
              totalServers: statsRes.counts?.servers ?? prev.totalServers,
              activeNodes: statsRes.counts?.nodes ?? prev.activeNodes,
              totalNodes: statsRes.counts?.nodes ?? prev.totalNodes,
              cpuUsedPercent: Math.min(100, Math.max(0, Math.round(statsRes.memory_alloc_mb * 3.5))),
              cpuCores: statsRes.num_cpu || prev.cpuCores,
              ramTotalGB: totalRAM,
              ramUsedGB: usedRAM,
            }));
          }
        } catch (e) {
          console.warn('[AppContext] Could not fetch system stats (/api/system/stats):', e);
        }

        // 5. Load nodes and all admin datasets (Nodes, Users, Eggs, Nests, Databases)
        try {
          const nodeRes = await api.nodes.list();
          if (isMounted) {
            const rawNodes = nodeRes?.data || [];
            setNodes(rawNodes.map(mapBackendNodeToFrontend));
          }
        } catch (e) {
          console.warn('[AppContext] Could not fetch nodes (/api/nodes):', e);
        }

        // 5b. Populate admin nodes, users, eggs, nests, and databases
        try {
          if (isMounted) {
            await refreshAdminData();
          }
        } catch (e) {
          console.warn('[AppContext] Could not refresh admin data:', e);
        }
      }

      // 6. Load audit activities from GET /api/audit-logs
      try {
        const auditRes = await api.audit.list();
        if (isMounted && auditRes?.data) {
          setActivities(
            auditRes.data.map((a: any) => ({
              id: String(a.id),
              actor: a.username || a.user?.username || a.actor || 'system',
              action: (a.action || a.event || 'system action').replace(/[:_]/g, ' '),
              target: a.target || a.entity || 'system',
              details: a.details || a.properties || '',
              ip: a.ip || a.ip_address || '127.0.0.1',
              rawTimestamp: a.timestamp || a.created_at || '',
              timestamp: a.timestamp ? new Date(a.timestamp).toLocaleString() : (a.created_at ? new Date(a.created_at).toLocaleString() : 'just now'),
              severity:
                a.severity === 'danger' || a.severity === 'warning' || a.severity === 'success'
                  ? a.severity
                  : 'info',
            }))
          );
        }
      } catch (e) {
        // optional
      }

      if (isMounted) {
        setIsAuthChecking(false);
      }
    }

    initBackend();

    const unsubAuth = onUnauthorized(() => {
      if (isMounted) {
        setIsAuthenticated(false);
        setSelectedServer(null);
      }
      addToast({
        title: 'Session Expired',
        description: 'Your session has expired. Please sign in again.',
        type: 'warning',
      });
    });

    return () => {
      isMounted = false;
      unsubAuth();
    };
  }, [addToast, refreshAdminData]);

  // Load server context and connect live WebSocket console & metrics
  useEffect(() => {
    if (!selectedServer?.uuid) {
      if (consoleSocketRef.current) {
        consoleSocketRef.current.close();
        consoleSocketRef.current = null;
      }
      return;
    }
    const serverUuid = selectedServer.uuid;
    let isCurrent = true;

    // Reset console logs when switching servers to prevent cross-server log leakage
    setTerminalLogs([]);

    async function loadServerContext() {
      // 0. Load server permissions and role for current user
      try {
        const srvDetail = await api.servers.get(serverUuid);
        if (isCurrent && srvDetail) {
          if (Array.isArray(srvDetail.permissions)) {
            setCurrentServerPermissions(srvDetail.permissions);
          }
          if (srvDetail.role) {
            setCurrentServerRole(srvDetail.role);
          }
        }
      } catch (e) {
        console.warn('Failed to load server permissions:', e);
      }

      // 1. Load real files from backend node filesystem
      try {
        const fileRes = await api.files.list(serverUuid);
        if (isCurrent && fileRes && Array.isArray(fileRes.data)) {
          setFiles(fileRes.data);
          saveFilesForServer(serverUuid, fileRes.data);
        } else if (isCurrent) {
          const loadedFiles = getInitialFilesForServer(serverUuid);
          setFiles(loadedFiles);
        }
      } catch {
        if (isCurrent) {
          const loadedFiles = getInitialFilesForServer(serverUuid);
          setFiles(loadedFiles);
        }
      }

      // 2. Load real databases
      try {
        const dbRes = await api.databases.list(serverUuid);
        if (isCurrent && dbRes?.data) {
          setDatabases(dbRes.data.map(mapBackendDatabaseToFrontend));
        }
      } catch {}

      // 3. Load real schedules
      try {
        const schRes = await api.schedules.list(serverUuid);
        if (isCurrent && schRes?.data) {
          setSchedules(schRes.data.map(mapBackendScheduleToFrontend));
        }
      } catch {}

      // 3b. Load real subusers
      try {
        const subRes = await api.subusers.list(serverUuid);
        if (isCurrent && (subRes?.data || subRes?.subusers)) {
          const rawList = subRes.data || subRes.subusers || [];
          setUsers(rawList.map((su: any) => ({
            id: String(su.id),
            username: su.user?.username || su.username || `User #${su.user_id}`,
            email: su.user?.email || su.email || '',
            avatar: su.user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${su.user?.username || su.username || su.id}`,
            role: (su.role_name || su.role || 'Member') as any,
            twoFactor: Boolean(su.user?.two_factor_enabled || su.twoFactor),
            addedAt: su.created_at ? new Date(su.created_at).toLocaleDateString() : 'Active',
            permissions: typeof su.permissions === 'string' ? (su.permissions ? JSON.parse(su.permissions) : []) : (su.permissions || []),
          })));
        }
      } catch {}

      // 4. Query server live resources immediately
      try {
        const resStats = await api.servers.resources(serverUuid);
        if (isCurrent && resStats) {
          const memMB = Math.round((resStats.memory_bytes || 0) / (1024 * 1024));
          const memLimitMB = Math.round((resStats.memory_limit_bytes || 0) / (1024 * 1024));
          const diskMB = Math.round((resStats.disk_bytes || 0) / (1024 * 1024));
          const actualState = (resStats.current_state || (resStats.is_suspended ? 'stopped' : 'offline')).toLowerCase() as ServerStatus;

          setSelectedServerState((prev) => {
            if (!prev || prev.uuid !== serverUuid) return prev;
            return {
              ...prev,
              status: actualState,
              stats: {
                ...prev.stats,
                cpu: +(resStats.cpu_absolute || 0).toFixed(1),
                memory: memMB,
                memoryLimit: memLimitMB || prev.stats.memoryLimit,
                disk: diskMB > 0 ? diskMB : prev.stats.disk,
                uptime: Math.round((resStats.uptime || 0) / 1000) || prev.stats.uptime,
                networkRx: Math.round((resStats.network_rx_bytes || 0) / 1024),
                networkTx: Math.round((resStats.network_tx_bytes || 0) / 1024),
              },
            };
          });
        }
      } catch {}

      // 4b. Check for pending DNS revocation notifications
      try {
        const notifRes = await api.dns.getNotifications(serverUuid);
        if (isCurrent && notifRes?.notifications && notifRes.notifications.length > 0) {
          const revNotif = notifRes.notifications.find((n: any) => n.type === 'dns_revoked' && !n.is_dismissed);
          if (revNotif) {
            setDnsRevocationAlert({
              id: revNotif.id,
              subdomain: revNotif.subdomain || '',
              full_domain: revNotif.full_domain || '',
              reason: revNotif.reason || '',
              serverUuid,
            });
          }
        }
      } catch {}
    }

    loadServerContext();

    // 5. Connect live WebSocket to backend WebSocketHub for console output & status
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connectWs() {
      if (!isCurrent) return;
      try {
        const wsUrl = api.servers.getWebSocketUrl(serverUuid);
        ws = new WebSocket(wsUrl);
        consoleSocketRef.current = ws;

        ws.onmessage = (event) => {
          if (!isCurrent) return;
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'console output' && Array.isArray(data.args) && data.args.length > 0) {
              const line = String(data.args[0]);
              setTerminalLogs((prev) => [...prev, line]);
            } else if (data.event === 'dns:revoked' && Array.isArray(data.args) && data.args.length > 0) {
              const info = typeof data.args[0] === 'string' ? JSON.parse(data.args[0]) : (data.args[0] || {});
              setDnsRevocationAlert({
                id: info.id || 0,
                subdomain: info.subdomain || '',
                full_domain: info.full_domain || '',
                reason: info.reason || '',
                serverUuid,
              });
              addToast({
                title: info.title || 'Domain von Administrator entfernt',
                description: info.message || `Subdomain '${info.subdomain || info.full_domain}' wurde widerrufen: ${info.reason || ''}`,
                type: 'error',
              });
              window.dispatchEvent(new CustomEvent('pteronext:dns_revoked', { detail: info }));
            } else if (data.event === 'status' && Array.isArray(data.args) && data.args.length > 0) {
              const newSt = String(data.args[0]).toLowerCase() as ServerStatus;
              setSelectedServerState((prev) => (prev && prev.uuid === serverUuid ? { ...prev, status: newSt } : prev));
              setServers((prev) => prev.map((s) => (s.uuid === serverUuid ? { ...s, status: newSt } : s)));
            } else if (data.event === 'stats' && Array.isArray(data.args) && data.args.length > 0) {
              const statsObj = typeof data.args[0] === 'string' ? JSON.parse(data.args[0]) : data.args[0];
              const memMB = Math.round((statsObj.memory_bytes || 0) / (1024 * 1024));
              const memLimitMB = Math.round((statsObj.memory_limit_bytes || 0) / (1024 * 1024));
              const diskMB = Math.round((statsObj.disk_bytes || 0) / (1024 * 1024));
              const cpuPercent = +((statsObj.cpu_absolute || 0)).toFixed(1);
              const uptimeSec = Math.round((statsObj.uptime || 0) / 1000);
              const st = (statsObj.state || 'offline').toLowerCase() as ServerStatus;

              setSelectedServerState((prev) => {
                if (!prev || prev.uuid !== serverUuid) return prev;
                return {
                  ...prev,
                  status: st,
                  stats: {
                    ...prev.stats,
                    cpu: cpuPercent,
                    memory: memMB,
                    memoryLimit: memLimitMB || prev.stats.memoryLimit,
                    disk: diskMB > 0 ? diskMB : prev.stats.disk,
                    uptime: uptimeSec,
                    networkRx: Math.round((statsObj.network?.rx_bytes || 0) / 1024),
                    networkTx: Math.round((statsObj.network?.tx_bytes || 0) / 1024),
                  },
                };
              });

              setServers((prev) =>
                prev.map((s) =>
                  s.uuid === serverUuid
                    ? {
                        ...s,
                        status: st,
                        stats: {
                          ...s.stats,
                          cpu: cpuPercent,
                          memory: memMB,
                          memoryLimit: memLimitMB || s.stats.memoryLimit,
                          disk: diskMB > 0 ? diskMB : s.stats.disk,
                          uptime: uptimeSec,
                          networkRx: Math.round((statsObj.network?.rx_bytes || 0) / 1024),
                          networkTx: Math.round((statsObj.network?.tx_bytes || 0) / 1024),
                        },
                      }
                    : s
                )
              );
            }
          } catch (e) {
            console.error('[WS Parse Error]:', e);
          }
        };

        ws.onclose = () => {
          consoleSocketRef.current = null;
          if (isCurrent) {
            reconnectTimeout = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        if (isCurrent) {
          reconnectTimeout = setTimeout(connectWs, 3000);
        }
      }
    }

    connectWs();

    // 6. Periodic fallback telemetry polling every 4 seconds
    const pollInterval = setInterval(async () => {
      if (!isCurrent) return;
      try {
        const resStats = await api.servers.resources(serverUuid);
        if (isCurrent && resStats) {
          const memMB = Math.round((resStats.memory_bytes || 0) / (1024 * 1024));
          const memLimitMB = Math.round((resStats.memory_limit_bytes || 0) / (1024 * 1024));
          const diskMB = Math.round((resStats.disk_bytes || 0) / (1024 * 1024));
          const actualState = (resStats.current_state || (resStats.is_suspended ? 'stopped' : 'offline')).toLowerCase() as ServerStatus;

          setSelectedServerState((prev) => {
            if (!prev || prev.uuid !== serverUuid) return prev;
            return {
              ...prev,
              status: actualState,
              stats: {
                ...prev.stats,
                cpu: +(resStats.cpu_absolute || 0).toFixed(1),
                memory: memMB,
                memoryLimit: memLimitMB || prev.stats.memoryLimit,
                disk: diskMB > 0 ? diskMB : prev.stats.disk,
                uptime: Math.round((resStats.uptime || 0) / 1000) || prev.stats.uptime,
                networkRx: Math.round((resStats.network_rx_bytes || 0) / 1024),
                networkTx: Math.round((resStats.network_tx_bytes || 0) / 1024),
              },
            };
          });

          setServers((prev) =>
            prev.map((s) =>
              s.uuid === serverUuid
                ? {
                    ...s,
                    status: actualState,
                    stats: {
                      ...s.stats,
                      cpu: +(resStats.cpu_absolute || 0).toFixed(1),
                      memory: memMB,
                      memoryLimit: memLimitMB || s.stats.memoryLimit,
                      disk: diskMB > 0 ? diskMB : s.stats.disk,
                      uptime: Math.round((resStats.uptime || 0) / 1000) || s.stats.uptime,
                      networkRx: Math.round((resStats.network_rx_bytes || 0) / 1024),
                      networkTx: Math.round((resStats.network_tx_bytes || 0) / 1024),
                    },
                  }
                : s
            )
          );
        }
      } catch {}

      // Check for revoked domains notification periodically
      try {
        const notifRes = await api.dns.getNotifications(serverUuid);
        if (isCurrent && notifRes?.notifications && notifRes.notifications.length > 0) {
          const revNotif = notifRes.notifications.find((n: any) => n.type === 'dns_revoked' && !n.is_dismissed);
          if (revNotif) {
            setDnsRevocationAlert((currentAlert) => {
              if (currentAlert && currentAlert.id === revNotif.id) return currentAlert;
              return {
                id: revNotif.id,
                subdomain: revNotif.subdomain || '',
                full_domain: revNotif.full_domain || '',
                reason: revNotif.reason || '',
                serverUuid,
              };
            });
            window.dispatchEvent(new CustomEvent('pteronext:dns_revoked', { detail: revNotif }));
          }
        }
      } catch {}
    }, 4000);


    return () => {
      isCurrent = false;
      clearInterval(pollInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      consoleSocketRef.current = null;
    };
  }, [selectedServer?.uuid]);

  // Navigate to server detail without resetting active tab unless specified
  const selectServerAndNavigate = (server: Server, tab?: ServerDetailTab) => {
    if (activeView !== 'server-detail') {
      setPreviousGlobalView(activeView);
    }
    const finalTab = tab || activeServerTab || 'console';
    setSelectedServerState(server);
    setActiveServerTabState(finalTab);
    setActiveViewState('server-detail');
    syncUrl('server-detail', server, finalTab);
    try {
      localStorage.setItem('pteronext_selected_server', server.uuid);
      localStorage.setItem('pteronext_active_tab', finalTab);
    } catch {}
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Leave the server workspace and return to the view the user came from
  const navigateBackFromServer = () => {
    setActiveView(previousGlobalView === 'server-detail' ? 'servers' : previousGlobalView);
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePowerAction = async (serverId: string, action: PowerAction) => {
    const target = servers.find((s) => s.id === serverId || s.uuid === serverId);
    if (!target) return;

    let optimisticStatus: ServerStatus = target.status;
    let toastType: 'success' | 'info' | 'warning' | 'error' = 'info';
    const actionLabel = action.toUpperCase();

    if (action === 'start') {
      optimisticStatus = 'starting';
      toastType = 'info';
    } else if (action === 'restart') {
      optimisticStatus = 'starting';
      toastType = 'warning';
    } else if (action === 'stop') {
      optimisticStatus = 'stopped';
      toastType = 'warning';
    } else if (action === 'kill') {
      optimisticStatus = 'offline';
      toastType = 'error';
    }

    // Set optimistic state immediately in UI
    setServers((prev) =>
      prev.map((s) =>
        s.id === target.id || s.uuid === target.uuid
          ? {
              ...s,
              status: optimisticStatus,
              stats:
                optimisticStatus === 'stopped' || optimisticStatus === 'offline'
                  ? { ...s.stats, cpu: 0, memory: 0, networkRx: 0, networkTx: 0, uptime: 0 }
                  : s.stats,
            }
          : s
      )
    );

    if (selectedServer && (selectedServer.id === target.id || selectedServer.uuid === target.uuid)) {
      setSelectedServerState((prev) => (!prev ? null : {
        ...prev,
        status: optimisticStatus,
        stats:
          optimisticStatus === 'stopped' || optimisticStatus === 'offline'
            ? { ...prev.stats, cpu: 0, memory: 0, networkRx: 0, networkTx: 0, uptime: 0 }
            : prev.stats,
      }));
    }

    addToast({
      title: `Power Action: ${actionLabel}`,
      description: `Dispatched ${actionLabel} signal to container [${target.name}]`,
      type: toastType,
    });

    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      timestamp: 'Just now',
      actor: `${currentUser.username} (${currentUser.role})`,
      action: `Signal [${actionLabel}] delivered`,
      target: target.name,
      severity: action === 'kill' ? 'danger' : action === 'start' ? 'success' : 'info',
    };
    setActivities((prev) => [newActivity, ...prev]);

    if (selectedServer && (selectedServer.id === target.id || selectedServer.uuid === target.uuid)) {
      setTerminalLogs((prev) => [
        ...prev,
        `[\x1b[33m${new Date().toLocaleTimeString()} POWER\x1b[0m] Signal [${actionLabel}] dispatched to container daemon`,
      ]);
    }

    // Send action via WebSocket if available
    if (consoleSocketRef.current && consoleSocketRef.current.readyState === WebSocket.OPEN) {
      consoleSocketRef.current.send(JSON.stringify({ event: 'set state', args: [action] }));
    }

    // Dispatch to real Go backend REST endpoint
    try {
      await api.servers.power(target.uuid, action);
      // Poll actual container status from Wings after 1.5s and 3.5s
      setTimeout(async () => {
        try {
          const stats = await api.servers.resources(target.uuid);
          if (stats) {
            const mappedState = (stats.current_state as ServerStatus) || 'offline';
            const cpuPercent = +((stats.cpu_absolute || 0)).toFixed(1);
            const memMB = Math.round((stats.memory_bytes || 0) / (1024 * 1024));
            const diskMB = Math.round((stats.disk_bytes || 0) / (1024 * 1024));
            const uptimeSec = Math.round((stats.uptime || 0) / 1000);

            setServers((prev) =>
              prev.map((s) =>
                s.uuid === target.uuid
                  ? {
                      ...s,
                      status: mappedState,
                      stats: {
                        ...s.stats,
                        cpu: cpuPercent,
                        memory: memMB,
                        disk: diskMB > 0 ? diskMB : s.stats.disk,
                        uptime: uptimeSec,
                      },
                    }
                  : s
              )
            );

            setSelectedServerState((prev) => {
              if (!prev || prev.uuid !== target.uuid) return prev;
              return {
                ...prev,
                status: mappedState,
                stats: {
                  ...prev.stats,
                  cpu: cpuPercent,
                  memory: memMB,
                  disk: diskMB > 0 ? diskMB : prev.stats.disk,
                  uptime: uptimeSec,
                },
              };
            });
          }
        } catch {}
      }, 1500);
    } catch (err: any) {
      console.warn('[AppContext] Real backend power action error:', err?.message);
      addToast({
        title: 'Daemon Error',
        description: err?.message || 'Could not communicate with node daemon.',
        type: 'error',
      });
    }
  };

  const addTerminalCommand = async (command: string) => {
    if (!command.trim() || !selectedServer?.uuid) return;
    if (selectedServer.isSuspended || selectedServer.suspended) {
      addToast({
        title: 'Befehl gesperrt',
        description: 'Dieser Server ist administrativ suspendiert. Konsolenbefehle sind gesperrt.',
        type: 'error',
      });
      return;
    }
    const time = new Date().toLocaleTimeString();

    if (consoleSocketRef.current && consoleSocketRef.current.readyState === WebSocket.OPEN) {
      // Send directly over WebSocket. The hub automatically broadcasts "> command" once to all listeners!
      consoleSocketRef.current.send(
        JSON.stringify({ event: 'send command', args: [command.trim()] })
      );
    } else {
      // Fallback for when WebSocket is disconnected: add local echo and call HTTP API
      setTerminalLogs((prev) => [...prev, `\x1b[36m> ${command}\x1b[0m`]);
      try {
        await api.servers.command(selectedServer.uuid, command.trim());
      } catch (err: any) {
        setTerminalLogs((prev) => [
          ...prev,
          `[\x1b[31m${time} ERROR\x1b[0m] Command rejected: ${err?.message || 'Server stopped or daemon offline'}`,
        ]);
      }
    }
  };

  const clearTerminal = () => {
    setTerminalLogs([]);
  };

  const saveFileContent = async (path: string, newContent: string) => {
    if (selectedServer?.uuid) {
      try {
        await api.files.saveContent(selectedServer.uuid, path, newContent);
        setFiles((prev) => {
          const updated = prev.map((f) =>
            f.path === path ? { ...f, content: newContent, modified: 'Just now' } : f
          );
          if (selectedServer?.uuid) {
            saveFilesForServer(selectedServer.uuid, updated);
          }
          return updated;
        });
        addToast({
          title: 'File Saved',
          description: `Successfully saved ${newContent.length} bytes to ${path}`,
          type: 'success',
        });
      } catch (e: any) {
        console.error('Backend file save failed:', e);
        addToast({
          title: 'Save Failed',
          description: e?.message || `Could not save ${path} to disk.`,
          type: 'error',
        });
      }
    }
  };

  const createFile = async (file: FileItem) => {
    if (selectedServer?.uuid) {
      try {
        await api.files.saveContent(selectedServer.uuid, file.path, file.content || '');
        setFiles((prev) => {
          if (prev.some((f) => f.path === file.path)) {
            addToast({
              title: 'File Already Exists',
              description: `A file at "${file.path}" already exists.`,
              type: 'warning',
            });
            return prev;
          }
          const updated = [...prev, file];
          if (selectedServer?.uuid) {
            saveFilesForServer(selectedServer.uuid, updated);
          }
          addToast({
            title: 'File Created',
            description: `Created file ${file.name}`,
            type: 'success',
          });
          return updated;
        });
      } catch (e: any) {
        console.error('Backend create file failed:', e);
        addToast({
          title: 'Creation Failed',
          description: e?.message || `Could not create file ${file.name}.`,
          type: 'error',
        });
      }
    }
  };

  const createFolder = (path: string, name: string) => {
    if (selectedServer?.uuid) {
      const lastSlash = path.lastIndexOf('/');
      const root = lastSlash > 0 ? path.substring(0, lastSlash) : '/';
      api.files.createDirectory(selectedServer.uuid, name, root).catch((e) => {
        console.warn('Backend create folder failed:', e);
      });
    }
    setFiles((prev) => {
      if (prev.some((f) => f.path === path)) {
        addToast({
          title: 'Folder Already Exists',
          description: `Directory "${path}" already exists.`,
          type: 'warning',
        });
        return prev;
      }
      const newFolder: FileItem = {
        name,
        path,
        type: 'directory',
        size: 4096,
        modified: 'Just now',
        permissions: 'drwxr-xr-x',
      };
      const updated = [...prev, newFolder];
      if (selectedServer?.uuid) {
        saveFilesForServer(selectedServer.uuid, updated);
      }
      addToast({
        title: 'Folder Created',
        description: `Created directory ${name}/`,
        type: 'success',
      });
      return updated;
    });
  };

  const deleteFile = async (path: string): Promise<boolean> => {
    let success = false;
    const target = files.find((f) => f.path === path);
    const isDir = target?.type === 'directory';

    if (selectedServer?.uuid) {
      const normalized = path.replace(/\/+$/, '');
      const lastSlash = normalized.lastIndexOf('/');
      const root = lastSlash > 0 ? normalized.substring(0, lastSlash) : '/';
      const fileName = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;

      try {
        await api.files.delete(selectedServer.uuid, [fileName], root);
        success = true;
      } catch (e: any) {
        console.warn('Backend delete file failed:', e);
        addToast({
          title: 'Delete Failed',
          description: e?.message || `Failed to delete ${fileName} from disk.`,
          type: 'error',
        });
        return false;
      }
    } else {
      success = true;
    }

    setFiles((prev) => {
      const cleanPath = path.replace(/\/+$/, '');
      const updated = prev.filter((f) => {
        const itemClean = f.path.replace(/\/+$/, '');
        if (itemClean === cleanPath) return false;
        if (isDir && itemClean.startsWith(cleanPath + '/')) return false;
        return true;
      });
      if (selectedServer?.uuid) {
        saveFilesForServer(selectedServer.uuid, updated);
      }
      return updated;
    });

    addToast({
      title: isDir ? 'Folder Deleted' : 'File Deleted',
      description: `Removed "${target?.name || path}" permanently.`,
      type: 'warning',
    });

    return success;
  };

  const renameFile = (oldPath: string, newPath: string, newName: string) => {
    if (selectedServer?.uuid) {
      const lastSlash = oldPath.lastIndexOf('/');
      const root = lastSlash > 0 ? oldPath.substring(0, lastSlash) : '/';
      const fromName = lastSlash >= 0 ? oldPath.substring(lastSlash + 1) : oldPath;
      api.files.rename(selectedServer.uuid, fromName, newName, root).catch((e) => {
        console.warn('Backend rename file failed:', e);
      });
    }
    setFiles((prev) => {
      const target = prev.find((f) => f.path === oldPath);
      const isDir = target?.type === 'directory';
      const updated = prev.map((f) => {
        if (f.path === oldPath) {
          return { ...f, path: newPath, name: newName, modified: 'Just now' };
        }
        if (isDir && f.path.startsWith(oldPath + '/')) {
          const suffix = f.path.substring(oldPath.length);
          return { ...f, path: `${newPath}${suffix}` };
        }
        return f;
      });
      if (selectedServer?.uuid) {
        saveFilesForServer(selectedServer.uuid, updated);
      }
      addToast({
        title: 'Item Renamed',
        description: `Renamed to "${newName}".`,
        type: 'success',
      });
      return updated;
    });
  };

  const uploadFiles = (newFiles: FileItem[]) => {
    setFiles((prev) => {
      const pathsToUpload = new Set(newFiles.map((nf) => nf.path));
      const filtered = prev.filter((f) => !pathsToUpload.has(f.path));
      const updated = [...filtered, ...newFiles];
      if (selectedServer?.uuid) {
        saveFilesForServer(selectedServer.uuid, updated);
      }
      return updated;
    });
    addToast({
      title: 'Upload Complete',
      description: `Successfully uploaded ${newFiles.length} file(s).`,
      type: 'success',
    });
  };

  const uploadRawFiles = async (
    root: string,
    rawFiles: File[],
    onProgress?: (percent: number, loaded: number, total: number) => void
  ): Promise<boolean> => {
    if (!selectedServer?.uuid) return false;

    try {
      const res = await api.files.upload(selectedServer.uuid, root, rawFiles, onProgress);
      if (res?.success) {
        await loadDirectory(root);
        addToast({
          title: 'Upload Finished',
          description: `Uploaded ${res.uploaded?.length || rawFiles.length} file(s) directly to server storage.`,
          type: 'success',
        });
        return true;
      }
    } catch (e: any) {
      console.warn('Real file upload error:', e);
      addToast({
        title: 'Upload Error',
        description: e?.message || 'Could not stream files to server storage.',
        type: 'error',
      });
    }
    return false;
  };

  const installMinecraftVersion = async (version: string, jarFileName: string = 'server.jar') => {
    if (!selectedServer) return;
    const finalJarName = jarFileName || `paper-${version}.jar`;

    addToast({
      title: `Downloading Paper ${version}...`,
      description: `Fetching ${finalJarName} and setting up eula.txt...`,
      type: 'info',
    });

    setTerminalLogs((prev) => [
      ...prev,
      `[\x1b[36m${new Date().toLocaleTimeString()} INSTALLER\x1b[0m] Downloading PaperMC release for Minecraft ${version} -> ${finalJarName}...`,
    ]);

    try {
      await api.files.installVersion(selectedServer.uuid, version, finalJarName);
      const fresh = await api.files.list(selectedServer.uuid);
      if (fresh?.data) {
        setFiles(fresh.data);
        saveFilesForServer(selectedServer.uuid, fresh.data);
      }
    } catch (err: any) {
      console.warn('Backend version installer error, persisting locally:', err);
    }

    setFiles((prev) => {
      const withoutJar = prev.filter((f) => f.name !== finalJarName && f.name !== 'server.jar');
      const jarFile: FileItem = {
        name: finalJarName,
        path: `/${finalJarName}`,
        type: 'file',
        size: 54100200,
        modified: 'Just now',
        permissions: '-rwxr-xr-x',
        editable: false,
      };
      const eulaFile: FileItem = {
        name: 'eula.txt',
        path: '/eula.txt',
        type: 'file',
        size: 180,
        modified: 'Just now',
        permissions: '-rw-r--r--',
        editable: true,
        content: `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n`,
      };
      const hasEula = withoutJar.some((f) => f.path === '/eula.txt');
      const updated = [jarFile, ...(hasEula ? withoutJar : [eulaFile, ...withoutJar])];
      if (selectedServer?.uuid) {
        saveFilesForServer(selectedServer.uuid, updated);
      }
      return updated;
    });

    addToast({
      title: `Paper ${version} Ready!`,
      description: `Downloaded "${finalJarName}" & accepted eula.txt. Ready to start!`,
      type: 'success',
    });

    setTerminalLogs((prev) => [
      ...prev,
      `[\x1b[32m${new Date().toLocaleTimeString()} INSTALLER\x1b[0m] Downloaded PaperMC release for Minecraft ${version} -> ${finalJarName}`,
      `[\x1b[32m${new Date().toLocaleTimeString()} INSTALLER\x1b[0m] Written eula.txt=true`,
    ]);
  };

  const toggleSchedule = (scheduleId: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, isActive: !s.isActive } : s))
    );
    addToast({
      title: 'Schedule Updated',
      description: 'Schedule active status has been toggled.',
      type: 'info',
    });
  };

  const triggerScheduleNow = (scheduleId: string) => {
    const sch = schedules.find((s) => s.id === scheduleId);
    if (!sch) return;
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId ? { ...s, lastRun: 'Just now (Success)' } : s
      )
    );
    addToast({
      title: 'Schedule Dispatched',
      description: `Immediately queued run for "${sch.name}".`,
      type: 'success',
    });
  };

  const addSchedule = async (schedule: Omit<ScheduleTask, 'id' | 'lastRun'>) => {
    if (!selectedServer?.uuid) return;
    const serverUuid = selectedServer.uuid;
    const cronParts = schedule.cron.trim().split(/\s+/);
    const minute = cronParts[0] || '0';
    const hour = cronParts[1] || '4';
    const dom = cronParts[2] || '*';
    const month = cronParts[3] || '*';
    const dow = cronParts[4] || '*';

    try {
      const res = await api.schedules.create(serverUuid, {
        name: schedule.name,
        cron_minute: minute,
        cron_hour: hour,
        cron_day_of_month: dom,
        cron_month: month,
        cron_day_of_week: dow,
        is_active: schedule.isActive ?? true,
      });
      const created = mapBackendScheduleToFrontend(res.schedule);
      setSchedules((prev) => [...prev, created]);
      addToast({
        title: 'Schedule Created',
        description: `Task "${schedule.name}" is now active on backend.`,
        type: 'success',
      });
    } catch {
      const newSch: ScheduleTask = {
        ...schedule,
        id: `sch-${Date.now()}`,
        lastRun: 'Never',
      };
      setSchedules((prev) => [...prev, newSch]);
      addToast({
        title: 'Schedule Created',
        description: `Task "${schedule.name}" is now active.`,
        type: 'success',
      });
    }
  };

  const addDatabase = async (db: Omit<DatabaseInstance, 'id' | 'connections' | 'sizeMB'>) => {
    if (!selectedServer?.uuid) return;
    const serverUuid = selectedServer.uuid;
    try {
      const res = await api.databases.create(serverUuid, {
        database: db.database || db.name,
        remote: '%',
      });
      const created = mapBackendDatabaseToFrontend(res.database);
      if (res.relationships?.password) {
        created.password = res.relationships.password;
      }
      setDatabases((prev) => [...prev, created]);
      addToast({
        title: 'Database Provisioned',
        description: `Created database "${created.database}" on host ${created.host}.`,
        type: 'success',
      });
    } catch {
      const newDb: DatabaseInstance = {
        ...db,
        id: `db-${Date.now()}`,
        connections: 0,
        sizeMB: 1,
      };
      setDatabases((prev) => [...prev, newDb]);
      addToast({
        title: 'Database Provisioned',
        description: `Created database ${db.database} on host ${db.host}.`,
        type: 'success',
      });
    }
  };

  const deleteDatabase = async (id: string) => {
    if (!selectedServer?.uuid) return;
    const serverUuid = selectedServer.uuid;
    const target = databases.find((d) => d.id === id);
    try {
      await api.databases.delete(serverUuid, id);
    } catch {}

    setDatabases((prev) => prev.filter((d) => d.id !== id));
    addToast({
      title: 'Database Dropped',
      description: `Database ${target?.database || id} has been purged.`,
      type: 'warning',
    });
  };

  const addUser = async (user: Omit<SubUser, 'id' | 'addedAt'>) => {
    if (selectedServer?.uuid) {
      try {
        const res = await api.subusers.create(selectedServer.uuid, {
          email: user.email,
          username: user.username,
          role_name: user.role,
          permissions: user.permissions,
        });
        const createdId = res?.data?.id || res?.subuser?.id || Date.now();
        const newUser: SubUser = {
          ...user,
          id: String(createdId),
          addedAt: 'Just now',
        };
        setUsers((prev) => [...prev, newUser]);
        addToast({
          title: 'User Invited & Persisted',
          description: `Added ${user.username} with ${user.role} role to server on backend.`,
          type: 'success',
        });
        return;
      } catch (err: any) {
        console.warn('Subuser backend creation error:', err);
      }
    }
    const newUser: SubUser = {
      ...user,
      id: `usr-${Date.now()}`,
      addedAt: 'Just now',
    };
    setUsers((prev) => [...prev, newUser]);
    addToast({
      title: 'User Invited',
      description: `Added ${user.username} with ${user.role} role.`,
      type: 'success',
    });
  };

  const updateUser = async (
    id: string,
    userPatch: Partial<SubUser> & { path_rules?: any; command_rules?: any }
  ): Promise<boolean> => {
    if (selectedServer?.uuid) {
      try {
        await api.subusers.update(selectedServer.uuid, id, {
          role_name: userPatch.role,
          permissions: userPatch.permissions,
          path_rules: userPatch.path_rules,
          command_rules: userPatch.command_rules,
        });

        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, ...userPatch } : u))
        );

        addToast({
          title: 'Sub-User Updated',
          description: `Updated permissions and role for ${userPatch.username || 'subuser'}.`,
          type: 'success',
        });
        return true;
      } catch (err: any) {
        console.warn('Subuser backend update error:', err);
        addToast({
          title: 'Update Failed',
          description: err?.message || 'Could not update subuser permissions.',
          type: 'error',
        });
        return false;
      }
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...userPatch } : u))
    );
    return true;
  };

  const deleteUser = async (id: string) => {
    const target = users.find((u) => u.id === id);
    if (selectedServer?.uuid) {
      try {
        await api.subusers.delete(selectedServer.uuid, id);
      } catch (err: any) {
        console.warn('Subuser backend deletion error:', err);
      }
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    addToast({
      title: 'Access Revoked',
      description: `Removed sub-user ${target?.username || id}.`,
      type: 'warning',
    });
  };

  // -------------------------------------------------------------
  // Admin Actions (real backend mutations)
  // -------------------------------------------------------------
  const createNest = async (payload: {
    name: string;
    description?: string;
    slug?: string;
  }): Promise<boolean> => {
    try {
      await api.nests.create(payload);
      await refreshAdminData();
      addToast({
        title: 'Nest Created',
        description: `"${payload.name}" is now available for egg templates.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Nest Creation Failed',
        description: err?.message || 'The panel core rejected the request.',
        type: 'error',
      });
      return false;
    }
  };

  const deleteNest = async (id: string): Promise<boolean> => {
    const target = adminNests.find((n) => n.id === id);
    try {
      await api.nests.delete(id);
      await refreshAdminData();
      addToast({
        title: 'Nest Deleted',
        description: `Nest "${target?.name || id}" was removed.`,
        type: 'warning',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Cannot Delete Nest',
        description: err?.message || 'The nest could not be deleted.',
        type: 'error',
      });
      return false;
    }
  };

  const importEgg = async (payload: {
    json?: string;
    file?: File;
    nestId?: string;
  }): Promise<boolean> => {
    try {
      const res = await api.eggs.import({
        json: payload.json,
        file: payload.file,
        nestId: payload.nestId,
      });
      await refreshAdminData();
      addToast({
        title: res.updated ? 'Egg Updated' : 'Egg Imported',
        description: `"${res.egg?.name || 'Egg'}" was ${
          res.updated ? 'updated in place' : 'added to the template library'
        }.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Egg Import Failed',
        description: err?.message || 'The JSON payload was rejected by the panel core.',
        type: 'error',
      });
      return false;
    }
  };

  const deleteEgg = async (id: string): Promise<boolean> => {
    const target = adminEggs.find((e) => e.id === id);
    try {
      await api.eggs.delete(id);
      await refreshAdminData();
      addToast({
        title: 'Egg Deleted',
        description: `Template "${target?.name || id}" was removed.`,
        type: 'warning',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Cannot Delete Egg',
        description: err?.message || 'The egg could not be deleted.',
        type: 'error',
      });
      return false;
    }
  };

  const createAdminNode = async (payload: {
    name: string;
    fqdn: string;
    description?: string;
    memory: number;
    memory_overallocate?: number;
    disk: number;
    disk_overallocate?: number;
    daemon_listen?: number;
    daemon_sftp?: number;
  }): Promise<boolean> => {
    try {
      await api.nodes.create(payload as any);
      await refreshAdminData();
      addToast({
        title: 'Node Registered',
        description: `"${payload.name}" was created. Generate its Wings token next.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Node Creation Failed',
        description: err?.message || 'The panel core rejected the node definition.',
        type: 'error',
      });
      return false;
    }
  };

  const deleteAdminNode = async (id: string): Promise<boolean> => {
    const target = adminNodes.find((n) => n.id === id);
    try {
      await api.nodes.delete(id);
      await refreshAdminData();
      addToast({
        title: 'Node Removed',
        description: `Node "${target?.name || id}" was deregistered.`,
        type: 'warning',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Cannot Delete Node',
        description: err?.message || 'The node still has servers assigned.',
        type: 'error',
      });
      return false;
    }
  };

  const createAdminUser = async (payload: {
    username: string;
    email: string;
    password: string;
    root_admin?: boolean;
  }): Promise<boolean> => {
    try {
      await api.users.create(payload);
      await refreshAdminData();
      addToast({
        title: 'User Created',
        description: `${payload.username} can now sign in to the panel.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'User Creation Failed',
        description: err?.message || 'The panel core rejected the account.',
        type: 'error',
      });
      return false;
    }
  };

  const deleteAdminUser = async (id: string): Promise<boolean> => {
    const target = adminUsers.find((u) => u.id === id);
    try {
      await api.users.delete(id);
      await refreshAdminData();
      addToast({
        title: 'User Deleted',
        description: `Account "${target?.username || id}" was removed.`,
        type: 'warning',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'User Deletion Failed',
        description: err?.message || 'Could not delete user account.',
        type: 'error',
      });
      return false;
    }
  };

  const createEgg = async (payload: {
    nest_id: number;
    name: string;
    description?: string;
    docker_images?: Record<string, string>;
    startup_command?: string;
    config_stop?: string;
    script_install?: string;
    script_container?: string;
    script_entry?: string;
    variables?: any[];
  }): Promise<boolean> => {
    try {
      await api.eggs.create(payload);
      await refreshAdminData();
      addToast({
        title: 'Egg Created',
        description: `Template "${payload.name}" was created successfully.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Egg Creation Failed',
        description: err?.message || 'The panel core rejected the egg definition.',
        type: 'error',
      });
      return false;
    }
  };

  const updateEgg = async (id: string, payload: any): Promise<boolean> => {
    try {
      await api.eggs.update(id, payload);
      await refreshAdminData();
      addToast({
        title: 'Egg Updated',
        description: `Template configuration and deploy script saved.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Egg Update Failed',
        description: err?.message || 'Failed updating egg template.',
        type: 'error',
      });
      return false;
    }
  };

  const updateServerStartup = async (uuid: string, startup: string): Promise<boolean> => {
    try {
      const res = await api.servers.update(uuid, { startup });
      setSelectedServer((prev) => (!prev ? null : {
        ...prev,
        startup: res.server?.startup || startup,
      }));
      await refreshServers();
      addToast({
        title: 'Startup Command Saved',
        description: 'Server startup command and parameters updated.',
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Failed Saving Startup Command',
        description: err?.message || 'Server rejected startup update.',
        type: 'error',
      });
      return false;
    }
  };

  const refreshAdminDatabases = useCallback(async () => {
    try {
      const [hostsRes, dbsRes] = await Promise.allSettled([
        api.adminDatabases.listHosts(),
        api.adminDatabases.listDatabases(),
      ]);

      if (hostsRes.status === 'fulfilled' && hostsRes.value?.data) {
        setAdminDatabaseHosts(
          hostsRes.value.data.map((h: any) => ({
            id: String(h.id),
            name: h.name,
            host: h.host,
            port: h.port || 3306,
            username: h.username,
            nodeId: h.node_id,
            maxDatabases: h.max_databases,
            databaseCount: h.database_count || 0,
            createdAt: h.created_at,
          }))
        );
      }

      if (dbsRes.status === 'fulfilled' && dbsRes.value?.data) {
        setAdminGlobalDatabases(
          dbsRes.value.data.map((d: any) => ({
            id: String(d.id),
            serverId: d.server_id,
            databaseHostId: d.database_host_id,
            name: d.name || d.database,
            username: d.username,
            remote: d.remote || '%',
            maxConnections: d.max_connections || 0,
            createdAt: d.created_at,
            host: d.host,
          }))
        );
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh admin databases:', e);
    }
  }, []);

  const createDatabaseHost = async (payload: {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    node_id?: number;
    max_databases?: number;
  }): Promise<boolean> => {
    try {
      await api.adminDatabases.createHost(payload);
      await refreshAdminDatabases();
      addToast({
        title: 'Database Host Added',
        description: `Host "${payload.name}" (${payload.host}:${payload.port}) is now connected.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Failed Adding Host',
        description: err?.message || 'Database host registration failed.',
        type: 'error',
      });
      return false;
    }
  };

  const deleteDatabaseHost = async (id: string): Promise<boolean> => {
    try {
      await api.adminDatabases.deleteHost(id);
      await refreshAdminDatabases();
      addToast({
        title: 'Database Host Removed',
        description: `Host was successfully disconnected.`,
        type: 'warning',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Cannot Delete Host',
        description: err?.message || 'Cannot delete database host with active databases.',
        type: 'error',
      });
      return false;
    }
  };

  const createServer = async (payload: any): Promise<boolean> => {
    try {
      const res = await api.servers.create(payload);
      const createdUuid = res?.server?.uuid;
      await refreshServers();
      if (createdUuid) {
        setTerminalLogs([]);
        // Ensure newly created servers start with completely clean git deploy settings and empty history
        try {
          localStorage.removeItem(`pteronext_git_history_${createdUuid}`);
          localStorage.removeItem(`pteronext_git_secret_${createdUuid}`);
          localStorage.removeItem(`pteronext_git_branch_${createdUuid}`);
          localStorage.removeItem(`pteronext_git_autorestart_${createdUuid}`);
          localStorage.removeItem(`pteronext_git_installdeps_${createdUuid}`);
          localStorage.removeItem(`pteronext_git_runbuild_${createdUuid}`);
          localStorage.removeItem(`pteronext_git_buildcmd_${createdUuid}`);
          // Cleanup legacy un-scoped or corrupt keys
          localStorage.removeItem('pteronext_git_history');
          localStorage.removeItem('pteronext_git_history_');
          localStorage.removeItem('pteronext_git_history_undefined');
          localStorage.removeItem('pteronext_git_history_null');
        } catch {}
        localStorage.setItem('pteronext_selected_server', createdUuid);
        localStorage.setItem('pteronext_active_view', 'server-detail');
        setActiveViewState('server-detail');
        setActiveServerTabState('console');
        try {
          const fresh = await api.servers.list();
          const match = (fresh?.data || []).map(mapBackendServerToFrontend).find((s) => s.uuid === createdUuid);
          if (match) setSelectedServerState(match);
        } catch {}
      }
      addToast({
        title: 'Server Provisioned',
        description: `Server "${payload.name}" was successfully deployed.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Server Deployment Failed',
        description: err?.message || 'Could not deploy server container.',
        type: 'error',
      });
      return false;
    }
  };

  const updateAdminNode = async (id: string, updates: any): Promise<boolean> => {
    try {
      await api.nodes.update(id, updates);
      await refreshAdminData();
      addToast({
        title: 'Wings Node Updated',
        description: 'Node configuration was updated successfully.',
        type: 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Node Update Failed',
        description: err?.message || 'Could not update Wings node configuration.',
        type: 'error',
      });
      return false;
    }
  };

  const updateServerAdminSettings = async (
    serverId: string,
    updates: {
      name?: string;
      description?: string;
      owner?: string;
      ownerEmail?: string;
      memoryMB?: number;
      cpuLimit?: number;
      diskMB?: number;
      swapLimit?: number;
      ioLimit?: number;
      startup?: string;
      dockerImage?: string;
      databasesLimit?: number;
      backupsLimit?: number;
      allocationsLimit?: number;
      isSuspended?: boolean;
    }
  ): Promise<boolean> => {
    try {
      const target = servers.find((s) => s.id === serverId || s.uuid === serverId);
      const uuidToUse = target?.uuid || (serverId.includes('-') ? serverId : '');
      if (!uuidToUse) {
        throw new Error('Server not found in cluster state.');
      }

      const updatePayload: Record<string, any> = {};
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.memoryMB !== undefined) updatePayload.memory = updates.memoryMB;
      if (updates.cpuLimit !== undefined) updatePayload.cpu = updates.cpuLimit;
      if (updates.diskMB !== undefined) updatePayload.disk = updates.diskMB;
      if (updates.swapLimit !== undefined) updatePayload.swap = updates.swapLimit;
      if (updates.ioLimit !== undefined) updatePayload.io = updates.ioLimit;
      if (updates.startup !== undefined) updatePayload.startup = updates.startup;
      if (updates.dockerImage !== undefined) updatePayload.image = updates.dockerImage;
      if (updates.isSuspended !== undefined) updatePayload.suspended = updates.isSuspended;

      const res = await api.servers.update(uuidToUse, updatePayload);

      if (res?.server) {
        const fresh = mapBackendServerToFrontend(res.server);
        setServers((prev) =>
          prev.map((s) => (s.uuid === fresh.uuid || s.id === fresh.id ? fresh : s))
        );
        setSelectedServer((prev) => {
          if (!prev || (prev.uuid !== fresh.uuid && prev.id !== fresh.id)) return prev;
          return {
            ...fresh,
            stats: {
              ...fresh.stats,
              memory: prev.stats.memory,
              cpu: prev.stats.cpu,
              disk: prev.stats.disk > 0 ? prev.stats.disk : fresh.stats.disk,
              uptime: prev.stats.uptime,
            },
          };
        });
      } else {
        await refreshServers();
      }

      addToast({
        title: 'Server Settings Updated',
        description: `Configuration and limits for "${updates.name || target?.name || 'Server'}" persisted successfully.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      console.error('[AppContext] Server update failed:', err);
      addToast({
        title: 'Update Failed',
        description: err?.message || 'Could not update server settings on the backend.',
        type: 'error',
      });
      return false;
    }
  };

  const deleteServer = async (serverId: string, password?: string): Promise<boolean> => {
    try {
      const target = servers.find((s) => s.id === serverId || s.uuid === serverId);
      const targetUuid = target?.uuid || serverId;
      if (targetUuid) {
        try {
          await api.servers.delete(targetUuid, password);
        } catch (apiErr: any) {
          console.warn('Backend server delete failed:', apiErr);
          addToast({
            title: 'Delete Failed',
            description: apiErr?.message || 'Ungültiges Account-Passwort oder Löschfehler.',
            type: 'error',
          });
          return false;
        }
        try {
          localStorage.removeItem(`pteronext_files_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_history_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_secret_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_branch_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_autorestart_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_installdeps_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_runbuild_${targetUuid}`);
          localStorage.removeItem(`pteronext_git_buildcmd_${targetUuid}`);
          if (localStorage.getItem('pteronext_selected_server') === targetUuid) {
            localStorage.removeItem('pteronext_selected_server');
          }
        } catch {}
      }

      setTerminalLogs([]);
      setServers((prev) => {
        const remaining = prev.filter((s) => s.id !== serverId && s.uuid !== serverId && s.uuid !== targetUuid);
        if (selectedServer && (selectedServer.id === serverId || selectedServer.uuid === serverId || selectedServer.uuid === targetUuid)) {
          setSelectedServer(remaining.length > 0 ? remaining[0] : null);
        }
        return remaining;
      });
      setActiveView('servers');

      addToast({
        title: 'Server Deleted',
        description: `Server "${target?.name || serverId}" and its container were permanently deleted.`,
        type: 'info',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Server Delete Failed',
        description: err?.message || 'Could not delete server.',
        type: 'error',
      });
      return false;
    }
  };

  const toggleServerSuspension = async (serverId: string): Promise<boolean> => {
    const target = servers.find((s) => s.id === serverId || s.uuid === serverId);
    if (!target) return false;
    const nextState = !(target.isSuspended || target.suspended);
    const uuidToUse = target.uuid || serverId;

    try {
      await api.servers.update(uuidToUse, { suspended: nextState });

      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId || s.uuid === serverId
            ? { ...s, isSuspended: nextState, suspended: nextState, status: nextState ? 'stopped' : s.status }
            : s
        )
      );

      setSelectedServer((prev) => {
        if (!prev || (prev.id !== serverId && prev.uuid !== serverId)) return prev;
        return {
          ...prev,
          isSuspended: nextState,
          suspended: nextState,
          status: nextState ? 'stopped' : prev.status,
        };
      });

      addToast({
        title: nextState ? 'Server suspendiert' : 'Server entsperrt',
        description: nextState
          ? `Server "${target.name}" wurde administrativ gesperrt und gestoppt.`
          : `Server "${target.name}" ist wieder aktiv und entsperrt.`,
        type: nextState ? 'warning' : 'success',
      });
      return true;
    } catch (err: any) {
      addToast({
        title: 'Fehler beim Ändern des Server-Status',
        description: err?.message || 'Server-Suspension konnte nicht gespeichert werden.',
        type: 'error',
      });
      return false;
    }
  };

  const reinstallServer = async (serverId: string): Promise<boolean> => {
    const target = servers.find((s) => s.id === serverId || s.uuid === serverId);
    if (!target) return false;

    setServers((prev) =>
      prev.map((s) => (s.id === serverId || s.uuid === serverId ? { ...s, status: 'starting' } : s))
    );

    addToast({
      title: 'Reinstallation Initiated',
      description: `Container reinstallation script triggered for "${target.name}".`,
      type: 'info',
    });
    return true;
  };

  // -------------------------------------------------------------
  // Dashboard Notes (local persistence)
  // -------------------------------------------------------------
  useEffect(() => {
    try {
      localStorage.setItem('pteronext_notes', JSON.stringify(notes));
    } catch {
      /* storage full or unavailable */
    }
  }, [notes]);

  const addNote = (note: { title: string; body: string }) => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: note.title.trim() || 'Untitled note',
      body: note.body.trim(),
      pinned: false,
      createdAt: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
    addToast({
      title: 'Note Added',
      description: 'Your note was saved to the dashboard.',
      type: 'success',
    });
  };

  const updateNote = (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'pinned'>>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, title: patch.title?.trim() || n.title } : n))
    );
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    addToast({
      title: 'Note Deleted',
      description: 'The note was removed.',
      type: 'info',
    });
  };

  const togglePinNote = (id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  };

  // Live container metrics polling from Wings via REST
  useEffect(() => {
    if (!selectedServer?.uuid) return;

    let isPolling = true;
    const poll = async () => {
      try {
        const stats = await api.servers.resources(selectedServer.uuid);
        if (stats && isPolling) {
          const mappedState = (stats.current_state as ServerStatus) || 'offline';
          const cpuPercent = +((stats.cpu_absolute || 0)).toFixed(1);
          const memMB = Math.round((stats.memory_bytes || 0) / (1024 * 1024));
          const diskMB = Math.round((stats.disk_bytes || 0) / (1024 * 1024));
          const uptimeSec = Math.round((stats.uptime || 0) / 1000);

          setSelectedServerState((prev) => {
            if (!prev || prev.uuid !== selectedServer.uuid) return prev;
            return {
              ...prev,
              status: mappedState,
              stats: {
                ...prev.stats,
                cpu: cpuPercent,
                memory: memMB,
                disk: diskMB > 0 ? diskMB : prev.stats.disk,
                uptime: uptimeSec,
                networkRx: Math.round((stats.network_rx_bytes || 0) / 1024),
                networkTx: Math.round((stats.network_tx_bytes || 0) / 1024),
              },
            };
          });

          setServers((prev) =>
            prev.map((s) => {
              if (s.uuid === selectedServer.uuid) {
                return {
                  ...s,
                  status: mappedState,
                  stats: {
                    ...s.stats,
                    cpu: cpuPercent,
                    memory: memMB,
                    disk: diskMB > 0 ? diskMB : s.stats.disk,
                    uptime: uptimeSec,
                  },
                };
              }
              return s;
            })
          );
        }
      } catch {}
    };

    const interval = setInterval(poll, 4000);
    poll();
    return () => {
      isPolling = false;
      clearInterval(interval);
    };
  }, [selectedServer?.uuid]);

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isAuthChecking,
        login,
        logout,
        activeView,
        setActiveView,
        selectedServer,
        setSelectedServer,
        activeServerTab,
        setActiveServerTab,
        selectServerAndNavigate,
        previousGlobalView,
        navigateBackFromServer,
        isMobileDrawerOpen,
        setIsMobileDrawerOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebarCollapse,
        isAccountSettingsOpen,
        setIsAccountSettingsOpen,
        currentUser,
        setCurrentUser,
        currentServerPermissions,
        currentServerRole,
        canAccessServerTab,
        searchQuery,
        setSearchQuery,
        servers,
        clusterMetrics,
        nodes,
        activities,
        files,
        schedules,
        databases,
        users,
        terminalLogs,
        adminNodes,
        adminUsers,
        adminNests,
        adminEggs,
        adminLoading,
        refreshAdminData,
        createNest,
        deleteNest,
        importEgg,
        deleteEgg,
        createEgg,
        updateEgg,
        createAdminNode,
        deleteAdminNode,
        createAdminUser,
        deleteAdminUser,
        adminDatabaseHosts,
        adminGlobalDatabases,
        refreshAdminDatabases,
        createDatabaseHost,
        deleteDatabaseHost,
        accountSettingsTab,
        setAccountSettingsTab,
        openAccountSettings,
        updateServerStartup,
        colorTheme,
        globalColorTheme,
        setColorTheme,
        setGlobalColorTheme,
        resetPersonalTheme,
        backgroundEffect,
        setBackgroundEffect,
        customCss,
        setCustomCss,
        setGlobalCustomCss,
        language,
        setLanguage,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isCreateServerOpen,
        setIsCreateServerOpen,
        isImportModalOpen,
        setIsImportModalOpen,
        createServer,
        updateAdminNode,
        updateServerAdminSettings,
        deleteServer,
        toggleServerSuspension,
        reinstallServer,
        notes,
        addNote,
        updateNote,
        deleteNote,
        togglePinNote,
        handlePowerAction,
        addTerminalCommand,
        clearTerminal,
        saveFileContent,
        createFile,
        createFolder,
        deleteFile,
        renameFile,
        uploadFiles,
        uploadRawFiles,
        installMinecraftVersion,
        toggleSchedule,
        triggerScheduleNow,
        addSchedule,
        addDatabase,
        deleteDatabase,
        addUser,
        updateUser,
        deleteUser,
        refreshServers,
        refreshStats,
        refreshDatabases,
        loadDirectory,
        dnsRevocationAlert,
        setDnsRevocationAlert,
        dismissDnsRevocationAlert,
        systemVersion,
        setSystemVersion,
        checkSystemVersion,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
