-- ============================================================================
-- MIDDHA VENTURES CRM - EMAIL+OTP APPLICATION RESUME (14_resume_otp.sql)
-- ============================================================================
-- Lets an applicant resume a saved-but-unfinished (status = 'In Progress')
-- application from any browser/device by verifying a one-time code sent to
-- the submitter's email (in addition to the existing same-browser localStorage
-- resume, which still works unchanged). Also backs the "one application per
-- email" duplicate guard enforced in the step-1 save path.
-- ============================================================================

ALTER TABLE public.startups
    ADD COLUMN IF NOT EXISTS resume_otp_hash TEXT,
    ADD COLUMN IF NOT EXISTS resume_otp_expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS resume_otp_attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.startups.resume_otp_hash IS
    'SHA-256 hash of the current 6-digit resume OTP, if one has been issued and not yet used/expired. Never the plaintext code.';

-- Plain index on submitter_email to keep the step-1 duplicate-application pre-check reasonably
-- fast as the table grows (the real enforcement is the unique index below; this one just speeds
-- up the ILIKE-based lookup the application code also uses to decide *which* conflict message to
-- show -- "resume this" vs. "already submitted").
CREATE INDEX IF NOT EXISTS idx_startups_submitter_email ON public.startups (submitter_email);

-- Real enforcement of "one application per email," at the database level. The application-code
-- SELECT-then-INSERT check in publicForm.ts is only a fast/friendly pre-check -- without this
-- constraint, two concurrent step-1 submissions for the same email could both pass that check and
-- both insert, silently producing two rows for one applicant. Case-insensitive (mirrors the
-- ILIKE-based lookups elsewhere) and excludes NULL/blank so legacy pre-multistep rows (which have
-- no submitter_email at all) never collide with each other or with new submissions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_startups_submitter_email_unique
    ON public.startups (lower(submitter_email))
    WHERE submitter_email IS NOT NULL AND submitter_email <> '';

-- ----------------------------------------------------------------------------
-- Atomic OTP verification.
-- ----------------------------------------------------------------------------
-- Doing the lookup + expiry/lockout check + attempts-increment/clear as ONE statement inside a
-- SECURITY DEFINER function (with `FOR UPDATE` row-locking the candidate row for the duration of
-- the transaction) closes two problems the equivalent multi-query application-code version had:
--   1. A non-atomic "read attempts, then write attempts+1" is racy -- concurrent guesses fired in
--      parallel can each read the same starting count, letting an attacker get far more than 5
--      real guesses at the 6-digit code before the lockout counter catches up.
--   2. Doing the lookup with `.ilike('submitter_email', <raw input>)` (as the very first version
--      of this endpoint did) let a value like `%` match *any* row with a live OTP, regardless of
--      whose email was supplied -- an attacker didn't need to know a target's email at all. This
--      function uses exact `lower(email) = lower(p_email)` equality instead, so there is no
--      pattern-matching surface at all here.
-- The Express route (`/application/resume/verify-otp`) calls this once via `.rpc()` and maps its
-- flags onto the appropriate HTTP response; it never touches `resume_otp_*` directly itself.
CREATE OR REPLACE FUNCTION public.verify_resume_otp(p_email TEXT, p_otp_hash TEXT)
RETURNS TABLE (matched BOOLEAN, ok BOOLEAN, expired BOOLEAN, locked BOOLEAN, row_id UUID)
AS $$
DECLARE
    v_id UUID;
    v_hash TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_attempts INTEGER;
BEGIN
    SELECT id, resume_otp_hash, resume_otp_expires_at, resume_otp_attempts
    INTO v_id, v_hash, v_expires_at, v_attempts
    FROM public.startups
    WHERE lower(submitter_email) = lower(p_email)
      AND status = 'In Progress'
      AND resume_otp_hash IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_id IS NULL THEN
        RETURN QUERY SELECT false, false, false, false, NULL::UUID;
        RETURN;
    END IF;

    IF v_expires_at IS NULL OR v_expires_at < now() THEN
        RETURN QUERY SELECT true, false, true, false, v_id;
        RETURN;
    END IF;

    IF v_attempts >= 5 THEN
        UPDATE public.startups SET resume_otp_hash = NULL, resume_otp_expires_at = NULL WHERE id = v_id;
        RETURN QUERY SELECT true, false, false, true, v_id;
        RETURN;
    END IF;

    IF v_hash IS DISTINCT FROM p_otp_hash THEN
        UPDATE public.startups SET resume_otp_attempts = resume_otp_attempts + 1 WHERE id = v_id;
        RETURN QUERY SELECT true, false, false, false, v_id;
        RETURN;
    END IF;

    -- Correct code: clear it now (single-use) before returning success.
    UPDATE public.startups
    SET resume_otp_hash = NULL, resume_otp_expires_at = NULL, resume_otp_attempts = 0
    WHERE id = v_id;
    RETURN QUERY SELECT true, true, false, false, v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
