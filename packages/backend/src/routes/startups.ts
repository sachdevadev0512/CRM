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
  'id', 'company_name', 'website', 'one_line_pitch', 'description', 'hq_location', 'sector',
  'founder_name', 'founder_email', 'founder_linkedin', 'team_size', 'team_background', 'stage',
  'funding_raised', 'target_raise', 'traction', 'pitch_deck_path', 'demo_video', 'status',
  'currency', 'revenue_status', 'revenue_generated_fy25', 'current_financial_year_revenue',
  'submitter_name', 'submitter_phone', 'submitter_email', 'submitter_role', 'referral_source',
  'founder_phone', 'company_linkedin', 'sector_other', 'raised_before', 'previous_round_amount',
  'previous_round_valuation', 'previous_round_date', 'current_valuation', 'problem_statement',
  'proposed_solution', 'target_audience', 'revenue_model', 'current_customers', 'monthly_burn',
  'revenue_fy_2425', 'revenue_fy_2526', 'revenue_fy_2627', 'pitch_deck_link', 'declaration_accepted',
  'last_completed_step', 'submitted_at', 'created_at', 'updated_at',
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
