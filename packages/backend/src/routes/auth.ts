import { Router } from 'express';
import { getPublicSupabase, getAdminSupabase } from '../lib/supabaseClients.js';
import { checkRateLimit, getClientIp, authLimiter } from '../lib/rateLimiter.js';
import { requireUser, AdminAuthError } from '../lib/auth.js';

const router = Router();

async function isAdminEmail(userId: string): Promise<boolean> {
  const adminClient = getAdminSupabase();
  const { data } = await adminClient.from('admins').select('id').eq('id', userId).maybeSingle();
  return !!data;
}

// The browser never calls supabase.auth.* directly anymore -- these three routes are a thin
// proxy so it never needs the anon key at all. Tokens are handed back as plain JSON for the
// frontend to store itself (localStorage) and attach as `Authorization: Bearer` on every
// subsequent API call; this is what makes cross-origin (crm.dealschool.in <-> crm-api.dealschool.in)
// work cleanly without any cookie/SameSite complexity.
router.post('/login', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const limitCheck = checkRateLimit(authLimiter, ip, 20, 15 * 60 * 1000);
    if (!limitCheck.allowed) {
      const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
      return res.status(429).json({ error: `Too many sign-in attempts. Please try again in ${minutesLeft} minutes.` });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const pubClient = getPublicSupabase();
    const { data, error } = await pubClient.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      return res.status(401).json({ error: error?.message || 'Invalid credentials.' });
    }

    const isAdmin = await isAdminEmail(data.user.id);

    return res.json({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: { id: data.user.id, email: data.user.email || '', isAdmin },
    });
  } catch (error: any) {
    console.error('Error in login:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required.' });
    }

    const pubClient = getPublicSupabase();
    const { data, error } = await pubClient.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || 'Session refresh failed. Please sign in again.' });
    }

    return res.json({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error: any) {
    console.error('Error refreshing session:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (accessToken && refresh_token) {
      const pubClient = getPublicSupabase();
      // Establish the caller's session on a throwaway client just long enough to revoke it.
      await pubClient.auth.setSession({ access_token: accessToken, refresh_token });
      await pubClient.auth.signOut();
    }

    return res.json({ success: true });
  } catch (error: any) {
    // Logout should never block the client from clearing its own local tokens.
    console.warn('Error during server-side logout (client-side sign-out still applies):', error.message);
    return res.json({ success: true });
  }
});

// Used only by the invite-accept flow: the invitee has a valid session (established from the
// invite email's link tokens) but isn't an admin yet, so this is gated by requireUser (not
// requireAdmin). Goes through the admin API (service role) rather than a session-bound
// `auth.updateUser` call, since the browser never holds the anon key needed for that.
router.post('/set-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const { user, adminClient } = await requireUser(req);
    const { error } = await adminClient.auth.admin.updateUserById(user.id, { password });
    if (error) {
      return res.status(400).json({ error: error.message || 'Failed to set your password.' });
    }

    // Setting the password via the admin API invalidates the invite-link session used to
    // authenticate this very request -- sign back in with the new password immediately so the
    // frontend has a valid session again (it needs one right after this to call
    // /api/admin-invites/accept).
    const pubClient = getPublicSupabase();
    const { data: signInData, error: signInError } = await pubClient.auth.signInWithPassword({ email: user.email, password });
    if (signInError || !signInData.session) {
      return res.status(500).json({ error: 'Password was set, but re-authentication failed. Please sign in again.' });
    }

    return res.json({
      success: true,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: signInData.session.expires_at,
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error setting password:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const { user, adminClient } = await requireUser(req);
    const { data: adminRecord } = await adminClient.from('admins').select('id').eq('id', user.id).maybeSingle();
    return res.json({ id: user.id, email: user.email, isAdmin: !!adminRecord });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error in /me:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
