import { Router } from 'express';
import { requireAdmin, AdminAuthError, logAuditEvent } from '../lib/auth.js';

const router = Router();

router.get('/startups/:startupId/notes', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { startupId } = req.params;
    const { data, error } = await userClient
      .from('notes')
      .select('*')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error listing notes:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.post('/startups/:startupId/notes', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { startupId } = req.params;
    const { content } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Note content is required.' });
    }

    const { data: currentStartup } = await userClient
      .from('startups')
      .select('company_name')
      .eq('id', startupId)
      .single();

    const { data, error } = await userClient
      .from('notes')
      .insert({
        startup_id: startupId,
        author_id: user.id,
        author_email: user.email,
        content,
      })
      .select('*')
      .single();
    if (error) throw error;

    await logAuditEvent(userClient, {
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: startupId,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: 'Added reviewer note.' },
    });

    return res.json(data);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error adding note:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.delete('/notes/:noteId', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { noteId } = req.params;

    const { data: currentNote } = await userClient.from('notes').select('startup_id').eq('id', noteId).single();
    if (!currentNote) return res.status(404).json({ error: 'Note not found.' });

    const { data: currentStartup } = await userClient
      .from('startups')
      .select('company_name')
      .eq('id', currentNote.startup_id)
      .single();

    const { error } = await userClient.from('notes').delete().eq('id', noteId);
    if (error) throw error;

    await logAuditEvent(userClient, {
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: currentNote.startup_id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: 'Deleted reviewer note.' },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error deleting note:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
