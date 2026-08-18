import { Startup, Note, AuditLog, PipelineStatus, Admin, AdminInvite } from '../../shared/src/types';
import { authStore } from './authStore';

const API_BASE_URL = ((import.meta as any).env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await authStore.getValidAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

async function authFetchJson(path: string, options: RequestInit = {}): Promise<any> {
  const response = await authFetch(path, options);
  const parsed = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(parsed?.error || `Server error (${response.status})`);
  }
  return parsed;
}

export const apiClient = {
  isConfigured(): boolean {
    return !!API_BASE_URL;
  },

  async getCurrentUser(): Promise<{ id: string; email: string; isAdmin: boolean } | null> {
    if (!authStore.hasSession()) return null;
    try {
      const data = await authFetchJson('/api/auth/me');
      return { id: data.id, email: data.email, isAdmin: !!data.isAdmin };
    } catch {
      authStore.clearSession();
      return null;
    }
  },

  async signIn(email: string, password: string): Promise<{ success: boolean; user: any }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok || !parsed?.success) {
      throw new Error(parsed?.error || 'Authentication failed. Please check your credentials.');
    }
    authStore.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_at: parsed.expires_at,
    });
    return { success: true, user: parsed.user };
  },

  async signOut(): Promise<void> {
    const refresh_token = authStore.getRefreshToken();
    try {
      await authFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      });
    } catch {
      // Best-effort -- the local session is always cleared below regardless.
    } finally {
      authStore.clearSession();
    }
  },

  async getStartups(): Promise<Startup[]> {
    return authFetchJson('/api/startups');
  },

  async updateStartupStatus(id: string, status: PipelineStatus): Promise<boolean> {
    const data = await authFetchJson(`/api/startups/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return !!data?.success;
  },

  async assignStartupAdmin(id: string, adminId: string | null): Promise<boolean> {
    const data = await authFetchJson(`/api/startups/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ admin_id: adminId }),
    });
    return !!data?.success;
  },

  async deleteStartup(id: string): Promise<boolean> {
    const data = await authFetchJson(`/api/startups/${id}`, { method: 'DELETE' });
    return !!data?.success;
  },

  async deleteStartups(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    const data = await authFetchJson('/api/startups/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
    return { success: !!data?.success, deletedCount: data?.deletedCount ?? 0 };
  },

  async getNotes(startupId: string): Promise<Note[]> {
    return authFetchJson(`/api/startups/${startupId}/notes`);
  },

  async addNote(startupId: string, content: string): Promise<Note | null> {
    return authFetchJson(`/api/startups/${startupId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async deleteNote(noteId: string): Promise<boolean> {
    const data = await authFetchJson(`/api/notes/${noteId}`, { method: 'DELETE' });
    return !!data?.success;
  },

  async getSignedUrl(startupId: string, path: string): Promise<string> {
    if (!path || !path.trim()) return '';
    const data = await authFetchJson(`/api/startups/${startupId}/pitch-deck-url`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
    return data?.url || '';
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    return authFetchJson('/api/audit-logs');
  },

  async getAuditLogsForTarget(targetId: string): Promise<AuditLog[]> {
    return authFetchJson(`/api/audit-logs/target/${targetId}`);
  },

  async logCSVExport(details: { type: string; count: number }): Promise<void> {
    await authFetchJson('/api/audit-logs/csv-export', {
      method: 'POST',
      body: JSON.stringify(details),
    });
  },

  async getAdmins(): Promise<Admin[]> {
    return authFetchJson('/api/admins');
  },

  async deleteAdmin(id: string, email?: string): Promise<boolean> {
    const data = await authFetchJson(`/api/admins/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    });
    return !!data?.success;
  },

  async getAdminInvites(): Promise<AdminInvite[]> {
    return authFetchJson('/api/admin-invites');
  },

  async inviteAdmin(email: string): Promise<boolean> {
    const data = await authFetchJson('/api/admin-invites', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return !!data?.success;
  },

  async cancelAdminInvite(inviteId: string): Promise<boolean> {
    const data = await authFetchJson(`/api/admin-invites/${inviteId}/cancel`, { method: 'POST' });
    return !!data?.success;
  },

  async resendAdminInvite(inviteId: string): Promise<boolean> {
    const data = await authFetchJson(`/api/admin-invites/${inviteId}/resend`, { method: 'POST' });
    return !!data?.success;
  },

  // Sets the invitee's password via the backend's privileged proxy route -- called before
  // acceptAdminInvite() while the invite-link session (stored via authStore) is still active.
  // The password change invalidates that session server-side, so the backend hands back a
  // freshly signed-in one, which replaces it here before the caller proceeds.
  async setPassword(password: string): Promise<void> {
    const data = await authFetchJson('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (data?.access_token) {
      authStore.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      });
    }
  },

  async acceptAdminInvite(): Promise<boolean> {
    const data = await authFetchJson('/api/admin-invites/accept', { method: 'POST' });
    return !!data?.success;
  },
};
