import { Router } from 'express';
import { randomUUID, randomInt, createHash } from 'node:crypto';
import { getAdminSupabase } from '../lib/supabaseClients.js';
import { checkRateLimit, getClientIp, turnstileLimiter, otpIpLimiter, otpEmailLimiter } from '../lib/rateLimiter.js';
import { cleanUrl } from '../../../shared/src/securityUtils.js';
import { sendResumeOtpEmail } from '../lib/mailer.js';
import type { ApplicationStepData } from '../../../shared/src/types.js';

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

// -----------------------------------------------------------------------------------------------
// Multi-step public application form.
//
// The 6-step form saves progress after every step via this single endpoint:
//   - No `id` in the body -> first checks whether `submitter_email` (collected in step 1) already
//     has an application on file: an 'In Progress' one means "resume" (see the OTP endpoints
//     below), anything else means it's already been fully submitted -- both cases reject the
//     create outright (one application per email). Otherwise creates a new draft row
//     (status = 'In Progress') and returns a server-generated `id` and `draftToken`. This whole
//     branch uses the service-role client (the pre-insert SELECT needs it; anon has no SELECT
//     policy on startups) rather than relying on the "Public submit startup" INSERT policy.
//   - `id` + `draftToken` in the body -> patches that same draft row. Anon has no UPDATE policy on
//     `startups` (by design -- see RLS in 01_init.sql), so this uses the service-role client to
//     bypass RLS; `draftToken` is the only thing standing in for row ownership, so every update is
//     gated on both `id` AND `draft_token` matching, and on the row still being `'In Progress'`
//     (never lets a client re-patch a row that's already been finalized or moved in the pipeline).
//   - step === 6 additionally requires + verifies the Turnstile token, validates the full set of
//     required fields against the merged row, and flips `status` to 'New' + stamps `submitted_at`.
//
// Resuming a draft from a different browser/device (or after a step-1 "you already have one in
// progress" rejection) goes through the two OTP endpoints further down: request-otp emails a
// 6-digit code to the matching draft's submitter_email; verify-otp checks it and, on success,
// hands back the same { id, draftToken, currentStep, data } shape the client needs to hydrate the
// wizard, exactly as if it had been resumed from localStorage.
// -----------------------------------------------------------------------------------------------

// Only these fields may ever be written by a step-save request -- never `status`, `id`,
// `draft_token`, `last_completed_step`, `submitted_at`, timestamps, etc. Whitelisting like this
// matters because this is an unauthenticated, public endpoint.
const URL_FIELDS = ['website', 'company_linkedin', 'founder_linkedin', 'pitch_deck_link', 'demo_video'] as const;
const NUMBER_FIELDS = [
  'target_raise', 'previous_round_amount', 'previous_round_valuation', 'current_valuation',
  'current_customers', 'monthly_burn', 'revenue_fy_2425', 'revenue_fy_2526', 'revenue_fy_2627',
] as const;
const BOOLEAN_FIELDS = ['raised_before', 'declaration_accepted'] as const;
const STRING_FIELDS = [
  'referral_source', 'submitter_role', 'submitter_name', 'submitter_phone', 'submitter_email',
  'company_name', 'founder_name', 'founder_phone', 'founder_email', 'hq_location', 'sector',
  'sector_other', 'one_line_pitch', 'stage', 'currency', 'previous_round_date',
  'problem_statement', 'proposed_solution', 'target_audience', 'revenue_model',
] as const;

const REQUIRED_FIELDS = [
  'referral_source', 'submitter_role', 'submitter_name', 'submitter_phone', 'submitter_email',
  'company_name', 'founder_name', 'founder_phone', 'founder_email', 'hq_location', 'sector',
  'one_line_pitch', 'stage', 'target_raise', 'currency', 'current_valuation',
  'problem_statement', 'proposed_solution', 'target_audience', 'revenue_model',
  'current_customers', 'monthly_burn', 'pitch_deck_link',
] as const;

const EMAIL_PATTERN = /^[^\s@%]+@[^\s@%]+\.[^\s@%]+$/;

// Escapes Postgres ILIKE/LIKE special characters so a value used as a filter can never be
// (mis)interpreted as a wildcard pattern -- required everywhere a caller-controlled string
// (e.g. an email address) is passed into `.ilike()`, or `%`/`_` in it would match unrelated rows.
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => '\\' + m);
}

