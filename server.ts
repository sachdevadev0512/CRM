import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Trust proxy for secure headers and rate limiting in production environments (such as behind Cloud Run load balancers)
  app.set('trust proxy', 1);

  // Lazy initialize Supabase clients for safety
  let publicSupabaseClient: any = null;
  let adminSupabaseClient: any = null;

  function getPublicSupabase() {
    if (!publicSupabaseClient) {
      const url = process.env.VITE_SUPABASE_URL;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        throw new Error('Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing.');
      }
      publicSupabaseClient = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
    return publicSupabaseClient;
  }

  function getAdminSupabase() {
    if (!adminSupabaseClient) {
      const url = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url) {
        throw new Error('VITE_SUPABASE_URL is required.');
      }
      if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Please set it in your AI Studio secrets/settings.');
      }
      adminSupabaseClient = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
    return adminSupabaseClient;
  }

  // Parse JSON bodies
  app.use(express.json());

  // Production security headers middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // To allow framing in AI Studio but enforce SAMEORIGIN elsewhere, we can conditionally set X-Frame-Options.
    const referer = req.headers.referer || '';
    const isFramedByGoogle = referer.includes('ai.studio') || referer.includes('.google.com') || referer.includes('.run.app');
    if (!isFramedByGoogle) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }

    // Strict Content-Security-Policy (CSP) allowing the AI Studio preview frame and Cloudflare Turnstile to load
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseHost = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '') : '';
    const connectSrc = [
      "'self'",
      supabaseUrl,
      supabaseHost ? `wss://${supabaseHost}` : '',
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://challenges.cloudflare.com"
    ].filter(Boolean).join(' ');

    const cspDirectives = [
      "default-src 'self'",
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      `connect-src ${connectSrc}`,
      "img-src 'self' data: https://*.supabase.co https://ai.google.dev https://google.dev https://ai.studio",
      "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app",
      "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);
    
    // Strict-Transport-Security only when HTTPS
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Basic in-memory rate limiter with proactive eviction. Separate Map instances are used
  // per route family so admin-invite actions and public form-verification attempts don't
  // share (and prematurely exhaust) the same counter.
  const adminInviteLimiter = new Map<string, { count: number; resetAt: number }>();
  const turnstileLimiter = new Map<string, { count: number; resetAt: number }>();

  function checkRateLimit(
    store: Map<string, { count: number; resetAt: number }>,
    ip: string,
    limit: number,
    timeframeMs: number
  ): { allowed: boolean; resetAt?: number } {
    const now = Date.now();

    // Proactive eviction of expired entries to prevent memory growth
    for (const [key, val] of store.entries()) {
      if (now > val.resetAt) {
        store.delete(key);
      }
    }

    const record = store.get(ip);
    if (!record) {
      store.set(ip, { count: 1, resetAt: now + timeframeMs });
      return { allowed: true };
    }

    if (record.count >= limit) {
      return { allowed: false, resetAt: record.resetAt };
    }

    record.count += 1;
    return { allowed: true };
  }

  function getClientIp(req: express.Request): string {
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    return rawIp.split(',')[0].trim();
  }

  // Verifies a Cloudflare Turnstile token against Cloudflare's siteverify API.
  // This closes the gap where the client only checked for a non-empty token
  // locally without ever proving it server-side.
  async function verifyTurnstileToken(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error('[Turnstile] TURNSTILE_SECRET_KEY is not configured on the server.');
      return { success: false, error: 'Security verification is not configured on the server.' };
    }

    try {
      const body = new URLSearchParams();
      body.append('secret', secret);
      body.append('response', token);
      if (ip && ip !== 'unknown') {
        body.append('remoteip', ip);
      }

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const result: any = await verifyRes.json();
      if (!result.success) {
        return { success: false, error: 'Security verification failed. Please refresh and try again.' };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[Turnstile] Verification request failed:', err.message);
      return { success: false, error: 'Security verification could not be completed. Please try again.' };
    }
  }

  // Thrown by requireAdmin() below and translated into an HTTP response by each
  // route's existing try/catch block (avoids relying on discriminated-union
  // narrowing, which this project's tsconfig doesn't reliably support since
  // it doesn't enable strictNullChecks).
  class AdminAuthError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  // Verifies the caller is an authenticated, currently-registered administrator.
  // Shared by every privileged /api/crm-service/* route below. Throws AdminAuthError
  // (with an HTTP status) on any failure; resolves with the caller's identity and a
  // ready-to-use service-role client on success.
  async function requireAdmin(req: express.Request): Promise<{ user: { id: string; email: string }; adminClient: any }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AdminAuthError(401, 'Unauthorized. Authorization token is missing.');
    }

    const token = authHeader.substring(7);
    const pubClient = getPublicSupabase();

    const { data: { user }, error: authError } = await pubClient.auth.getUser(token);
    if (authError || !user) {
      throw new AdminAuthError(401, 'Unauthorized. Invalid authentication session.');
    }

    let adminClient;
    try {
      adminClient = getAdminSupabase();
    } catch (err: any) {
      throw new AdminAuthError(500, err.message);
    }

    const { data: adminRecord, error: adminQueryError } = await adminClient
      .from('admins')
      .select('id, email')
      .eq('id', user.id)
      .maybeSingle();

    if (adminQueryError || !adminRecord) {
      throw new AdminAuthError(403, 'Forbidden. Only registered administrators can perform this action.');
    }

    return { user: { id: user.id, email: adminRecord.email || user.email }, adminClient };
  }

  // Resolves the public-facing origin of this app (used to build the invite redirect URL),
  // honoring the trust-proxy / X-Forwarded-* headers already relied on elsewhere in this file.
  function getAppOrigin(req: express.Request): string {
    return `${req.protocol}://${req.get('host')}`;
  }

  // Lazily-built SMTP transporter for admin-invite emails. We send these ourselves
  // instead of relying on Supabase Auth's built-in mailer (which is a shared,
  // low-volume/testing-only service with a strict default rate limit) -- Supabase
  // still generates the actual invite token/link via generateLink(), we just deliver
  // it through our own SMTP account instead of Supabase's.
  let mailTransporter: nodemailer.Transporter | null = null;
  function getMailTransporter(): nodemailer.Transporter {
    if (!mailTransporter) {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '465', 10);
      const secure = process.env.SMTP_SECURE !== 'false';
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      if (!host || !user || !pass) {
        throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
      }

      mailTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      });
    }
    return mailTransporter;
  }

  async function sendInviteEmail(toEmail: string, actionLink: string): Promise<void> {
    const transporter = getMailTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER!;
    const fromName = process.env.SMTP_FROM_NAME || 'Middha Ventures';

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: toEmail,
      subject: 'You have been invited to the Middha Ventures CRM',
      html: `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111827; margin-bottom: 8px;">You've been invited</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            An existing administrator has invited you to join the Middha Ventures Investment CRM.
            Click the button below to set your password and activate your account.
          </p>
          <p style="margin: 28px 0;">
            <a href="${actionLink}" style="background:#111827;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              Activate Your Account
            </a>
          </p>
          <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <a href="${actionLink}" style="color:#6b7280;">${actionLink}</a>
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      `
    });
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Public route: verify a Cloudflare Turnstile token before the client is allowed to
  // proceed with writing a startup application directly to Supabase.
  app.post('/api/verify-turnstile', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const limitCheck = checkRateLimit(turnstileLimiter, ip, 20, 15 * 60 * 1000);
      if (!limitCheck.allowed) {
        const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
        return res.status(429).json({ success: false, error: `Too many verification attempts. Please try again in ${minutesLeft} minutes.` });
      }

      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing security verification token.' });
      }

      const result = await verifyTurnstileToken(token, ip);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Server API] Error verifying Turnstile token:', error);
      return res.status(500).json({ success: false, error: error.message || 'An unexpected server error occurred.' });
    }
  });

  // Invite a new administrator by email. Creates the auth user via Supabase's invite
  // API (which sends the actual invite email through the project's configured Auth SMTP)
  // and records a pending row in public.admin_invites. The invitee is NOT added to
  // public.admins until they accept the invite (see /accept-admin-invite below).
  app.post('/api/crm-service/invite-administrator', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const limitCheck = checkRateLimit(adminInviteLimiter, ip, 50, 15 * 60 * 1000);
      if (!limitCheck.allowed) {
        const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
        return res.status(429).json({ error: `Too many administrator invitation attempts from this IP. Please try again in ${minutesLeft} minutes.` });
      }

      const { user, adminClient } = await requireAdmin(req);

      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email address is required.' });
      }
      const trimmedEmail = email.trim().toLowerCase();

      const { data: existingAdmin } = await adminClient
        .from('admins')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();
      if (existingAdmin) {
        return res.status(400).json({ error: `An administrator account with email "${trimmedEmail}" already exists.` });
      }

      const { data: existingInvite } = await adminClient
        .from('admin_invites')
        .select('id')
        .eq('email', trimmedEmail)
        .eq('status', 'pending')
        .maybeSingle();
      if (existingInvite) {
        return res.status(400).json({ error: `An invitation is already pending for "${trimmedEmail}". Resend or cancel it instead.` });
      }

      const redirectTo = `${getAppOrigin(req)}/admin/accept-invite`;
      // generateLink() creates the auth user + a real invite token/link, exactly like
      // inviteUserByEmail(), but returns the link to us instead of emailing it via
      // Supabase's own mailer -- we send it ourselves via sendInviteEmail() below.
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email: trimmedEmail,
        options: { redirectTo }
      });
      if (inviteError || !inviteData || !inviteData.user || !inviteData.properties?.action_link) {
        console.error('[Server API] generateLink (invite) failed:', inviteError?.message);
        return res.status(400).json({ error: inviteError?.message || 'Failed to create administrator invitation.' });
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await adminClient.from('admin_invites').insert({
        email: trimmedEmail,
        invited_user_id: inviteData.user.id,
        invited_by: user.id,
        invited_by_email: user.email,
        status: 'pending',
        expires_at: expiresAt
      });
      if (insertError) {
        console.error('[Server API] Failed to record admin_invites row:', insertError.message);
        try {
          await adminClient.auth.admin.deleteUser(inviteData.user.id);
        } catch (rollbackError: any) {
          console.error(
            `[Server API] CRITICAL: failed to roll back orphaned invite user after admin_invites insert failure. ` +
            `Manual cleanup required in Supabase Auth dashboard -- user id: ${inviteData.user.id}, email: ${trimmedEmail}. ` +
            `Rollback error: ${rollbackError.message}`
          );
        }
        return res.status(500).json({ error: `Failed to record invitation: ${insertError.message}` });
      }

      try {
        await sendInviteEmail(trimmedEmail, inviteData.properties.action_link);
      } catch (mailError: any) {
        console.error('[Server API] Failed to send invite email:', mailError.message);
        // Roll back: no point leaving a pending invite the recipient never got a link for.
        // If the rollback itself also fails, that email is now stuck (an unconfirmed
        // auth user exists with no invite record pointing at it, and generateLink()
        // will refuse to re-invite that address until it's manually removed) -- log
        // loudly with everything needed to find and clean it up by hand, rather than
        // letting it disappear silently.
        try {
          await adminClient.from('admin_invites').delete().eq('invited_user_id', inviteData.user.id);
          await adminClient.auth.admin.deleteUser(inviteData.user.id);
        } catch (rollbackError: any) {
          console.error(
            `[Server API] CRITICAL: failed to roll back orphaned invite user after email send failure. ` +
            `Manual cleanup required in Supabase Auth dashboard -- user id: ${inviteData.user.id}, email: ${trimmedEmail}. ` +
            `Rollback error: ${rollbackError.message}`
          );
        }
        return res.status(500).json({ error: `Failed to send invitation email: ${mailError.message}` });
      }

      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'Administrator invited',
        target_id: inviteData.user.id,
        target_name: trimmedEmail,
        details: { invited_by: user.id, email: trimmedEmail }
      });

      return res.json({ success: true });
    } catch (error: any) {
      if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
      console.error('Error in administrator invitation:', error);
      return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
  });

  // Cancel a pending administrator invitation: removes the unconfirmed auth user
  // (they never became an admin, so this is safe) and marks the invite revoked.
  app.post('/api/crm-service/cancel-admin-invite', async (req, res) => {
    try {
      const { user, adminClient } = await requireAdmin(req);

      const { inviteId } = req.body;
      if (!inviteId) return res.status(400).json({ error: 'inviteId is required.' });

      const { data: invite, error: fetchError } = await adminClient
        .from('admin_invites')
        .select('id, email, invited_user_id, status')
        .eq('id', inviteId)
        .maybeSingle();

      if (fetchError || !invite || invite.status !== 'pending') {
        return res.status(400).json({ error: 'No pending invitation was found for that record.' });
      }

      if (invite.invited_user_id) {
        await adminClient.auth.admin.deleteUser(invite.invited_user_id);
      }

      const { error: updateError } = await adminClient
        .from('admin_invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId);
      if (updateError) {
        return res.status(500).json({ error: `Failed to revoke invitation: ${updateError.message}` });
      }

      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'Administrator invite cancelled',
        target_id: invite.invited_user_id || inviteId,
        target_name: invite.email,
        details: { cancelled_by: user.id, email: invite.email }
      });

      return res.json({ success: true });
    } catch (error: any) {
      if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
      console.error('Error cancelling administrator invitation:', error);
      return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
  });

  // Resend a pending administrator invitation: discards the old unconfirmed auth user
  // and invite row, then issues a brand new invite (fresh email, fresh 7-day expiry).
  app.post('/api/crm-service/resend-admin-invite', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const limitCheck = checkRateLimit(adminInviteLimiter, ip, 50, 15 * 60 * 1000);
      if (!limitCheck.allowed) {
        const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
        return res.status(429).json({ error: `Too many administrator invitation attempts from this IP. Please try again in ${minutesLeft} minutes.` });
      }

      const { user, adminClient } = await requireAdmin(req);

      const { inviteId } = req.body;
      if (!inviteId) return res.status(400).json({ error: 'inviteId is required.' });

      const { data: invite, error: fetchError } = await adminClient
        .from('admin_invites')
        .select('id, email, invited_user_id, status')
        .eq('id', inviteId)
        .maybeSingle();

      if (fetchError || !invite || invite.status !== 'pending' || !invite.invited_user_id) {
        return res.status(400).json({ error: 'No pending invitation was found for that record.' });
      }

      // The invited user's auth account already exists at this point (unconfirmed,
      // no password set) -- generateLink({type: 'invite'}) specifically CREATES a new
      // user and fails with "already been registered" for an email that already has
      // one, which is exactly what happened here. A resend doesn't need a new account
      // at all: generate a fresh 'recovery' link for the SAME existing user (it
      // establishes a session identically to an invite link) and just extend this
      // same invite row's expiry, instead of destroying and recreating the account.
      const redirectTo = `${getAppOrigin(req)}/admin/accept-invite`;
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: invite.email,
        options: { redirectTo }
      });
      if (linkError || !linkData || !linkData.properties?.action_link) {
        console.error('[Server API] generateLink (resend) failed:', linkError?.message);
        return res.status(400).json({ error: linkError?.message || 'Failed to resend administrator invitation.' });
      }

      try {
        await sendInviteEmail(invite.email, linkData.properties.action_link);
      } catch (mailError: any) {
        console.error('[Server API] Failed to send resend invite email:', mailError.message);
        return res.status(500).json({ error: `Failed to send invitation email: ${mailError.message}` });
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await adminClient.from('admin_invites').update({ expires_at: expiresAt }).eq('id', inviteId);

      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'Administrator invite resent',
        target_id: invite.invited_user_id,
        target_name: invite.email,
        details: { resent_by: user.id, email: invite.email }
      });

      return res.json({ success: true });
    } catch (error: any) {
      if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
      console.error('Error resending administrator invitation:', error);
      return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
  });

  // Called by the INVITED USER after they've followed the invite link and set their own
  // password. Unlike the routes above, the caller is NOT expected to already be an admin —
  // authorization instead comes from having a pending admin_invites row that matches
  // their own auth user id, which only exists if a real administrator invited them.
  app.post('/api/crm-service/accept-admin-invite', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const limitCheck = checkRateLimit(adminInviteLimiter, ip, 50, 15 * 60 * 1000);
      if (!limitCheck.allowed) {
        const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
        return res.status(429).json({ error: `Too many attempts. Please try again in ${minutesLeft} minutes.` });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Authorization token is missing.' });
      }
      const token = authHeader.substring(7);
      const pubClient = getPublicSupabase();
      const { data: { user }, error: authError } = await pubClient.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized. Invalid authentication session.' });
      }

      let adminClient;
      try {
        adminClient = getAdminSupabase();
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }

      const { data: existingAdmin } = await adminClient
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (existingAdmin) {
        return res.status(400).json({ error: 'This account is already an administrator.' });
      }

      const { data: invite, error: inviteError } = await adminClient
        .from('admin_invites')
        .select('id, email, invited_by, invited_by_email, status, expires_at')
        .eq('invited_user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (inviteError || !invite) {
        return res.status(400).json({ error: 'No pending invitation was found for this account. Ask an administrator to send a new one.' });
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: 'This invitation has expired. Ask an administrator to resend it.' });
      }

      const { error: insertError } = await adminClient.from('admins').insert({
        id: user.id,
        email: user.email
      });
      if (insertError) {
        console.error('[Server API] Failed to insert accepted admin into public.admins:', insertError.message);
        return res.status(500).json({ error: `Failed to finalize administrator account: ${insertError.message}` });
      }

      await adminClient
        .from('admin_invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'Admin account created',
        target_id: user.id,
        target_name: user.email,
        details: { invited_by: invite.invited_by, invited_by_email: invite.invited_by_email, email: user.email }
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error('Error accepting administrator invitation:', error);
      return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
    }
  });

  // Serve static assets or mount Vite dev server middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const publicPath = path.join(process.cwd(), 'dist', 'public');
    
    // Explicitly reject requests to server files, sourcemaps, or TS source files with a hard 404
    app.use((req, res, next) => {
      const ext = path.extname(req.path).toLowerCase();
      if (ext === '.cjs' || ext === '.map' || ext === '.ts' || req.path === '/server.cjs') {
        res.status(404).send('Not Found');
        return;
      }
      next();
    });

    app.use(express.static(publicPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
