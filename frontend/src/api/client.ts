/**
 * Centralized API Client for PteroNext Panel
 * Provides JWT token management, automatic Bearer authentication,
 * unified REST methods, and 401 unauthorized handling.
 */

const TOKEN_KEY = 'pteronext_jwt_token';
const API_BASE_URL = ''; // Relative path, routed through Vite proxy or same-origin

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// -------------------------------------------------------------
// Token Storage & Unauthorized Listeners
// -------------------------------------------------------------
type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

let lastUnauthorizedNotify = 0;

function notifyUnauthorized() {
  const now = Date.now();
  if (now - lastUnauthorizedNotify < 8000) {
    return;
  }
  lastUnauthorizedNotify = now;

  clearToken();
  unauthorizedHandlers.forEach((handler) => {
    try {
      handler();
    } catch (e) {
      console.error('Error in onUnauthorized handler:', e);
    }
  });
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('token', token);
  } catch (e) {
    console.error('Failed to save token to localStorage:', e);
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
  } catch (e) {
    console.error('Failed to remove token from localStorage:', e);
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// -------------------------------------------------------------
// Base Fetch Wrapper
// -------------------------------------------------------------
async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    let errorDetail = 'Unauthorized session';
    let errJson: any = null;
    try {
      errJson = await response.json();
      errorDetail = errJson?.error || errJson?.message || errorDetail;
    } catch {}

    // Do not notify session expiration when user is trying to log in
    if (!path.includes('/api/auth/login')) {
      notifyUnauthorized();
    }
    throw new ApiError(errorDetail, 401, errJson);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type') || '';
  let responseData: any = null;
  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      (typeof responseData === 'object' && responseData && (responseData.error || responseData.message)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, responseData);
  }

  return responseData as T;
}

// -------------------------------------------------------------
// API Resource Interfaces
// -------------------------------------------------------------
export interface AuthUser {
  id: number;
  uuid: string;
  username: string;
  email: string;
  name_first?: string;
  name_last?: string;
  root_admin: boolean;
  two_factor_enabled?: boolean;
  role_id?: number;
  role?: {
    id: number;
    name: string;
    description: string;
    permissions?: any[];
  };
}

export interface LoginResponse {
  token?: string;
  user?: AuthUser;
  two_factor_required?: boolean;
  error?: string;
}

export interface BackendServer {
  id: number;
  uuid: string;
  identifier: string;
  name: string;
  description: string;
  suspended: boolean;
  status: string | null;
  owner_id: number;
  owner?: AuthUser;
  node_id: number;
  node?: BackendNode;
  allocation_id: number;
  allocation?: BackendAllocation;
  memory: number;
  swap: number;
  disk: number;
  cpu: number;
  io: number;
  threads?: string;
  oom_disabled?: boolean;
  startup: string;
  image: string;
  skip_scripts?: boolean;
  installed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BackendAllocation {
  id: number;
  node_id: number;
  server_id?: number;
  ip: string;
  port: number;
  alias?: string;
  notes?: string;
}

export interface BackendNode {
  id: number;
  uuid: string;
  name: string;
  description: string;
  public: boolean;
  fqdn: string;
  scheme: string;
  behind_proxy: boolean;
  maintenance_mode: boolean;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemon_listen: number;
  daemon_sftp: number;
  daemon_base: string;
  daemon_token_id?: string;
  daemon_token?: string;
  allocations?: BackendAllocation[];
  servers?: BackendServer[];
}

export interface BackendDatabase {
  id: number;
  server_id: number;
  database_host_id: number;
  database: string;
  username: string;
  password?: string;
  remote: string;
  database_host?: {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
  };
}

export interface BackendSchedule {
  id: number;
  server_id: number;
  name: string;
  cron_minute: string;
  cron_hour: string;
  cron_day_of_month: string;
  cron_month: string;
  cron_day_of_week: string;
  is_active: boolean;
  is_processing?: boolean;
  last_run_at?: string;
  next_run_at?: string;
  tasks?: Array<{
    id: number;
    schedule_id: number;
    sequence_id: number;
    action: string;
    payload: string;
    time_offset: number;
    is_queued: boolean;
  }>;
}

export interface BackendEggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules: string;
  field_type?: string;
}

export interface BackendEgg {
  id: number;
  nest_id: number;
  nest?: BackendNest;
  name: string;
  description: string;
  docker_images: Record<string, string>;
  startup_command: string;
  config_files?: Record<string, any>;
  config_startup?: Record<string, any>;
  config_stop?: string;
  script_install?: string;
  script_container?: string;
  script_entry?: string;
  variables: BackendEggVariable[];
  created_at?: string;
  updated_at?: string;
}

export interface BackendNest {
  id: number;
  name: string;
  description: string;
  slug: string;
  eggs?: BackendEgg[];
  created_at?: string;
  updated_at?: string;
}