function buildUpdates(data: ApplicationStepData): Record<string, any> {
  const updates: Record<string, any> = {};
  const raw = data as Record<string, unknown>;

  for (const key of URL_FIELDS) {
    const value = raw[key];
    if (value === undefined) continue;
    updates[key] = value === null ? null : cleanUrl(String(value));
  }
  for (const key of NUMBER_FIELDS) {
    const value = raw[key];
    if (value === undefined) continue;
    updates[key] = value === null || value === '' ? null : Number(value);
  }
  for (const key of BOOLEAN_FIELDS) {
    const value = raw[key];
    if (value === undefined) continue;
    // Explicit true/"true" check rather than `Boolean(value)` -- the latter would coerce ANY
    // non-empty string (including the literal string "false") to `true`, which matters a lot for
    // `declaration_accepted`, a legally/procedurally meaningful gate on final submission.
    updates[key] = value === true || value === 'true';
  }
  for (const key of STRING_FIELDS) {
    const value = raw[key];
    if (value === undefined) continue;
    updates[key] = typeof value === 'string' ? value.trim() : value;
  }

  // Mirror the new `stage` selection into the legacy `revenue_status` column so older display
  // logic that branches on `revenue_status` keeps working for new-format rows too. Keyed on
  // whether `stage` was sent AT ALL this step (not its truthiness), so explicitly clearing it
  // still clears the mirrored column instead of leaving a stale value behind.
  if ('stage' in updates) {
    updates.revenue_status = updates.stage;
  }

  return updates;
}

// Fields returned to the client on a successful OTP resume, reusing the exact same allow-list
// this route already writes with -- it's precisely the set of columns ApplicationStepData covers.
const RESUMABLE_FIELDS = [...URL_FIELDS, ...NUMBER_FIELDS, ...BOOLEAN_FIELDS, ...STRING_FIELDS] as const;

function pickResumableFields(row: Record<string, any>): ApplicationStepData {
  const out: Record<string, any> = {};
  for (const key of RESUMABLE_FIELDS) {
    out[key] = row[key] ?? null;
  }
  return out as ApplicationStepData;
}

type ExistingApplicationResolution =
  | { kind: 'none' }
  | { kind: 'silentResume'; id: string; application_id: string; draftToken: string; lastCompletedStep: number }
  | { kind: 'conflict'; response: { success: false; existingDraftFound?: true; alreadySubmitted?: true; error: string } };

// One-application-per-email check used by the step-1 create branch, both before the INSERT (fast
// path) and again after a 23505 unique-violation (the actual race-safe enforcement). Always
// escapes the email before it reaches `.ilike()` -- passing it through raw would let a value like
// `%` or `%@somecompany.com` match every/many rows instead of the one exact address, turning an
// ownership check into an information-disclosure oracle.
//
// A match that never got past step 1 (just name/phone/role/referral -- nothing worth gating
// behind an email code) resolves as `silentResume`: the caller re-saves into that SAME row
// instead of blocking, so a second step-1 attempt with the same email (different browser, retry,
// whatever) just quietly continues -- no OTP, no "you already have one in progress" interruption.
// Only a match that reached step 2+ is treated as a real conflict requiring OTP-gated resume.
async function resolveExistingApplication(client: ReturnType<typeof getAdminSupabase>, submitterEmail: string): Promise<ExistingApplicationResolution> {
  const { data: existingRows, error: existingError } = await client
    .from('startups')
    .select('id, application_id, draft_token, status, last_completed_step')
    .ilike('submitter_email', escapeIlike(submitterEmail))
    .order('updated_at', { ascending: false })
    .limit(1);

  if (existingError || !existingRows || existingRows.length === 0) return { kind: 'none' };

  const existing = existingRows[0];
  if (existing.status === 'In Progress') {
    if ((existing.last_completed_step || 0) <= 1) {
      return {
        kind: 'silentResume',
        id: existing.id,
        application_id: existing.application_id,
        draftToken: existing.draft_token,
        lastCompletedStep: existing.last_completed_step || 0,
      };
    }
    return {
      kind: 'conflict',
      response: {
        success: false,
        existingDraftFound: true,
        error: 'You already have an application in progress with this email address.',
      },
    };
  }
  return {
    kind: 'conflict',
    response: {
      success: false,
      alreadySubmitted: true,
      error: "We've already received an application from this email address. Our team reviews every submission and will reach out if there's a fit.",
    },
  };
}

// Advisory-only duplicate-name pre-check (real enforcement is the DB-level
// `check_duplicate_startup` trigger, which runs regardless of this).
async function warnIfDuplicateCompanyName(client: ReturnType<typeof getAdminSupabase>, companyName: string, excludeId?: string) {
  try {
    let query = client.from('startups').select('id').ilike('company_name', companyName.trim());
    if (excludeId) query = query.neq('id', excludeId);
    const { data: existingStartup, error } = await query.maybeSingle();
    return !error && !!existingStartup;
  } catch (e) {
    console.warn('Duplicate verification query issue, continuing:', e);
    return false;
  }
}

