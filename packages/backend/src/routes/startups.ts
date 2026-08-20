import { Router } from 'express';
import { requireAdmin, AdminAuthError, logAuditEvent } from '../lib/auth.js';
import type { PipelineStatus } from '../../../shared/src/types.js';

const router = Router();

const PIPELINE_STATUSES: PipelineStatus[] = ['New', 'Screening', 'Meeting', 'Due Diligence', 'Approved', 'Rejected', 'Archived'];

// Explicit column list, deliberately excluding `draft_token`/`resume_otp_hash`/
// `resume_otp_expires_at`/`resume_otp_attempts`. `draft_token` in particular is the bearer secret
// an anonymous applicant's browser uses to PATCH their own still-unsubmitted draft (see
// publicForm.ts and the column comment in 13_multistep_application_fields.sql) -- a plain
// `select('*')` here would hand every admin's browser every in-progress applicant's draft_token
// on every page load, letting anyone with devtools open tamper with someone else's draft via the
// public API. The `Startup` type in shared/src/types.ts never declares these fields either, so
// nothing in the admin UI needs them.
const ADMIN_STARTUP_COLUMNS = [
  'id', 'application_id', 'company_name', 'website', 'one_line_pitch', 'description', 'hq_location', 'sector',
  'founder_name', 'founder_email', 'founder_linkedin', 'team_size', 'team_background', 'stage',
  'funding_raised', 'target_raise', 'traction', 'pitch_deck_path', 'demo_video', 'status',
  'currency', 'revenue_status', 'revenue_generated_fy25', 'current_financial_year_revenue',
  'submitter_name', 'submitter_phone', 'submitter_email', 'submitter_role', 'referral_source',
  'founder_phone', 'company_linkedin', 'sector_other', 'raised_before', 'previous_round_amount',
  'previous_round_valuation', 'previous_round_date', 'current_valuation', 'problem_statement',
  'proposed_solution', 'target_audience', 'revenue_model', 'current_customers', 'monthly_burn',
  'revenue_fy_2425', 'revenue_fy_2526', 'revenue_fy_2627', 'pitch_deck_link', 'declaration_accepted',
  'last_completed_step', 'submitted_at', 'assigned_admin_id', 'created_at', 'updated_at',
].join(', ');

