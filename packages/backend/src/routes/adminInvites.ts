import { Router } from 'express';
import type { Request } from 'express';
import { requireAdmin, requireUser, AdminAuthError } from '../lib/auth.js';
import { checkRateLimit, getClientIp, adminInviteLimiter } from '../lib/rateLimiter.js';
import { sendInviteEmail } from '../lib/mailer.js';

const router = Router();

// Resolves the admin app's own origin specifically (used to build the invite redirect URL) --
// distinct from FRONTEND_ORIGIN (the CORS allow-list, which may contain multiple origins in
// dev). In production this is the same https://crm.dealschool.in the form lives under (admin
// is just a path there); in local dev it's wherever the admin package's own dev server runs.
function getAdminOrigin(): string {
  const origin = process.env.ADMIN_ORIGIN;
  if (!origin) {
    throw new Error('ADMIN_ORIGIN is not configured on the server.');
  }
  return origin;
}

router.get('/admin-invites', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { data, error } = await userClient.from('admin_invites').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error listing admin invites:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Invite a new administrator by email. Creates the auth user via Supabase's admin API and
// records a pending row in public.admin_invites. The invitee is NOT added to public.admins
// until they accept the invite (see /admin-invites/accept below).
router.post('/admin-invites', async (req: Request, res) => {
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

    const { data: existingAdmin } = await adminClient.from('admins').select('id').eq('email', trimmedEmail).maybeSingle();
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

    const redirectTo = `${getAdminOrigin()}/admin/accept-invite`;
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: trimmedEmail,
      options: { redirectTo },
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
      expires_at: expiresAt,
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
      details: { invited_by: user.id, email: trimmedEmail },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error in administrator invitation:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Cancel a pending administrator invitation: removes the unconfirmed auth user (they never
// became an admin, so this is safe) and marks the invite revoked.
router.post('/admin-invites/:id/cancel', async (req, res) => {
  try {
    const { user, adminClient } = await requireAdmin(req);
    const { id: inviteId } = req.params;

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

    const { error: updateError } = await adminClient.from('admin_invites').update({ status: 'revoked' }).eq('id', inviteId);
    if (updateError) {
      return res.status(500).json({ error: `Failed to revoke invitation: ${updateError.message}` });
    }

    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'Administrator invite cancelled',
      target_id: invite.invited_user_id || inviteId,
      target_name: invite.email,
      details: { cancelled_by: user.id, email: invite.email },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error cancelling administrator invitation:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Resend a pending administrator invitation: the invited user's auth account already exists
// (unconfirmed, no password set), so this generates a fresh 'recovery' link for that SAME
// existing user (establishes a session identically to an invite link) rather than trying to
// re-invite them, which fails with "already registered".
router.post('/admin-invites/:id/resend', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const limitCheck = checkRateLimit(adminInviteLimiter, ip, 50, 15 * 60 * 1000);
    if (!limitCheck.allowed) {
      const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
      return res.status(429).json({ error: `Too many administrator invitation attempts from this IP. Please try again in ${minutesLeft} minutes.` });
    }

    const { user, adminClient } = await requireAdmin(req);
    const { id: inviteId } = req.params;

    const { data: invite, error: fetchError } = await adminClient
      .from('admin_invites')
      .select('id, email, invited_user_id, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (fetchError || !invite || invite.status !== 'pending' || !invite.invited_user_id) {
      return res.status(400).json({ error: 'No pending invitation was found for that record.' });
    }

    const redirectTo = `${getAdminOrigin()}/admin/accept-invite`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: invite.email,
      options: { redirectTo },
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
      details: { resent_by: user.id, email: invite.email },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error resending administrator invitation:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Called by the INVITED USER after they've followed the invite link and set their own password.
// Unlike the routes above, the caller is NOT expected to already be an admin -- authorization
// instead comes from having a pending admin_invites row that matches their own auth user id,
// which only exists if a real administrator invited them.
router.post('/admin-invites/accept', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const limitCheck = checkRateLimit(adminInviteLimiter, ip, 50, 15 * 60 * 1000);
    if (!limitCheck.allowed) {
      const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
      return res.status(429).json({ error: `Too many attempts. Please try again in ${minutesLeft} minutes.` });
    }

    const { user, adminClient } = await requireUser(req);

    const { data: existingAdmin } = await adminClient.from('admins').select('id').eq('id', user.id).maybeSingle();
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

    const { error: insertError } = await adminClient.from('admins').insert({ id: user.id, email: user.email });
    if (insertError) {
      console.error('[Server API] Failed to insert accepted admin into public.admins:', insertError.message);
      return res.status(500).json({ error: `Failed to finalize administrator account: ${insertError.message}` });
    }

    await adminClient.from('admin_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id);

    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'Admin account created',
      target_id: user.id,
      target_name: user.email,
      details: { invited_by: invite.invited_by, invited_by_email: invite.invited_by_email, email: user.email },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error accepting administrator invitation:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;