router.post('/application/step', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const limitCheck = checkRateLimit(turnstileLimiter, ip, 20, 15 * 60 * 1000);
    if (!limitCheck.allowed) {
      const minutesLeft = Math.ceil(((limitCheck.resetAt || 0) - Date.now()) / 1000 / 60);
      return res.status(429).json({ success: false, error: `Too many attempts. Please try again in ${minutesLeft} minutes.` });
    }

    const { id, draftToken, step, data, turnstileToken } = req.body || {};
    const stepNum = Number(step);
    if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > 6) {
      return res.status(400).json({ success: false, error: 'Invalid step.' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Missing application data.' });
    }

    const isFinalStep = stepNum === 6;
    const updates = buildUpdates(data as ApplicationStepData);

    if (isFinalStep) {
      if (!turnstileToken) {
        return res.status(400).json({ success: false, error: 'Please complete the security verification (CAPTCHA) before submitting.' });
      }
      const verifyResult = await verifyTurnstileToken(turnstileToken, ip);
      if (!verifyResult.success) {
        return res.status(400).json({ success: false, error: verifyResult.error || 'Security verification failed. Please refresh and try again.' });
      }
    }

    // ---- No id yet: create the draft row ----
    if (!id) {
      if (isFinalStep) {
        return res.status(400).json({ success: false, error: 'No application in progress to submit.' });
      }

      // One application per email, enforced here at the very first save (step 1, where
      // submitter_email is collected). Needs the service-role client since anon has no SELECT
      // policy on startups -- we use it for this whole branch's insert too, not just the check.
      const adminClientForCreate = getAdminSupabase();
      const submitterEmail = String(updates.submitter_email || '').trim();

      // This SELECT-then-INSERT is only a fast-path/UX check, not the real enforcement -- two
      // concurrent step-1 requests for the same email could both pass it. The actual guarantee
      // is the unique index on lower(submitter_email) added in 14_resume_otp.sql; a race that
      // slips past this pre-check will fail the INSERT below with a 23505 violation instead.
      if (submitterEmail) {
        const resolution = await resolveExistingApplication(adminClientForCreate, submitterEmail);
        if (resolution.kind === 'conflict') return res.status(409).json(resolution.response);
        if (resolution.kind === 'silentResume') {
          const { error: resumeError } = await adminClientForCreate
            .from('startups')
            .update({ ...updates, last_completed_step: Math.max(stepNum, resolution.lastCompletedStep) })
            .eq('id', resolution.id)
            .eq('status', 'In Progress');
          if (resumeError) {
            console.error('Silent step-1 resume update failed:', resumeError);
            return res.status(500).json({ success: false, error: 'Your progress could not be saved. Please check the fields and try again.' });
          }
          return res.json({ success: true, id: resolution.id, application_id: resolution.application_id, draftToken: resolution.draftToken });
        }
      }

      const newId = randomUUID();
      const newDraftToken = randomUUID();

      const insertPayload: Record<string, any> = {
        ...updates,
        id: newId,
        draft_token: newDraftToken,
        status: 'In Progress',
        last_completed_step: stepNum,
      };

      // .select('application_id') round-trips the DB-generated MV#### value (see
      // 16_application_number.sql) in the same request, rather than needing a second query --
      // it's a GENERATED column, so it doesn't exist until Postgres computes it on insert.
      const { data: insertedRow, error: insertError } = await adminClientForCreate
        .from('startups')
        .insert(insertPayload)
        .select('application_id')
        .single();
      if (insertError) {
        console.error('Draft insert failed:', insertError);
        if (insertError.code === '23505' && insertError.message?.includes('submitter_email')) {
          // Lost the race against a concurrent step-1 request for the same email -- resolve it
          // exactly like the pre-check above would have, now that the winning row is committed.
          const resolution = submitterEmail
            ? await resolveExistingApplication(adminClientForCreate, submitterEmail)
            : { kind: 'none' as const };
          if (resolution.kind === 'silentResume') {
            const { error: resumeError } = await adminClientForCreate
              .from('startups')
              .update({ ...updates, last_completed_step: Math.max(stepNum, resolution.lastCompletedStep) })
              .eq('id', resolution.id)
              .eq('status', 'In Progress');
            if (resumeError) {
              console.error('Silent step-1 resume update failed (post-race):', resumeError);
              return res.status(500).json({ success: false, error: 'Your progress could not be saved. Please check the fields and try again.' });
            }
            return res.json({ success: true, id: resolution.id, application_id: resolution.application_id, draftToken: resolution.draftToken });
          }
          return res.status(409).json(
            resolution.kind === 'conflict' ? resolution.response : { success: false, error: 'An application with this email is already on file.' }
          );
        }
        if (insertError.message?.includes('already been submitted') || insertError.message?.includes('duplicate')) {
          return res.status(400).json({ success: false, error: insertError.message });
        }
        return res.status(500).json({ success: false, error: 'Your progress could not be saved. Please check the fields and try again.' });
      }

      return res.json({ success: true, id: newId, application_id: insertedRow?.application_id, draftToken: newDraftToken });
    }

    // ---- Updating an existing draft ----
    if (!draftToken) {
      return res.status(400).json({ success: false, error: 'Missing draft authorization.' });
    }

    const adminClient = getAdminSupabase();

    const { data: existing, error: fetchError } = await adminClient
      .from('startups')
      .select('*')
      .eq('id', id)
      .eq('draft_token', draftToken)
      .maybeSingle();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Application draft not found.' });
    }
    if (existing.status !== 'In Progress') {
      return res.status(409).json({ success: false, error: 'This application has already been submitted.' });
    }

    if (updates.company_name && await warnIfDuplicateCompanyName(adminClient, updates.company_name, id)) {
      return res.status(400).json({ success: false, error: `A startup application with the company name "${updates.company_name}" has already been submitted to our pipeline.` });
    }

    const finalUpdates: Record<string, any> = {
      ...updates,
      last_completed_step: Math.max(stepNum, existing.last_completed_step || 0),
    };

    if (isFinalStep) {
      const merged = { ...existing, ...finalUpdates };
      const missing = REQUIRED_FIELDS.filter(f => merged[f] === null || merged[f] === undefined || merged[f] === '');
      if (missing.length > 0 || !merged.declaration_accepted) {
        return res.status(400).json({ success: false, error: 'Missing required application fields.' });
      }
      finalUpdates.status = 'New';
      finalUpdates.submitted_at = new Date().toISOString();
    }

    // Re-asserting `status = 'In Progress'` here (not just on the SELECT above) closes a
    // check-then-act race: without it, a request that read 'In Progress' a moment ago could still
    // write to a row that a concurrent request has since finalized (or an admin has since moved in
    // the pipeline) in between. `.select('id')` lets us tell "0 rows matched" (lost the race) apart
    // from "matched and wrote" -- an `.update()` with no matching row otherwise reports no error.
    const { data: updatedRows, error: updateError } = await adminClient
      .from('startups')
      .update(finalUpdates)
      .eq('id', id)
      .eq('draft_token', draftToken)
      .eq('status', 'In Progress')
      .select('id');

    if (updateError) {
      console.error('Draft update failed:', updateError);
      if (updateError.message?.includes('already been submitted') || updateError.message?.includes('duplicate')) {
        return res.status(400).json({ success: false, error: updateError.message });
      }
      return res.status(500).json({ success: false, error: 'Your progress could not be saved. Please check the fields and try again.' });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return res.status(409).json({ success: false, error: 'This application has already been submitted.' });
    }

    // The 'tr_log_startup_completion' AFTER UPDATE database trigger logs the final submission to
    // audit_logs automatically once status flips to 'New' -- no application-side write needed.

    return res.json({ success: true, id, application_id: existing.application_id, draftToken });
  } catch (error: any) {
    console.error('Error in application/step:', error);
    return res.status(500).json({ success: false, error: error.message || 'An unexpected server error occurred.' });
  }
});

