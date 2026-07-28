import { Router } from 'express';
import { requireAdmin, AdminAuthError, logAuditEvent } from '../lib/auth.js';

const router = Router();

router.get('/admins', async (req, res) => {
  try {
    const { userClient } = await requireAdmin(req);
    const { data, error } = await userClient.from('admins').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return res.json(data || []);
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error listing admins:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

router.delete('/admins/:id', async (req, res) => {
  try {
    const { user, userClient } = await requireAdmin(req);
    const { id } = req.params;
    const { email } = req.body;

    // Request the deleted row(s) back. If RLS blocks the delete (e.g. self-revocation or the
    // last remaining admin), Supabase returns success with an empty array rather than an error --
    // so the row count must be checked explicitly instead of assuming success whenever `error`
    // is falsy.
    const { data, error } = await userClient.from('admins').delete().eq('id', id).select('id');
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(400).json({
        error: 'Admin was not removed. This is either not permitted (you cannot revoke your own access or remove the last remaining admin) or the required database policy is missing.',
      });
    }

    if (email) {
      await logAuditEvent(userClient, {
        user_id: user.id,
        user_email: user.email,
        action: 'Administrator Revoked',
        target_id: id,
        target_name: email,
        details: { message: `Administrator privilege revoked for ${email}.`, email },
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthError) return res.status(error.status).json({ error: error.message });
    console.error('Error deleting admin:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
