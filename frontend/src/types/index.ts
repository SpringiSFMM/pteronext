export type ServerStatus = 'running' | 'starting' | 'stopping' | 'stopped' | 'offline' | 'suspended' | 'installing';

export type PowerAction = 'start' | 'restart' | 'stop' | 'kill';

export type ActiveView = 
  | 'dashboard' 
  | 'servers' 
  | 'server-detail' 
  | 'schedules' 
  | 'databases' 
  | 'activity' 
  | 'changelog'
  | 'admin'
  | 'admin-dashboard' 
  | 'admin-servers'
  | 'admin-nodes' 
  | 'admin-users' 
  | 'admin-eggs'
  | 'admin-databases'
  | 'setup';

export interface ServerStats {
  cpu: number; // percentage (0-100+)
  memory: number; // MB
  memoryLimit: number; // MB
  disk: number; // MB
  diskLimit: number; // MB
  networkRx: number; // KB/s
  networkTx: number; // KB/s
  uptime: number; // seconds
}

export interface Server {
  id: string;
  uuid: string;
  identifier?: string;
  name: string;
  description: string;
  node: string;
  nodeLocation: string;
  allocation: string;
  egg: string;
  category: 'Gaming' | 'Database' | 'Applications' | 'Infrastructure';
  status: ServerStatus;
  stats: ServerStats;
  cpuLimit?: number;
  isFavorite?: boolean;
  isSuspended?: boolean;
  suspended?: boolean;
  databasesLimit?: number;
  backupsLimit?: number;
  allocationsLimit?: number;
  swapLimit?: number;
  ioLimit?: number;
  tags: string[];
  dockerImage: string;
  startup?: string;
  owner?: string;
  ownerEmail?: string;
  sftpDetails: {
    host: string;
    port: number;
    user: string;
  };
}

export interface ClusterMetrics {
  totalServers: number;
  runningServers: number;
  activeNodes: number;
  totalNodes: number;
  cpuUsedPercent: number;
  cpuCores: number;
  ramUsedGB: number;
  ramTotalGB: number;
  diskUsedGB: number;
  diskTotalGB: number;
  networkThroughput: string;
}

export interface NodeInfo {
  id: string;
  name: string;
  location: string;
  flag: string;
  ip: string;
  status: 'healthy' | 'warning' | 'offline';
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  activeServers: number;
  latencyMs: number;
}

export interface AdminNode extends NodeInfo {
  uuid: string;
  fqdn: string;
  daemonPort: number;
  sftpPort: number;
  ramAllocatedMB: number;
  ramTotalMB: number;
  diskAllocatedMB: number;
  diskTotalMB: number;
  totalAllocations: number;
  wingsVersion: string;
  kernel: string;
  enrollToken: string;
  sslEnabled: boolean;
  memoryOverallocate?: number;
  diskOverallocate?: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  rootAdmin: boolean;
  twoFactor: boolean;
  lastLogin: string;
  createdAt: string;
  serversCount: number;
}

export interface EggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
  field_type?: string;
}

export interface AdminEgg {
  id: string;
  nestId: string;
  name: string;
  author: string;
  description: string;
  dockerImages: Record<string, string>;
  startup: string;
  variables: EggVariable[];
  scriptInstall?: string;
  scriptContainer?: string;
  scriptEntry?: string;
  features?: string[];
  config?: {
    files?: string;
    startup?: string;
    logs?: string;
    stop?: string;
  };
  version?: string;
  createdAt: string;
}

export interface AdminNest {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  eggsCount: number;
}

export interface AdminDatabaseHost {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  nodeId?: number;
  maxDatabases?: number;
  databaseCount: number;
  createdAt?: string;
}

export interface AdminDatabaseItem {
  id: string;
  serverId: number;
  databaseHostId: number;
  name: string;
  username: string;
  remote: string;
  maxConnections: number;
  createdAt?: string;
  host?: {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
  };
}

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
}

export type AdminTab = 'overview' | 'nodes' | 'servers' | 'users' | 'nests';

export interface ActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
  editable?: boolean;
  content?: string;
  is_locked?: boolean;
  isLocked?: boolean;
}

export interface ScheduleTask {
  id: string;
  name: string;
  cron: string;
  description: string;
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
  actions: string[];
}

export interface DatabaseInstance {
  id: string;
  name: string;
  database: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  connections: number;
  sizeMB: number;
}