export interface SystemStatsResponse {
  uptime_seconds: number;
  uptime_human: string;
  go_version: string;
  num_cpu: number;
  num_goroutine: number;
  memory_alloc_mb: number;
  memory_sys_mb: number;
  host_memory_total_mb?: number;
  host_memory_used_mb?: number;
  host_memory_free_mb?: number;
  allocated_server_ram_mb?: number;
  total_node_ram_mb?: number;
  database_size_mb: number;
  counts: {
    servers: number;
    nodes: number;
    users: number;
    databases: number;
  };
}

export interface ServerResourcesResponse {
  current_state: string;
  is_suspended: boolean;
  memory_bytes: number;
  memory_limit_bytes: number;
  cpu_absolute: number;
  disk_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  uptime: number;
}

// -------------------------------------------------------------
// Centralized API Client Object
// -------------------------------------------------------------
export const api = {
  // Authentication & Session
  auth: {
    login: async (credentials: { user: string; password: string; code?: string }): Promise<LoginResponse> => {
      try {
        const data = await request<LoginResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });
        if (data.two_factor_required) {
          return {
            two_factor_required: true,
            error: data.error || (data as any).message,
          };
        }
        if (data.token) {
          setToken(data.token);
        }
        return data;
      } catch (err: any) {
        if (err?.data?.two_factor_required || (err instanceof ApiError && err.data?.two_factor_required)) {
          return {
            two_factor_required: true,
            error: err.message,
          };
        }
        throw err;
      }
    },

    register: async (payload: {
      username: string;
      email: string;
      password: string;
      name_first?: string;
      name_last?: string;
    }): Promise<LoginResponse> => {
      const data = await request<LoginResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.token) {
        setToken(data.token);
      }
      return data;
    },

    me: async (): Promise<{ user: AuthUser }> => {
      return request<{ user: AuthUser }>('/api/auth/me');
    },

    logout: () => {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    },

    getToken,
    setToken,
    clearToken,
    isAuthenticated,
  },

  // Servers
  servers: {
    list: async (): Promise<{ data: BackendServer[] }> => {
      return request<{ data: BackendServer[] }>('/api/servers');
    },

    get: async (uuid: string): Promise<{ server: BackendServer; resolved_startup: string }> => {
      return request<{ server: BackendServer; resolved_startup: string }>(`/api/servers/${uuid}`);
    },

    create: async (payload: {
      name: string;
      description?: string;
      node_id: number;
      allocation_id?: number;
      port?: number;
      memory: number;
      swap?: number;
      disk: number;
      cpu: number;
      io?: number;
      startup?: string;
      image?: string;
      egg?: string;
      environment?: Record<string, string>;
    }): Promise<{ server: BackendServer }> => {
      return request<{ server: BackendServer }>('/api/servers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    update: async (uuid: string, updates: Partial<BackendServer>): Promise<{ server: BackendServer }> => {
      return request<{ server: BackendServer }>(`/api/servers/${uuid}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    delete: async (uuid: string): Promise<void> => {
      return request<void>(`/api/servers/${uuid}`, {
        method: 'DELETE',
      });
    },

    power: async (
      uuid: string,
      action: 'start' | 'stop' | 'restart' | 'kill'
    ): Promise<{ action: string; status: string; state: string; server: string }> => {
      return request(`/api/servers/${uuid}/power`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
    },

    resources: async (uuid: string): Promise<ServerResourcesResponse> => {
      return request<ServerResourcesResponse>(`/api/servers/${uuid}/resources`);
    },

    command: async (uuid: string, command: string): Promise<{ status: string; command: string }> => {
      return request(`/api/servers/${uuid}/command`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    },

    clone: async (
      uuid: string,
      payload: { name: string; description?: string; start_on_completion?: boolean }
    ): Promise<{ message: string; server: any; cloned_from: string }> => {
      return request(`/api/servers/${uuid}/clone`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getCrashAnalysis: async (uuid: string): Promise<{
      crashed: boolean;
      category: string;
      title: string;
      title_en: string;
      description: string;
      description_en: string;
      detected_error: string;
      suggested_solution: string;
      solution_label: string;
      solution_label_en: string;
      fix_action: string;
      target_file?: string;
    }> => {
      return request(`/api/servers/${uuid}/crash-analysis`);
    },

    applyCrashFix: async (
      uuid: string,
      payload: { action: string; target_file?: string }
    ): Promise<{ message: string; action_executed: string; server_state?: string }> => {
      return request(`/api/servers/${uuid}/crash-fix`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getWebSocketUrl: (uuid: string): string => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const token = getToken() || '';
      return `${protocol}//${host}/api/servers/${uuid}/ws?token=${encodeURIComponent(token)}`;
    },
  },

  // Nodes
  nodes: {
    list: async (): Promise<{ data: BackendNode[] }> => {
      return request<{ data: BackendNode[] }>('/api/nodes');
    },

    get: async (id: number | string): Promise<{ node: BackendNode }> => {
      return request<{ node: BackendNode }>(`/api/nodes/${id}`);
    },

    create: async (nodeData: Partial<BackendNode>): Promise<{ node: BackendNode }> => {
      return request<{ node: BackendNode }>('/api/nodes', {
        method: 'POST',
        body: JSON.stringify(nodeData),
      });
    },

    update: async (id: number | string, updates: Partial<BackendNode>): Promise<{ node: BackendNode }> => {
      return request<{ node: BackendNode }>(`/api/nodes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    delete: async (id: number | string): Promise<void> => {
      return request<void>(`/api/nodes/${id}`, {
        method: 'DELETE',
      });
    },

    configuration: async (id: number | string): Promise<{
      node_id: number;
      uuid: string;
      token_id: string;
      token: string;
      yaml: string;
    }> => {
      return request(`/api/nodes/${id}/configuration`);
    },
  },

  // Databases (per server)
  databases: {
    list: async (serverUuid: string): Promise<{ data: BackendDatabase[] }> => {
      return request<{ data: BackendDatabase[] }>(`/api/servers/${serverUuid}/databases`);
    },

    create: async (
      serverUuid: string,
      payload: { database: string; remote?: string; database_host_id?: number }
    ): Promise<{ database: BackendDatabase; relationships?: { password?: string } }> => {
      return request(`/api/servers/${serverUuid}/databases`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    delete: async (serverUuid: string, databaseId: number | string): Promise<void> => {
      return request<void>(`/api/servers/${serverUuid}/databases/${databaseId}`, {
        method: 'DELETE',
      });
    },
  },

  // Schedules (per server)
  schedules: {
    list: async (serverUuid: string): Promise<{ data: BackendSchedule[] }> => {
      return request<{ data: BackendSchedule[] }>(`/api/servers/${serverUuid}/schedules`);
    },

    create: async (
      serverUuid: string,
      payload: {
        name: string;
        cron_minute: string;
        cron_hour: string;
        cron_day_of_month: string;
        cron_month: string;
        cron_day_of_week: string;
        is_active: boolean;
      }
    ): Promise<{ schedule: BackendSchedule }> => {
      return request(`/api/servers/${serverUuid}/schedules`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    delete: async (serverUuid: string, scheduleId: number | string): Promise<void> => {
      return request<void>(`/api/servers/${serverUuid}/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
    },
  },

  // Files (Server Filesystem Management with node persistence)
  files: {
    list: async (serverUuid: string, directory: string = '/'): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(
        `/api/servers/${serverUuid}/files/list?directory=${encodeURIComponent(directory)}`
      );
    },

    getContent: async (serverUuid: string, filePath: string): Promise<{ content: string }> => {
      return request<{ content: string }>(
        `/api/servers/${serverUuid}/files/contents?file=${encodeURIComponent(filePath)}`
      );
    },

    saveContent: async (serverUuid: string, filePath: string, content: string): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/api/servers/${serverUuid}/files/write`, {
        method: 'POST',
        body: JSON.stringify({ file: filePath, content }),
      });
    },

    upload: async (
      serverUuid: string,
      root: string,
      files: File[],
      onProgress?: (percent: number, loaded: number, total: number) => void
    ): Promise<{ success: boolean; uploaded: any[]; count: number }> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/servers/${serverUuid}/files/upload`);

        const token = getToken();
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const percent = Math.round((evt.loaded / evt.total) * 100);
              onProgress(percent, evt.loaded, evt.total);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              resolve(json);
            } catch {
              resolve({ success: true, uploaded: [], count: files.length });
            }
          } else {
            try {
              const errJson = JSON.parse(xhr.responseText);
              reject(new ApiError(errJson.error || `Upload failed with status ${xhr.status}`, xhr.status, errJson));
            } catch {
              reject(new ApiError(`Upload failed with status ${xhr.status}`, xhr.status));
            }
          }
        };

        xhr.onerror = () => {
          reject(new ApiError('Network connection error during file upload.', 0));
        };

        const formData = new FormData();
        formData.append('root', root);
        files.forEach((file) => formData.append('files', file));
        xhr.send(formData);
      });
    },

    downloadRemote: async (
      serverUuid: string,
      url: string,
      directory: string = '/plugins',
      filename?: string
    ): Promise<{ success: boolean; file?: any }> => {
      return request<{ success: boolean; file?: any }>(
        `/api/servers/${serverUuid}/files/download-remote`,
        {
          method: 'POST',
          body: JSON.stringify({ url, directory, filename }),
        }
      );
    },

    delete: async (serverUuid: string, files: string[], root: string = '/'): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/api/servers/${serverUuid}/files/delete`, {
        method: 'POST',
        body: JSON.stringify({ root, files }),
      });
    },

    createDirectory: async (serverUuid: string, name: string, root: string = '/'): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/api/servers/${serverUuid}/files/create-directory`, {
        method: 'POST',
        body: JSON.stringify({ root, name }),
      });
    },

    rename: async (serverUuid: string, from: string, to: string, root: string = '/'): Promise<{ success: boolean }> => {
      return request<{ success: boolean }>(`/api/servers/${serverUuid}/files/rename`, {
        method: 'PUT',
        body: JSON.stringify({ root, from, to }),
      });
    },

    compress: async (
      serverUuid: string,
      files: string[],
      root: string = '/',
      name?: string
    ): Promise<{ success: boolean; file: any; message: string }> => {
      return request<{ success: boolean; file: any; message: string }>(
        `/api/servers/${serverUuid}/files/compress`,
        {
          method: 'POST',
          body: JSON.stringify({ root, files, name }),
        }
      );
    },

    decompress: async (
      serverUuid: string,
      file: string,
      root: string = '/'
    ): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>(
        `/api/servers/${serverUuid}/files/decompress`,
        {
          method: 'POST',
          body: JSON.stringify({ root, file }),
        }
      );
    },

    installVersion: async (
      serverUuid: string,
      version: string,
      jarFile: string = 'server.jar'
    ): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>(
        `/api/servers/${serverUuid}/files/install-version`,
        {
          method: 'POST',
          body: JSON.stringify({ version, jar_file: jarFile }),
        }
      );
    },

    listRevisions: async (
      serverUuid: string,
      filePath: string
    ): Promise<{ revisions: any[] }> => {
      return request<{ revisions: any[] }>(
        `/api/servers/${serverUuid}/files/revisions?path=${encodeURIComponent(filePath)}`
      );
    },

    getRevision: async (
      serverUuid: string,
      revisionId: number
    ): Promise<{ revision: any }> => {
      return request<{ revision: any }>(
        `/api/servers/${serverUuid}/files/revisions/${revisionId}`
      );
    },

    restoreRevision: async (
      serverUuid: string,
      revisionId: number
    ): Promise<{ message: string; file_path: string; restored_revision: number }> => {
      return request<{ message: string; file_path: string; restored_revision: number }>(
        `/api/servers/${serverUuid}/files/revisions/${revisionId}/restore`,
        {
          method: 'POST',
        }
      );
    },
  },

  // Backups (Fast tar.gz, AES-256 encrypted, granular file restore)
  backups: {
    list: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/backups`);
    },

    create: async (
      serverUuid: string,
      payload: {
        name: string;
        is_locked?: boolean;
        encrypt_password?: string;
        ignored_files?: string[];
      }
    ): Promise<{ data: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/backups`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    delete: async (serverUuid: string, backupId: string): Promise<{ success: boolean }> => {
      return request(`/api/servers/${serverUuid}/backups/${backupId}`, {
        method: 'DELETE',
      });
    },

    toggleLock: async (serverUuid: string, backupId: string): Promise<{ data: any }> => {
      return request(`/api/servers/${serverUuid}/backups/${backupId}/lock`, {
        method: 'POST',
      });
    },

    restore: async (
      serverUuid: string,
      backupId: string,
      payload: { truncate?: boolean; encrypt_password?: string } = {}
    ): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/backups/${backupId}/restore`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    restoreFile: async (
      serverUuid: string,
      backupId: string,
      payload: { path: string; encrypt_password?: string }
    ): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/backups/${backupId}/restore-file`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getContents: async (
      serverUuid: string,
      backupId: string,
      password?: string
    ): Promise<{ files: string[] }> => {
      const q = password ? `?password=${encodeURIComponent(password)}` : '';
      return request<{ files: string[] }>(`/api/servers/${serverUuid}/backups/${backupId}/contents${q}`);
    },

    getDownloadUrl: (serverUuid: string, backupId: string): string => {
      return `/api/servers/${serverUuid}/backups/${backupId}/download`;
    },
  },

  // Webhooks (Discord & Slack Event Automation)
  webhooks: {
    list: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/webhooks`);
    },

    create: async (
      serverUuid: string,
      payload: {
        name: string;
        url: string;
        platform?: string;
        events?: string[];
      }
    ): Promise<{ data: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/webhooks`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    delete: async (serverUuid: string, webhookId: number | string): Promise<{ success: boolean }> => {
      return request(`/api/servers/${serverUuid}/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
    },

    test: async (serverUuid: string, webhookId: number | string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/webhooks/${webhookId}/test`, {
        method: 'POST',
      });
    },
  },

  // System & Telemetry Stats
  stats: {
    getSystemStats: async (): Promise<SystemStatsResponse> => {
      return request<SystemStatsResponse>('/api/system/stats');
    },

    getServerResources: async (serverUuid: string): Promise<ServerResourcesResponse> => {
      return request<ServerResourcesResponse>(`/api/servers/${serverUuid}/resources`);
    },
  },

  // Users Management
  users: {
    list: async (serverUuid?: string): Promise<{ data: any[] }> => {
      if (serverUuid) {
        try {
          return await request<{ data: any[] }>(`/api/servers/${serverUuid}/users`);
        } catch {
          return { data: [] };
        }
      }
      return request<{ data: any[] }>('/api/admin/users');
    },

    get: async (id: number | string): Promise<{ user: any }> => {
      // The panel core does not expose a single-user read endpoint;
      // list() is the canonical source for admin user data.
      const list = await request<{ data: any[] }>('/api/admin/users');
      const user = (list.data || []).find((u: any) => String(u.id) === String(id));
      if (!user) throw new ApiError('User not found', 404);
      return { user };
    },

    create: async (userData: any): Promise<{ user: any }> => {
      return request<{ user: any }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
    },

    update: async (id: number | string, updates: any): Promise<{ user: any }> => {
      return request<{ user: any }>(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    delete: async (id: number | string): Promise<void> => {
      return request<void>(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Nests (template groups)
  nests: {
    list: async (): Promise<{ data: BackendNest[] }> => {
      return request<{ data: BackendNest[] }>('/api/nests');
    },

    get: async (id: number | string): Promise<{ nest: BackendNest }> => {
      return request<{ nest: BackendNest }>(`/api/nests/${id}`);
    },

    create: async (payload: {
      name: string;
      description?: string;
      slug?: string;
    }): Promise<{ nest: BackendNest }> => {
      return request<{ nest: BackendNest }>('/api/nests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    update: async (
      id: number | string,
      payload: Partial<{ name: string; description: string; slug: string }>
    ): Promise<{ nest: BackendNest }> => {
      return request<{ nest: BackendNest }>(`/api/nests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    delete: async (id: number | string): Promise<void> => {
      return request<void>(`/api/nests/${id}`, { method: 'DELETE' });
    },
  },

  // Eggs (server templates)
  eggs: {
    list: async (nestId?: number | string): Promise<{ data: BackendEgg[] }> => {
      const url = nestId ? `/api/nests/${nestId}/eggs` : '/api/eggs';
      return request<{ data: BackendEgg[] }>(url);
    },

    get: async (eggId: number | string): Promise<{ egg: BackendEgg }> => {
      return request<{ egg: BackendEgg }>(`/api/eggs/${eggId}`);
    },

    /**
     * Imports a raw Pterodactyl egg export (PTDL_v1 / PTDL_v2 JSON).
     * Accepts either the JSON string or a File object plus target nest id.
     */
    import: async (
      payload: { json?: string; file?: File; nestId?: number | string }
    ): Promise<{ egg: BackendEgg; updated: boolean }> => {
      if (payload.file) {
        const form = new FormData();
        form.append('file', payload.file);
        if (payload.nestId) form.append('nest_id', String(payload.nestId));
        return request<{ egg: BackendEgg; updated: boolean }>('/api/eggs/import', {
          method: 'POST',
          body: form,
        });
      }
      const query = payload.nestId ? `?nest_id=${encodeURIComponent(String(payload.nestId))}` : '';
      return request<{ egg: BackendEgg; updated: boolean }>(`/api/eggs/import${query}`, {
        method: 'POST',
        body: payload.json || '',
      });
    },

    create: async (payload: {
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
    }): Promise<{ data: BackendEgg; egg: BackendEgg }> => {
      return request('/api/eggs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    update: async (
      eggId: number | string,
      payload: Partial<{
        name: string;
        description: string;
        nest_id: number;
        docker_images: Record<string, string>;
        startup_command: string;
        config_stop: string;
        script_install: string;
        script_container: string;
        script_entry: string;
        variables: any[];
      }>
    ): Promise<{ egg: BackendEgg }> => {
      return request<{ egg: BackendEgg }>(`/api/eggs/${eggId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    delete: async (eggId: number | string): Promise<void> => {
      return request<void>(`/api/eggs/${eggId}`, { method: 'DELETE' });
    },
  },

  // Admin Database Hosts & Global Databases
  adminDatabases: {
    listHosts: async (): Promise<{ data: any[]; hosts: any[] }> => {
      return request('/api/admin/databases/hosts');
    },

    createHost: async (payload: {
      name: string;
      host: string;
      port: number;
      username: string;
      password?: string;
      node_id?: number;
      max_databases?: number;
    }): Promise<{ data: any; host: any }> => {
      return request('/api/admin/databases/hosts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    deleteHost: async (id: number | string): Promise<void> => {
      return request<void>(`/api/admin/databases/hosts/${id}`, {
        method: 'DELETE',
      });
    },

    listDatabases: async (): Promise<{ data: any[]; databases: any[] }> => {
      return request('/api/admin/databases');
    },
  },

  // System Setup & Status
  system: {
    getSetupStatus: async (): Promise<{
      setup_completed: boolean;
      user_count: number;
      node_count: number;
      server_count: number;
      app_version: string;
      mode: string;
    }> => {
      return request('/api/system/setup-status');
    },

    completeSetup: async (payload: any): Promise<{
      message: string;
      token: string;
      user: any;
    }> => {
      return request('/api/system/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // Account Settings & 2FA
  account: {
    get: async (): Promise<{ user: any }> => {
      return request<{ user: any }>('/api/account');
    },

    updateProfile: async (data: {
      username?: string;
      email?: string;
      name_first?: string;
      name_last?: string;
      avatar_url?: string;
    }): Promise<{ message: string; user: any }> => {
      return request<{ message: string; user: any }>('/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    updatePassword: async (payload: {
      current_password: string;
      new_password: string;
    }): Promise<{ message: string }> => {
      return request<{ message: string }>('/api/account/password', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },

    setup2FA: async (): Promise<{
      secret: string;
      key_uri: string;
      qr_code_data_url: string;
    }> => {
      return request('/api/account/2fa/setup', {
        method: 'POST',
      });
    },

    enable2FA: async (payload: {
      secret: string;
      code: string;
    }): Promise<{ message: string; backup_codes: string[] }> => {
      return request('/api/account/2fa/enable', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    disable2FA: async (password: string): Promise<{ message: string }> => {
      return request('/api/account/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },

    activity: async (): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>('/api/account/activity');
    },
  },

  // Account API Keys
  apiKeys: {
    list: async (): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>('/api/account/api-keys');
    },

    create: async (payload: {
      description: string;
      memo?: string;
      allowed_ips?: string;
      permissions?: string[];
      expires_in_days?: number;
    }): Promise<{ api_key: any; secret: string }> => {
      return request('/api/account/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          memo: payload.memo || payload.description,
        }),
      });
    },

    delete: async (id: number | string): Promise<void> => {
      return request<void>(`/api/account/api-keys/${id}`, {
        method: 'DELETE',
      });
    },
  },

  // Audit Logs
  audit: {
    list: async (): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>('/api/audit-logs');
    },
  },

  // Player & Community Dashboard
  players: {
    list: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/players`);
    },
    kick: async (serverUuid: string, payload: { player: string; reason?: string }): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/kick`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    ban: async (serverUuid: string, payload: { player: string; reason?: string }): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/ban`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    unban: async (serverUuid: string, player: string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/unban`, {
        method: 'POST',
        body: JSON.stringify({ player }),
      });
    },
    toggleOp: async (serverUuid: string, payload: { player: string; op: boolean }): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/op`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    toggleWhitelist: async (serverUuid: string, payload: { player: string; add: boolean }): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/whitelist`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    teleport: async (serverUuid: string, payload: { player: string; destination: string }): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/teleport`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    sendChat: async (serverUuid: string, message: string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/chat`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },
    getBans: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/players/bans`);
    },
    unbanIP: async (serverUuid: string, ip: string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/players/unban-ip`, {
        method: 'POST',
        body: JSON.stringify({ ip }),
      });
    },
  },

  // Port & Network Manager
  network: {
    get: async (serverUuid: string): Promise<{ primary_allocation_id: number; allocations: any[]; available_pool: any[] }> => {
      return request(`/api/servers/${serverUuid}/network`);
    },
    assign: async (serverUuid: string, allocationId?: number): Promise<{ data: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/network/assign`, {
        method: 'POST',
        body: JSON.stringify({ allocation_id: allocationId || 0 }),
      });
    },
    setPrimary: async (serverUuid: string, allocationId: number): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/network/set-primary`, {
        method: 'POST',
        body: JSON.stringify({ allocation_id: allocationId }),
      });
    },
    updateNotes: async (serverUuid: string, allocationId: number, payload: { notes?: string; alias?: string }): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/network/${allocationId}/notes`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    delete: async (serverUuid: string, allocationId: number): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/network/${allocationId}`, {
        method: 'DELETE',
      });
    },
    preflight: async (serverUuid: string): Promise<{
      all_clear: boolean;
      preflight_status: string;
      results: Array<{ port: number; ip: string; is_primary: boolean; status: string; in_use_by?: string; suggested_port?: number }>;
      summary: string;
    }> => {
      return request(`/api/servers/${serverUuid}/network/preflight`);
    },
    autoRemap: async (serverUuid: string, payload: { conflicting_port: number; service_type?: string }): Promise<{
      success: boolean;
      original_port: number;
      remapped_port: number;
      message: string;
    }> => {
      return request(`/api/servers/${serverUuid}/network/auto-remap`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // Sidecars (Redis, Postgres, SQLite) & Web-DB-Viewer
  sidecars: {
    list: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/sidecars`);
    },
    create: async (serverUuid: string, payload: { name: string; type: string; memory_mb?: number }): Promise<{ data: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/sidecars`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    delete: async (serverUuid: string, id: number | string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/sidecars/${id}`, {
        method: 'DELETE',
      });
    },
    inject: async (serverUuid: string, id: number | string, targetPlugin: string): Promise<{ success: boolean; message: string; file: string }> => {
      return request(`/api/servers/${serverUuid}/sidecars/${id}/inject`, {
        method: 'POST',
        body: JSON.stringify({ target_plugin: targetPlugin }),
      });
    },
    getTables: async (serverUuid: string, file?: string): Promise<{ available_databases: string[]; selected_file: string; tables: string[] }> => {
      const q = file ? `?file=${encodeURIComponent(file)}` : '';
      return request(`/api/servers/${serverUuid}/sidecars/tables${q}`);
    },
    query: async (serverUuid: string, payload: { file: string; table: string; limit?: number }): Promise<{ table: string; columns: string[]; rows: any[]; count: number }> => {
      return request(`/api/servers/${serverUuid}/sidecars/query`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // Security Scanner & Malicious Bytecode Detection
  security: {
    scanJar: async (serverUuid: string, file: string): Promise<{ data: any }> => {
      return request(`/api/servers/${serverUuid}/security/scan-jar`, {
        method: 'POST',
        body: JSON.stringify({ file }),
      });
    },
    getSummary: async (serverUuid: string): Promise<{ jar_count: number; jar_files: string[] }> => {
      return request(`/api/servers/${serverUuid}/security/summary`);
    },
  },

  // Incident Freeze Mode & Multi-User Presence
  incident: {
    getStatus: async (serverUuid: string): Promise<{ is_frozen: boolean; freeze_reason: string }> => {
      return request(`/api/servers/${serverUuid}/incident/status`);
    },
    toggleFreeze: async (serverUuid: string, payload: { freeze: boolean; reason?: string }): Promise<{ is_frozen: boolean; freeze_reason: string; message: string }> => {
      return request(`/api/servers/${serverUuid}/incident/freeze`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    getPresence: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/presence`);
    },
    postPresence: async (serverUuid: string, activity?: string): Promise<{ status: string }> => {
      return request(`/api/servers/${serverUuid}/presence`, {
        method: 'POST',
        body: JSON.stringify({ activity }),
      });
    },
  },

  // Server-scoped Audit Feed
  serverAudit: {
    list: async (serverUuid: string): Promise<{ data: any[] }> => {
      return request<{ data: any[] }>(`/api/servers/${serverUuid}/audit`);
    },
  },

  // System Changelog
  changelog: {
    get: async (lang?: string): Promise<{ current_version: string; releases: any[] }> => {
      const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
      return request(`/api/system/changelog${query}`);
    },
  },

  // GitHub Auto-Updates & 1-Click Install
  updates: {
    check: async (): Promise<{
      update_available: boolean;
      current_version: string;
      latest_version: string;
      commit_sha?: string;
      commit_message?: string;
      commit_date?: string;
      commit_author?: string;
      repo_url?: string;
      checked_at?: string;
    }> => {
      return request('/api/system/updates/check');
    },

    install: async (): Promise<{ success: boolean; message: string; version: string }> => {
      return request('/api/system/updates/install', { method: 'POST' });
    },
  },

  // Discord OAuth2 & Bot Integrations
  discord: {
    getConfig: async (): Promise<{
      enabled: boolean;
      client_id: string;
      client_secret: string;
      bot_token: string;
      guild_id: string;
      redirect_uri: string;
      bot_active: boolean;
    }> => {
      return request('/api/admin/integrations/discord');
    },

    saveConfig: async (payload: {
      enabled: boolean;
      client_id: string;
      client_secret: string;
      bot_token: string;
      guild_id: string;
      redirect_uri: string;
    }): Promise<{ message: string; enabled: boolean }> => {
      return request('/api/admin/integrations/discord', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getStatus: async (): Promise<{ enabled: boolean; client_id: string }> => {
      return request('/api/auth/discord/status');
    },

    requestCode: async (
      discord_tag: string,
      language?: string
    ): Promise<{
      success: boolean;
      message: string;
      discord_id: string;
      discord_username: string;
      expires_in_seconds: number;
    }> => {
      return request('/api/account/discord/request-code', {
        method: 'POST',
        body: JSON.stringify({ discord_tag, language }),
      });
    },

    confirmCode: async (
      code: string
    ): Promise<{
      success: boolean;
      message: string;
      discord_id: string;
      discord_username: string;
    }> => {
      return request('/api/account/discord/confirm-code', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },

    link: async (discord_id: string, discord_username: string): Promise<{ message: string }> => {
      return request('/api/account/discord/link', {
        method: 'POST',
        body: JSON.stringify({ discord_id, discord_username }),
      });
    },

    unlink: async (): Promise<{ message: string }> => {
      return request('/api/account/discord/unlink', {
        method: 'POST',
      });
    },
  },

  // Server Resource Auto-Scaler / Sleep Mode
  sleepMode: {
    get: async (serverUuid: string): Promise<{
      sleep_mode_enabled: boolean;
      sleep_timeout_minutes: number;
      is_sleeping: boolean;
    }> => {
      return request(`/api/servers/${serverUuid}/sleep-mode`);
    },

    update: async (
      serverUuid: string,
      payload: { sleep_mode_enabled: boolean; sleep_timeout_minutes: number }
    ): Promise<{ message: string; sleep_mode_enabled: boolean; sleep_timeout_minutes: number; is_sleeping: boolean }> => {
      return request(`/api/servers/${serverUuid}/sleep-mode`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // Zero-Config Cloudflare DNS- & SRV-Automation
  dns: {
    list: async (serverUuid: string): Promise<{ domains: any[]; cloudflare_configured: boolean; default_domain: string }> => {
      return request(`/api/servers/${serverUuid}/dns`);
    },

    create: async (
      serverUuid: string,
      payload: { hostname: string; base_domain?: string }
    ): Promise<{ message: string; domain: any }> => {
      return request(`/api/servers/${serverUuid}/dns`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    delete: async (serverUuid: string, domainId: number): Promise<{ message: string }> => {
      return request(`/api/servers/${serverUuid}/dns/${domainId}`, {
        method: 'DELETE',
      });
    },

    getCloudflareConfig: async (): Promise<{
      enabled: boolean;
      api_token: string;
      zone_id: string;
      base_domain: string;
      is_active: boolean;
    }> => {
      return request('/api/admin/integrations/cloudflare');
    },

    saveCloudflareConfig: async (payload: {
      enabled: boolean;
      api_token: string;
      zone_id: string;
      base_domain: string;
    }): Promise<{ message: string }> => {
      return request('/api/admin/integrations/cloudflare', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // MSPT-/TPS-Heatmap, Entity- & Tile-Radar, Automatischer Lag-Dump
  diagnostics: {
    getTpsHeatmap: async (serverUuid: string): Promise<{
      current_tps: number;
      current_mspt: number;
      current_health: string;
      data: Array<{ timestamp: number; tps: number; mspt: number; health: string }>;
    }> => {
      return request(`/api/servers/${serverUuid}/diagnostics/tps-heatmap`);
    },
    getRadar: async (serverUuid: string): Promise<{
      summary: any;
      hotspots: Array<{
        id: string;
        world: string;
        chunk_x: number;
        chunk_z: number;
        block_x: number;
        block_z: number;
        count: number;
        type: string;
        severity: string;
        description: string;
        suspect_type: string;
      }>;
    }> => {
      return request(`/api/servers/${serverUuid}/diagnostics/radar`);
    },
    getLagDumps: async (serverUuid: string): Promise<{
      daemon_active: boolean;
      threshold_tps: number;
      threshold_secs: number;
      dumps: any[];
    }> => {
      return request(`/api/servers/${serverUuid}/diagnostics/lag-dumps`);
    },
    triggerLagDump: async (serverUuid: string): Promise<{ success: boolean; message: string; dump: any }> => {
      return request(`/api/servers/${serverUuid}/diagnostics/lag-dumps/trigger`, {
        method: 'POST',
      });
    },
  },

  // Smart Webhook-Trigger & Event-Chains (No-Code Automation)
  automation: {
    listTriggers: async (serverUuid: string): Promise<{ triggers: any[] }> => {
      return request(`/api/servers/${serverUuid}/automation/triggers`);
    },
    createTrigger: async (serverUuid: string, payload: any): Promise<{ success: boolean; trigger: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/automation/triggers`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    updateTrigger: async (serverUuid: string, id: string, payload: any): Promise<{ success: boolean; trigger: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/automation/triggers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    deleteTrigger: async (serverUuid: string, id: string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/automation/triggers/${id}`, {
        method: 'DELETE',
      });
    },
    testTrigger: async (serverUuid: string, id: string): Promise<{ success: boolean; message: string; trigger: any }> => {
      return request(`/api/servers/${serverUuid}/automation/triggers/${id}/test`, {
        method: 'POST',
      });
    },
  },

  // Multi-Node Live-Migration (Streaming ohne Ausfallzeit)
  migration: {
    getStatus: async (serverUuid: string): Promise<{ migration: any }> => {
      return request(`/api/servers/${serverUuid}/migration/status`);
    },
    start: async (serverUuid: string, targetNodeId: number): Promise<{ success: boolean; message: string; migration: any }> => {
      return request(`/api/servers/${serverUuid}/migration/start`, {
        method: 'POST',
        body: JSON.stringify({ target_node_id: targetNodeId }),
      });
    },
    cancel: async (serverUuid: string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/migration/cancel`, {
        method: 'POST',
      });
    },
  },

  // Integrierter Reverse-Proxy & Web-SSL Manager (Caddy/Traefik)
  reverseProxy: {
    list: async (serverUuid: string): Promise<{ proxies: any[]; presets: any[]; caddy_engine: any }> => {
      return request(`/api/servers/${serverUuid}/reverse-proxy`);
    },
    create: async (serverUuid: string, payload: { domain: string; internal_port: number; plugin_name?: string }): Promise<{ success: boolean; proxy: any; message: string }> => {
      return request(`/api/servers/${serverUuid}/reverse-proxy`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    delete: async (serverUuid: string, id: string): Promise<{ success: boolean; message: string }> => {
      return request(`/api/servers/${serverUuid}/reverse-proxy/${id}`, {
        method: 'DELETE',
      });
    },
  },
};

export default api;
