import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPublicSupabase } from '../lib/supabaseClients.js';
import { checkRateLimit, getClientIp, turnstileLimiter } from '../lib/rateLimiter.js';
import { cleanUrl } from '../../../shared/src/securityUtils.js';

const router = Router();

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

// Public route: verify a Cloudflare Turnstile token before allowing a startup application write.
router.post('/verify-turnstile', async (req, res) => {
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

// Public form submission. Turnstile verification + the actual insert both happen here now --
// the browser never touches Supabase directly, so it never ships an anon key or reveals table
// structure over the wire.
router.post('/submit-application', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const limitCheck = checkRateLimit(turnstileLimiter, ip, 20, 15 * 60 * 1000);
    if (!limitCheck.allowed) {
      const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
      return res.status(429).json({ error: `Too many attempts. Please try again in ${minutesLeft} minutes.` });
    }

    const { turnstileToken, data } = req.body;
    if (!turnstileToken) {
      return res.status(400).json({ error: 'Please complete the security verification (CAPTCHA) before submitting.' });
    }

    const verifyResult = await verifyTurnstileToken(turnstileToken, ip);
    if (!verifyResult.success) {
      return res.status(400).json({ error: verifyResult.error || 'Security verification failed. Please refresh and try again.' });
    }

    if (!data || !data.company_name || !data.founder_email) {
      return res.status(400).json({ error: 'Missing required application fields.' });
    }

    const client = getPublicSupabase();

    // Duplicate-name pre-check is advisory only (RLS blocks anonymous SELECT on startups, so
    // this always no-ops for a real anonymous submission) -- the actual, real enforcement is the
    // DB-level `check_duplicate_startup` trigger, which still runs regardless of this check.
    try {
      const { data: existingStartup, error: checkError } = await client
        .from('startups')
        .select('id')
        .ilike('company_name', String(data.company_name).trim())
        .maybeSingle();

      if (!checkError && existingStartup) {
        return res.status(400).json({ error: `A startup application with the company name "${data.company_name}" has already been submitted to our pipeline.` });
      }
    } catch (e) {
      console.warn('Duplicate verification query issue, continuing with insert:', e);
    }

    const websiteClean = cleanUrl(data.website);
    const linkedinClean = cleanUrl(data.founder_linkedin);
    const demoClean = cleanUrl(data.demo_video);
    const newId = randomUUID();

    const startupPayload = {
      id: newId,
      company_name: String(data.company_name).trim(),
      website: websiteClean,
      one_line_pitch: String(data.one_line_pitch || '').trim(),
      description: String(data.description || '').trim(),
      hq_location: String(data.hq_location || '').trim(),
      sector: data.sector,
      founder_name: String(data.founder_name || '').trim(),
      founder_email: String(data.founder_email).trim(),
      founder_linkedin: linkedinClean,
      team_size: Number(data.team_size),
      team_background: String(data.team_background || '').trim(),
      stage: data.stage,
      funding_raised: Number(data.funding_raised || 0),
      target_raise: Number(data.target_raise),
      traction: String(data.traction || '').trim(),
      pitch_deck_path: '',
      demo_video: demoClean || null,
      status: 'New',
      currency: data.currency || 'INR',
      revenue_status: data.revenue_status || 'Pre-Revenue',
      revenue_generated_fy25: data.revenue_generated_fy25 ? Number(data.revenue_generated_fy25) : null,
      current_financial_year_revenue: data.current_financial_year_revenue ? Number(data.current_financial_year_revenue) : null,
    };

    const { error: dbError } = await client.from('startups').insert(startupPayload);
    if (dbError) {
      console.error('Secure database insert failed:', dbError);
      if (dbError.message && (dbError.message.includes('already been submitted') || dbError.message.includes('duplicate'))) {
        return res.status(400).json({ error: dbError.message });
      }
      return res.status(500).json({ error: 'Your application could not be submitted. Please check the fields and try again.' });
    }

    // The 'tr_log_startup_submission' AFTER INSERT database trigger logs this to audit_logs
    // automatically -- no client-side (or here, server-side) write needed.

    return res.json({ success: true, id: newId });
  } catch (error: any) {
    console.error('Error in submit-application:', error);
    return res.status(500).json({ error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
