import { Router } from 'express';
import { requireAdmin, AdminAuthError, logAuditEvent } from '../lib/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { data, error } = await userClient.from('startups').select('*').order('created_at', { ascending: false });
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

    const { data: currentStartup } = await userClient
      .from('startups')
      .select('company_name, status')
      .eq('id', id)
      .single();

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