export interface SubUser {
  id: string;
  email: string;
  username: string;
  avatar: string;
  role: 'Admin' | 'Operator' | 'Observer' | 'Moderator' | 'Builder' | 'Support' | 'Custom' | string;
  permissions: string[];
  twoFactor: boolean;
  addedAt: string;
}

export type ServerDetailTab = 
  | 'console' 
  | 'files' 
  | 'players'
  | 'network'
  | 'sidecars'
  | 'security'
  | 'backups'
  | 'schedules' 
  | 'databases' 
  | 'users' 
  | 'audit'
  | 'game-config'
  | 'plugin-store'
  | 'webhooks'
  | 'diagnostics'
  | 'settings';

export type ColorTheme =
  | 'zinc'
  | 'violet'
  | 'emerald'
  | 'orange'
  | 'amber'
  | 'cyberpunk'
  | 'midnight'
  | 'crimson'
  | 'sakura'
  | 'aurora'
  | 'matrix';

export type BackgroundEffect = 'ambient' | 'matrix' | 'oled' | 'clean';

export interface BackgroundEffectOption {
  id: BackgroundEffect;
  name: string;
  description: string;
  badge: string;
}

export const BACKGROUND_EFFECTS: BackgroundEffectOption[] = [
  {
    id: 'ambient',
    name: 'Dynamic Ambient Glow',
    description: 'Smooth floating colored mesh clouds aligned with your theme',
    badge: 'Fluid Light',
  },
  {
    id: 'matrix',
    name: 'Cyber Mesh Grid',
    description: 'Drifting high-tech perspective grid with subtle neon dot accents',
    badge: 'Cyberpunk',
  },
  {
    id: 'oled',
    name: 'Pure OLED Pitch Black',
    description: 'True #000000 minimalist dark mode for pure contrast and OLED screens',
    badge: 'Battery Saver',
  },
  {
    id: 'clean',
    name: 'Classic Neutral Dark',
    description: 'Subtle static dark canvas without moving animations',
    badge: 'Minimalist',
  },
];

export interface ColorThemeOption {
  id: ColorTheme;
  name: string;
  description: string;
  accent: string;
  badge: string;
}

export const COLOR_THEMES: ColorThemeOption[] = [
  {
    id: 'zinc',
    name: 'Obsidian Zinc',
    description: 'Clean monochrome Linear aesthetic with silver accents',
    accent: '#f4f4f5',
    badge: 'Linear Classic',
  },
  {
    id: 'violet',
    name: 'Raycast Violet',
    description: 'Deep royal purple with soft radiant glow',
    accent: '#8b5cf6',
    badge: 'Vercel / Raycast',
  },
  {
    id: 'emerald',
    name: 'Midnight Emerald',
    description: 'Cyber matrix dark with vibrant emerald highlights',
    accent: '#10b981',
    badge: 'Cyber Matrix',
  },
  {
    id: 'orange',
    name: 'Solar Orange',
    description: 'Vibrant energetic ember glow with refined contrast',
    accent: '#f97316',
    badge: 'Solar Ember',
  },
  {
    id: 'amber',
    name: 'Cyber Amber',
    description: 'Warm bronze and luminous industrial amber glow',
    accent: '#f59e0b',
    badge: 'Industrial Warm',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'High-voltage electric cyan with neon magenta accents',
    accent: '#06b6d4',
    badge: 'Neon Dual-Glow',
  },
  {
    id: 'midnight',
    name: 'Deep Midnight Sapphire',
    description: 'Deep oceanic blue with ultra-clean sapphire luminescence',
    accent: '#3b82f6',
    badge: 'Deep Ocean',
  },
  {
    id: 'crimson',
    name: 'Blood Crimson',
    description: 'Bold high-contrast ruby red with fiery dark embers',
    accent: '#f43f5e',
    badge: 'Dark Ruby',
  },
  {
    id: 'sakura',
    name: 'Sakura Blossom',
    description: 'Soft pastel pink with luminous rose-gold highlights',
    accent: '#f472b6',
    badge: 'Pastel Glow',
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'Northern lights mystic teal and cosmic indigo hue',
    accent: '#14b8a6',
    badge: 'Mystic Teal',
  },
  {
    id: 'matrix',
    name: 'Matrix Phosphor',
    description: 'Retro mainframe phosphor green with glowing terminal CRT vibes',
    accent: '#22c55e',
    badge: 'Terminal CRT',
  },
];

