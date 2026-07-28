import { createClient } from '@supabase/supabase-js';
import { ApplicationFormData, Startup, Note, AuditLog, PipelineStatus, Admin, AdminInvite } from '../types';
import { cleanUrl } from './securityUtils';

const rawSupabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();

// Clean up Supabase URL: remove trailing slash, ensure protocol prefix, and strip api path suffixes
export const cleanSupabaseUrl = (() => {
  let url = rawSupabaseUrl;
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  // Strip common incorrect suffixes like /rest/v1, /rest, /auth/v1, /storage/v1, /v1
  url = url.replace(/\/(rest|auth|storage)\/v1\/?$/i, '');
  url = url.replace(/\/rest\/?$/i, '');
  url = url.replace(/\/auth\/?$/i, '');
  url = url.replace(/\/storage\/?$/i, '');
  url = url.replace(/\/v1\/?$/i, '');
  
  // Remove trailing slashes again just in case
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
})();

export const cleanSupabaseAnonKey = rawSupabaseAnonKey;

// Detect if Supabase is properly configured
export const isSupabaseConfigured =
  !!cleanSupabaseUrl &&
  cleanSupabaseUrl !== 'https://your-project-id.supabase.co' &&
  cleanSupabaseUrl !== 'your-project-id.supabase.co' &&
  !!cleanSupabaseAnonKey &&
  cleanSupabaseAnonKey !== 'your-anon-key';

const supabaseUrl = cleanSupabaseUrl;
const supabaseAnonKey = cleanSupabaseAnonKey;

// Lazy initialize the Supabase client to avoid crashes if keys are invalid
let supabase: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!supabase && isSupabaseConfigured) {
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
    }
  }
  return supabase;
}

export interface DbService {
  isConfigured(): boolean;
  
  // Auth Operations
  getCurrentUser(): Promise<{ id: string; email: string; isAdmin: boolean } | null>;
  signIn(email: string, password: string): Promise<{ success: boolean; user: any; error?: string }>;
  signOut(): Promise<void>;
  
  // Startup Operations
  submitApplication(data: ApplicationFormData, turnstileToken: string): Promise<{ success: boolean; id: string; error?: string }>;
  getStartups(): Promise<Startup[]>;
  updateStartupStatus(id: string, status: PipelineStatus, user: { id: string; email: string }): Promise<boolean>;
  deleteStartup(id: string, user: { id: string; email: string }): Promise<boolean>;
  
  // Notes Operations
  getNotes(startupId: string): Promise<Note[]>;
  addNote(startupId: string, content: string, user: { id: string; email: string }): Promise<Note | null>;
  deleteNote(noteId: string, user: { id: string; email: string }): Promise<boolean>;
  
  // Storage & Pitch Deck Operations
  getSignedUrl(path: string): Promise<string>;
  
  // Audit Logs Operations
  getAuditLogs(): Promise<AuditLog[]>;
  getAuditLogsForTarget(targetId: string): Promise<AuditLog[]>;
  
  // CSV Export Operations
  logCSVExport(user: { id: string; email: string }, details: { type: string; count: number }): Promise<void>;

  // Admin Management Operations
  getAdmins(): Promise<Admin[]>;
  deleteAdmin(id: string, email?: string, user?: { id: string; email: string }): Promise<boolean>;

  // Admin Invitation Operations
  getAdminInvites(): Promise<AdminInvite[]>;
  inviteAdmin(email: string): Promise<boolean>;
  cancelAdminInvite(inviteId: string): Promise<boolean>;
  resendAdminInvite(inviteId: string): Promise<boolean>;
  acceptAdminInvite(newPassword: string): Promise<boolean>;
}

/**
 * -------------------------------------------------------------
 * REAL SUPABASE SERVICE IMPLEMENTATION
 * -------------------------------------------------------------
 */