// -----------------------------------------------------------------------------------------------
// Resume-by-email-OTP. Two-step: request a 6-digit code, then verify it. Both are IP- and
// email-rate-limited separately (see rateLimiter.ts) since these are unauthenticated public
// endpoints that touch a mail-sending side effect and a brute-forceable numeric code.
// -----------------------------------------------------------------------------------------------

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

// Shape of the single row returned by the `verify_resume_otp` SQL function (14_resume_otp.sql).
// Not part of a generated Supabase Database type in this project, hence the manual interface.
interface VerifyOtpRpcResult {
  matched: boolean;
  ok: boolean;
  expired: boolean;
  locked: boolean;
  row_id: string | null;
}

router.post('/application/resume/request-otp', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ipCheck = checkRateLimit(otpIpLimiter, ip, 8, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    const emailCheck = checkRateLimit(otpEmailLimiter, email.toLowerCase(), 3, 60 * 60 * 1000);
    if (!emailCheck.allowed) {
      return res.status(429).json({ success: false, error: 'Too many codes requested for this email. Please try again later.' });
    }

    const adminClient = getAdminSupabase();
    const { data: rows, error: lookupError } = await adminClient
      .from('startups')
      .select('id')
      .ilike('submitter_email', escapeIlike(email))
      .eq('status', 'In Progress')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (lookupError) {
      // Logged for ops visibility, but still falls through to the same generic response below --
      // never let a DB error reveal (via a different response) whether a match exists.
      console.error('[resume-otp] Lookup failed:', lookupError);
    }

    // Always respond the same way whether or not a match was found -- otherwise this endpoint
    // could be used to enumerate which email addresses have an application on file. We also never
    // `await` the mail send below before responding: the SMTP round-trip is by far the biggest
    // source of a timing difference between "found" and "not found," so blocking the response on
    // it would leak exactly what the identical JSON body is trying to hide.
    if (rows && rows.length > 0) {
      const otp = String(randomInt(0, 1000000)).padStart(6, '0');
      const { error: storeError } = await adminClient
        .from('startups')
        .update({
          resume_otp_hash: hashOtp(otp),
          resume_otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
          resume_otp_attempts: 0,
        })
        .eq('id', rows[0].id);

      if (storeError) {
        // Don't send a code that could never verify (the hash never made it to the DB).
        console.error('[resume-otp] Failed to store OTP hash:', storeError);
      } else {
        void sendResumeOtpEmail(email, otp).catch((mailErr) => {
          console.error('[resume-otp] Failed to send OTP email:', mailErr);
        });
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error in resume/request-otp:', error);
    return res.status(500).json({ success: false, error: error.message || 'An unexpected server error occurred.' });
  }
});

router.post('/application/resume/verify-otp', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ipCheck = checkRateLimit(otpIpLimiter, ip, 15, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please try again later.' });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    if (!email || !EMAIL_PATTERN.test(email) || !otp) {
      return res.status(400).json({ success: false, error: 'A valid email and code are required.' });
    }

    // Separate from request-otp's own budget (see rateLimiter.ts) but the same underlying store,
    // so guess-bursts against one email eat into that email's future request-otp allowance too --
    // intentionally conservative, never looser.
    const emailCheck = checkRateLimit(otpEmailLimiter, email.toLowerCase(), 10, 60 * 60 * 1000);
    if (!emailCheck.allowed) {
      return res.status(429).json({ success: false, error: 'Too many attempts for this email. Please try again later.' });
    }

    const adminClient = getAdminSupabase();

    // The lookup, expiry/lockout check, and attempts-increment-or-clear all happen atomically in
    // one DB statement (see verify_resume_otp in 14_resume_otp.sql) -- both to avoid a
    // non-atomic-counter race that lets parallel guesses exceed the 5-attempt lockout, and because
    // it matches by exact `lower(email) = lower(p_email)` rather than a `.ilike()` pattern, closing
    // off the wildcard-based "match whichever row currently has a live OTP" attack a raw ILIKE
    // lookup here would otherwise allow.
    const { data: rpcResult, error: rpcError } = (await adminClient
      .rpc('verify_resume_otp', { p_email: email, p_otp_hash: hashOtp(otp) })
      .maybeSingle()) as unknown as { data: VerifyOtpRpcResult | null; error: { message: string } | null };

    if (rpcError) {
      console.error('[resume-otp] verify_resume_otp RPC failed:', rpcError);
      return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
    }

    if (!rpcResult || !rpcResult.matched) {
      return res.status(400).json({ success: false, error: 'Incorrect code, or no code was requested for this email.' });
    }
    if (rpcResult.expired) {
      return res.status(400).json({ success: false, error: 'This code has expired. Please request a new one.' });
    }
    if (rpcResult.locked) {
      return res.status(400).json({ success: false, error: 'Too many incorrect attempts. Please request a new code.' });
    }
    if (!rpcResult.ok) {
      return res.status(400).json({ success: false, error: 'Incorrect code.' });
    }

    const { data: row, error: fetchError } = await adminClient
      .from('startups')
      .select('*')
      .eq('id', rpcResult.row_id)
      .maybeSingle();

    if (fetchError || !row) {
      console.error('[resume-otp] Post-verify row fetch failed:', fetchError);
      return res.status(500).json({ success: false, error: 'An unexpected server error occurred.' });
    }

    return res.json({
      success: true,
      id: row.id,
      application_id: row.application_id,
      draftToken: row.draft_token,
      currentStep: row.last_completed_step,
      data: pickResumableFields(row),
    });
  } catch (error: any) {
    console.error('Error in resume/verify-otp:', error);
    return res.status(500).json({ success: false, error: error.message || 'An unexpected server error occurred.' });
  }
});

export default router;