router.get('/', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { data, error } = await userClient.from('startups').select(ADMIN_STARTUP_COLUMNS).order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error listing startups:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required.' });
    if (!PIPELINE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${PIPELINE_STATUSES.join(', ')}.` });
    }

    const { data: currentStartup } = await userClient
      .from('startups')
      .select('company_name, status')
      .eq('id', id)
      .single();

    if (currentStartup?.status === 'In Progress') {
      return res.status(409).json({ error: 'This application is still in progress (not yet submitted) and cannot be moved in the pipeline yet.' });
    }

    const oldStatus = currentStartup?.status || 'Unknown';

    const { error } = await userClient
      .from('startups')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    await logAuditEvent(userClient, {
      user_id: user.id,
      user_email: user.email,
      action: 'Status changed',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { old_status: oldStatus, new_status: status },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error updating startup status:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Assigns (or unassigns, with admin_id: null) the admin responsible for reviewing/analyzing
// this application -- the "Analyst" column in the Deal Table and the drawer's assignment
// dropdown both call this. Any admin can assign themselves or a colleague; there is no
// ownership restriction, matching the "Admin update startups" RLS policy this relies on.
router.patch('/:id/assign', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { id } = req.params;
    const { admin_id } = req.body;

    // The admin dropdown always sends null for "Unassigned" (never ''), but a direct/malformed
    // API call could still send an empty string -- reject it explicitly here rather than letting
    // it fall through to the update below, where it would hit the same failure mode as the
    // route-ordering bug this file just had: an empty string isn't a valid uuid, so Postgres
    // would throw "invalid input syntax for type uuid" as a raw 500 instead of a clean 400.
    if (admin_id !== null && (typeof admin_id !== 'string' || admin_id.trim() === '')) {
      return res.status(400).json({ error: 'admin_id must be a non-empty string admin id or null to unassign.' });
    }

    const { data: currentStartup } = await userClient
      .from('startups')
      .select('company_name, assigned_admin_id')
      .eq('id', id)
      .single();

    let newAdminEmail: string | null = null;
    if (admin_id) {
      const { data: targetAdmin, error: targetAdminError } = await userClient
        .from('admins')
        .select('id, email')
        .eq('id', admin_id)
        .single();
      if (targetAdminError || !targetAdmin) {
        return res.status(400).json({ error: 'The selected admin no longer exists.' });
      }
      newAdminEmail = targetAdmin.email;
    }

    let oldAdminEmail: string | null = null;
    if (currentStartup?.assigned_admin_id) {
      const { data: prevAdmin } = await userClient
        .from('admins')
        .select('email')
        .eq('id', currentStartup.assigned_admin_id)
        .single();
      oldAdminEmail = prevAdmin?.email || null;
    }

    const { error } = await userClient
      .from('startups')
      .update({ assigned_admin_id: admin_id, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    await logAuditEvent(userClient, {
      user_id: user.id,
      user_email: user.email,
      action: 'Assigned admin',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { old_admin: oldAdminEmail, new_admin: newAdminEmail },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error assigning startup admin:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Bulk delete -- used by the admin table's row-checkbox selection. Registered BEFORE
// `DELETE /:id` below: Express matches routes in registration order, so if `/:id` came first
// it would swallow `DELETE /bulk` too (treating "bulk" itself as the :id param, which then
// fails against the uuid column with "invalid input syntax for type uuid").
router.delete('/bulk', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array.' });
    }
    // Same failure mode as the route-ordering bug above: a non-uuid string in `ids` (e.g. from a
    // stale client build or a direct API call) would otherwise reach `.in('id', ids)` below and
    // surface as a raw Postgres "invalid input syntax for type uuid" 500 instead of a clean 400.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!ids.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return res.status(400).json({ error: 'ids must all be valid uuids.' });
    }

    const { data: targets } = await userClient
      .from('startups')
      .select('id, company_name')
      .in('id', ids);

    const { data: deleted, error } = await userClient
      .from('startups')
      .delete()
      .in('id', ids)
      .select('id, company_name');
    if (error) throw error;

    // RLS can silently no-op rows it blocks rather than erroring, so only log/report what
    // actually came back as deleted (mirrors the check in routes/admins.ts).
    const deletedIds = new Set((deleted || []).map((row: any) => row.id));
    const nameById = new Map((targets || []).map((row: any) => [row.id, row.company_name]));

    await Promise.all(
      Array.from(deletedIds).map((id) =>
        logAuditEvent(userClient, {
          user_id: user.id,
          user_email: user.email,
          action: 'Delete',
          target_id: id,
          target_name: nameById.get(id) || 'Startup',
          details: { message: `Startup '${nameById.get(id) || id}' deleted by admin (bulk delete).` },
        })
      )
    );

    return res.json({ success: true, deletedCount: deletedIds.size, requestedCount: ids.length });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error bulk deleting startups:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { id } = req.params;

    const { data: currentStartup } = await userClient
      .from('startups')
      .select('company_name')
      .eq('id', id)
      .single();

    const { error } = await userClient.from('startups').delete().eq('id', id);
    if (error) throw error;

    await logAuditEvent(userClient, {
      user_id: user.id,
      user_email: user.email,
      action: 'Delete',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: `Startup '${currentStartup?.company_name}' deleted by admin.` },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error deleting startup:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

// Signed URL for the pitch deck download (kept here since it's a per-startup operation).
router.post('/:id/pitch-deck-url', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { path } = req.body;
    if (!path || !String(path).trim()) {
      return res.json({ url: '' });
    }

    let cleanPath = String(path).trim().replace(/\/+/g, '/');
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
    if (!cleanPath || cleanPath === 'pitch-decks' || cleanPath === 'pitch-decks/') {
      return res.json({ url: '' });
    }

    const { data, error } = await userClient.storage.from('pitch-decks').createSignedUrl(cleanPath, 3600);
    if (error) throw error;
    return res.json({ url: data.signedUrl || '' });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error creating signed URL:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
