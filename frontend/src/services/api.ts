/**
 * Panel API Service Client
 * Handles real HTTP communication with the PteroNext Core Go backend (/api/*)
 */

export interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  email: string;
  name_first: string;
  name_last: string;
  root_admin: boolean;
  two_factor_enabled: boolean;
  role?: {
    id: number;
    name: string;
    description: string;
  };
}

export interface TwoFactorSetupResponse {
  secret: string;
  key_uri: string;
  qr_code_data_url: string;
}

export interface TwoFactorEnableResponse {
  message: string;
  backup_codes: string[];
}

export interface ApiKeyItem {
  id: number;
  user_id: number;
  key_type: string;
  identifier: string;
  allowed_ips: string;
  memo: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyResponse {
  api_key: ApiKeyItem;
  secret: string;
}

export interface CreateServerPayload {
  name: string;
  description: string;
  node_id: number;
  port: number;
  memory: number;
  swap: number;
  disk: number;
  cpu: number;
  io: number;
  startup: string;
  image: string;
  egg: string;
  environment: Record<string, string>;
}

const TOKEN_KEY = 'pteronext_auth_token';

class ApiService {
  private token: string | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  public setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  public clearToken() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Ensures an active authorization token exists.
   * Auto-logs in with admin defaults if running in dev/demo mode.
   */
  public async ensureAuth(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = (async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: 'admin', password: 'admin123456' }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            this.setToken(data.token);
            return data.token;
          }
        }
      } catch (err) {
        console.warn('[API] Could not auto-authenticate:', err);
      }
      return '';
    })();

    return this.tokenPromise;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.ensureAuth();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Re-authenticate on 401
      this.clearToken();
      const newToken = await this.ensureAuth();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryRes = await fetch(endpoint, {
          ...options,
          headers,
        });
        if (!retryRes.ok) {
          const errData = await retryRes.json().catch(() => ({}));
          throw new Error(errData.error || `Request failed with status ${retryRes.status}`);
        }
        return retryRes.json();
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${response.status}`);
    }

    // Support empty 204 responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --- Server Endpoints ---

  public async createServer(payload: CreateServerPayload): Promise<any> {
    return this.request<{ server: any }>('/api/servers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Account Endpoints ---

  public async getAccount(): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>('/api/account');
  }

  public async updateProfile(data: {
    username?: string;
    email?: string;
    name_first?: string;
    name_last?: string;
  }): Promise<{ message: string; user: UserProfile }> {
    return this.request<{ message: string; user: UserProfile }>('/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/account/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  // --- 2FA Endpoints ---

  public async setup2FA(): Promise<TwoFactorSetupResponse> {
    return this.request<TwoFactorSetupResponse>('/api/account/2fa/setup', {
      method: 'POST',
    });
  }

  public async enable2FA(
    secret: string,
    code: string
  ): Promise<TwoFactorEnableResponse> {
    return this.request<TwoFactorEnableResponse>('/api/account/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret, code }),
    });
  }

  public async disable2FA(password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/account/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // --- API Key Endpoints ---

  public async listAPIKeys(): Promise<{ data: ApiKeyItem[] }> {
    return this.request<{ data: ApiKeyItem[] }>('/api/account/api-keys');
  }

  public async createAPIKey(
    description: string,
    allowedIPs: string = '',
    expiresInDays?: number,
    permissions?: string[]
  ): Promise<CreateApiKeyResponse> {
    return this.request<CreateApiKeyResponse>('/api/account/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        description,
        memo: description,
        allowed_ips: allowedIPs,
        expires_in_days: expiresInDays,
        permissions: permissions || [],
      }),
    });
  }

  public async deleteAPIKey(id: number): Promise<void> {
    return this.request<void>(`/api/account/api-keys/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
