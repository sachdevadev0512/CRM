import { Router } from 'express';
import { requireAdmin, AdminAuthError } from '../lib/auth.js';

const router = Router();

router.get('/audit-logs', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { data, error } = await userClient
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error listing audit logs:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.get('/audit-logs/target/:targetId', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { targetId } = req.params;
    const { data, error } = await userClient
      .from('audit_logs')
      .select('*')
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error listing audit logs for target:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.post('/audit-logs/csv-export', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { type, count } = req.body;

    const { error } = await userClient.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'CSV Export Generated',
      target_id: '00000000-0000-0000-0000-000000000000',
      target_name: 'Startups Export',
      details: {
        message: `Exported ${count} startups (${type}).`,
        export_type: type,
        record_count: count,
        timestamp: new Date().toISOString(),
      },
    });
    if (error) throw error;

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error logging CSV export:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