class SupabaseServiceImpl implements DbService {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  }

  // Shared audit-log writer used by every action below. Supabase-js does NOT throw on
  // a DB-level failure (RLS denial, constraint violation) -- it resolves with
  // `{ error: {...} }` -- so a bare `await ...insert(...)` with no destructuring (the
  // previous pattern here) silently loses the audit trail entry with no trace at all,
  // not even a console warning. This checks the resolved error explicitly (in addition
  // to catching genuine thrown exceptions like network failures) and always logs a
  // warning on failure, while still never throwing itself -- an audit-log hiccup must
  // never block the primary action (status change, note, delete) it's describing.
  private async logAuditEvent(entry: {
    user_id: string;
    user_email: string;
    action: string;
    target_id: string;
    target_name: string;
    details?: any;
  }): Promise<void> {
    const client: any = getSupabase();
    if (!client) return;
    try {
      const { error } = await client.from('audit_logs').insert(entry);
      if (error) {
        console.warn(`Failed to write audit log for action "${entry.action}":`, error);
      }
    } catch (e) {
      console.warn(`Failed to write audit log for action "${entry.action}":`, e);
    }
  }

  async getCurrentUser() {
    const client: any = getSupabase();
    if (!client) return null;

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return null;

    // Fetch the admin record to authorize
    const { data: adminRecord, error: adminError } = await client
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email || '',
      isAdmin: !adminError && !!adminRecord
    };
  }

  async signIn(email: string, password: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Check if they are admin
    const { data: adminRecord } = await client
      .from('admins')
      .select('id')
      .eq('id', data.user?.id)
      .maybeSingle();

    return {
      success: true,
      user: {
        id: data.user?.id || '',
        email: data.user?.email || '',
        isAdmin: !!adminRecord
      }
    };
  }

  async signOut() {
    const client: any = getSupabase();
    if (client) {
      await client.auth.signOut();
    }
  }

  async submitApplication(data: ApplicationFormData, turnstileToken: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    // Verify the CAPTCHA token with the server BEFORE touching storage/DB. The Turnstile
    // widget only proves a token was issued client-side; it must be validated against
    // Cloudflare's siteverify API to actually block scripted/bot submissions, since the
    // startups table's INSERT policy otherwise allows anyone with the public anon key in.
    if (!turnstileToken) {
      throw new Error('Please complete the security verification (CAPTCHA) before submitting.');
    }
    try {
      const verifyRes = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken })
      });
      const verifyData = await verifyRes.json().catch(() => ({ success: false }));
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Security verification failed. Please refresh and try again.');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Security verification') || err.message.includes('CAPTCHA'))) {
        throw err;
      }
      throw new Error('Could not complete security verification. Please check your connection and try again.');
    }

    // Check for duplicate company name submissions (case-insensitive)
    try {
      const { data: existingStartup, error: checkError } = await client
        .from('startups')
        .select('id')
        .ilike('company_name', data.company_name.trim())
        .maybeSingle();

      if (checkError) {
        console.warn('Duplicate verification skipped due to database error:', checkError);
      } else if (existingStartup) {
        throw new Error(`A startup application with the company name "${data.company_name}" has already been submitted to our pipeline.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('already been submitted')) {
        throw err;
      }
      console.warn('Duplicate verification query issue, continuing with insert:', err);
    }

    // Format URLs securely to satisfy DB CHECK constraints and prevent XSS
    const websiteClean = cleanUrl(data.website);
    const linkedinClean = cleanUrl(data.founder_linkedin);
    const demoClean = cleanUrl(data.demo_video);

    // Generate the row's id client-side and never ask Postgres to hand the row back
    // (no `.select()` after `.insert()`). Requesting the inserted row back requires the
    // SELECT policy to also pass -- and the only SELECT policy on `startups` is
    // admin-only ("Admin select startups" USING is_admin()) -- so an anonymous founder's
    // insert previously succeeded but the RETURNING read-back failed, and Postgres reports
    // the whole statement as an RLS violation. Opening SELECT to the public isn't an
    // option either, since that would let anyone read every other founder's application.
    const newId = crypto.randomUUID();

    const startupPayload = {
      id: newId,
      company_name: data.company_name.trim(),
      website: websiteClean,
      one_line_pitch: data.one_line_pitch.trim(),
      description: data.description.trim(),
      hq_location: data.hq_location.trim(),
      sector: data.sector,
      founder_name: data.founder_name.trim(),
      founder_email: data.founder_email.trim(),
      founder_linkedin: linkedinClean,
      team_size: Number(data.team_size),
      team_background: data.team_background.trim(),
      stage: data.stage,
      funding_raised: Number(data.funding_raised || 0),
      target_raise: Number(data.target_raise),
      traction: data.traction.trim(),
      pitch_deck_path: '',
      demo_video: demoClean || null,
      status: 'New',
      currency: data.currency || 'INR',
      revenue_status: data.revenue_status || 'Pre-Revenue',
      revenue_generated_fy25: data.revenue_generated_fy25 ? Number(data.revenue_generated_fy25) : null,
      current_financial_year_revenue: data.current_financial_year_revenue ? Number(data.current_financial_year_revenue) : null
    };

    const { error: dbError } = await client
      .from('startups')
      .insert(startupPayload);

    if (dbError) {
      console.error('Secure database insert failed:', dbError);
      if (dbError.message && (dbError.message.includes('already been submitted') || dbError.message.includes('duplicate'))) {
        throw new Error(dbError.message);
      }
      throw new Error('Your application could not be submitted. Please check the fields and try again.');
    }

    // Write Audit Log
    // Submissions (both anonymous guest and authenticated admin) are automatically logged securely
    // inside the database via the 'tr_log_startup_submission' AFTER INSERT database trigger.
    // This avoids duplicate audit logs when the user is authenticated.

    return { success: true, id: newId };
  }

  async getStartups() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('startups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as Startup[];
  }

  async updateStartupStatus(id: string, status: PipelineStatus, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return false;

    // Fetch the previous status first for auditing
    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name, status')
      .eq('id', id)
      .single();

    const oldStatus = currentStartup?.status || 'Unknown';

    const { error } = await client
      .from('startups')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }

    await this.logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: 'Status changed',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { old_status: oldStatus, new_status: status }
    });

    return true;
  }

  async deleteStartup(id: string, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return false;

    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name')
      .eq('id', id)
      .single();

    const { error } = await client
      .from('startups')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    await this.logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: 'Delete',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: `Startup '${currentStartup?.company_name}' deleted by admin.` }
    });

    return true;
  }

  async getNotes(startupId: string) {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('notes')
      .select('*')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as Note[];
  }

  async addNote(startupId: string, content: string, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return null;

    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name')
      .eq('id', startupId)
      .single();

    const { data, error } = await client
      .from('notes')
      .insert({
        startup_id: startupId,
        author_id: user.id,
        author_email: user.email,
        content
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    await this.logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: startupId,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: 'Added reviewer note.' }
    });

    return data as Note;
  }

  async deleteNote(noteId: string, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return false;

    // Fetch note to identify startup_id
    const { data: currentNote } = await client
      .from('notes')
      .select('startup_id')
      .eq('id', noteId)
      .single();

    if (!currentNote) return false;

    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name')
      .eq('id', currentNote.startup_id)
      .single();

    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      throw error;
    }

    await this.logAuditEvent({
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: currentNote.startup_id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: 'Deleted reviewer note.' }
    });

    return true;
  }

  async getSignedUrl(path: string) {
    if (!path || !path.trim()) {
      return '';
    }
    const client: any = getSupabase();
    if (!client) return '';

    // Sanitize the storage path: remove double/multiple slashes and remove leading slash
    let cleanPath = path.trim().replace(/\/+/g, '/');
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }

    // Guard against empty path or generic bucket directory names that can trigger invalid path API errors
    if (!cleanPath || cleanPath === 'pitch-decks' || cleanPath === 'pitch-decks/') {
      return '';
    }

    const { data, error } = await client.storage
      .from('pitch-decks')
      .createSignedUrl(cleanPath, 3600); // 1 hour expiration

    if (error) {
      throw error;
    }

    return data.signedUrl || '';
  }

  async getAuditLogs() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    return (data || []) as AuditLog[];
  }

  async getAuditLogsForTarget(targetId: string) {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return (data || []) as AuditLog[];
  }

  async logCSVExport(user: { id: string; email: string }, details: { type: string; count: number }) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    const { error } = await client.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'CSV Export Generated',
      target_id: '00000000-0000-0000-0000-000000000000',
      target_name: 'Startups Export',
      details: {
        message: `Exported ${details.count} startups (${details.type}).`,
        export_type: details.type,
        record_count: details.count,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      console.error('Failed to insert audit log for CSV Export:', error);
      throw new Error(`Failed to insert audit log for CSV Export: ${error.message}`);
    }
  }

  async getAdmins() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('admins')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Admin[];
  }

  async deleteAdmin(id: string, email?: string, user?: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    // Request the deleted row(s) back. If RLS blocks the delete (e.g. the
    // "Admins delete access" policy from 03_security_fixes.sql denies it, or
    // that migration hasn't been applied yet), Supabase returns success with
    // an empty array rather than an error -- so we must check the row count
    // ourselves instead of assuming success whenever `error` is falsy.
    const { data, error } = await client
      .from('admins')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(
        'Admin was not removed. This is either not permitted (you cannot revoke your own access or remove the last remaining admin) or the required database policy is missing — see supabase/migrations/03_security_fixes.sql.'
      );
    }

    // Log the revocation if user details are provided. The admin row is already gone
    // at this point (delete above succeeded), so a failure here must never surface as
    // "revoke failed" in the UI when the revoke actually succeeded -- logAuditEvent
    // checks both the resolved error and thrown exceptions, and never throws itself.
    if (user && email) {
      await this.logAuditEvent({
        user_id: user.id,
        user_email: user.email,
        action: 'Administrator Revoked',
        target_id: id,
        target_name: email,
        details: { message: `Administrator privilege revoked for ${email}.`, email }
      });
    }

    return true;
  }

  // Shared helper for the privileged /api/crm-service/* admin-invite routes: attaches the
  // caller's current session as a Bearer token, POSTs the body, and normalizes error/success
  // parsing (this logic was previously duplicated per-action; now shared across 4 actions).
  private async postAdminAction(path: string, body: Record<string, any>): Promise<boolean> {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    const { data: { session } } = await client.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('You must be signed in as an administrator to perform this action.');
    }

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.warn('[Client DB Service] Failed to parse response as JSON:', parseErr);
    }

    if (!response.ok) {
      const errMsg = parsed?.error || `Server error (${response.status}): ${text.substring(0, 150)}`;
      throw new Error(errMsg);
    }

    return !!parsed?.success;
  }

  async getAdminInvites() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('admin_invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as AdminInvite[];
  }

  async inviteAdmin(email: string) {
    return this.postAdminAction('/api/crm-service/invite-administrator', { email: email.trim() });
  }

  async cancelAdminInvite(inviteId: string) {
    return this.postAdminAction('/api/crm-service/cancel-admin-invite', { inviteId });
  }

  async resendAdminInvite(inviteId: string) {
    return this.postAdminAction('/api/crm-service/resend-admin-invite', { inviteId });
  }

  async acceptAdminInvite(newPassword: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    // This must be called while the session established by following the invite
    // email's link is still active (Supabase's client auto-detects it from the URL).
    const { error: updateError } = await client.auth.updateUser({ password: newPassword });
    if (updateError) {
      throw new Error(updateError.message || 'Failed to set your password.');
    }

    return this.postAdminAction('/api/crm-service/accept-admin-invite', {});
  }
}

// Instantiate the active service
export const dbService: DbService = new SupabaseServiceImpl();
