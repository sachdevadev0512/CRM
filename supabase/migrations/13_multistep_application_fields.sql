-- ============================================================================
-- MIDDHA VENTURES CRM - MULTI-STEP APPLICATION FORM SUPPORT (13_multistep_application_fields.sql)
-- ============================================================================
-- Adds the columns needed for the 6-step public application form:
--   1. New, dedicated columns for fields the old form only ever crammed into
--      free-text blobs (description/team_background/traction), plus genuinely
--      new fields (previous round, valuation, burn, per-year revenue, etc.).
--   2. Draft/progress bookkeeping so a partially-filled application can be
--      saved after each step and distinguished from a completed submission.
--   3. Relaxes NOT NULL / CHECK constraints that would otherwise block an
--      intentionally incomplete draft row from being inserted.
--   4. Extends the duplicate-name guard to also cover UPDATEs (a draft's
--      company name is set/edited after the row already exists), and splits
--      the "Application submitted" audit log so it fires once, on actual
--      completion, rather than once per draft row.
--
-- This migration is purely additive: no existing column is dropped or
-- renamed, so applications submitted before this change keep rendering
-- exactly as they do today.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NEW COLUMNS
-- ----------------------------------------------------------------------------
ALTER TABLE public.startups
    -- Step 1: About You (the person submitting -- may differ from the founder,
    -- e.g. an investment banker or mentor applying on a startup's behalf)
    ADD COLUMN IF NOT EXISTS submitter_name TEXT,
    ADD COLUMN IF NOT EXISTS submitter_phone TEXT,
    ADD COLUMN IF NOT EXISTS submitter_email TEXT,
    ADD COLUMN IF NOT EXISTS submitter_role TEXT,
    ADD COLUMN IF NOT EXISTS referral_source TEXT,

    -- Step 2: Startup Basics -- additions alongside existing founder_name/founder_email/founder_linkedin
    ADD COLUMN IF NOT EXISTS founder_phone TEXT,
    ADD COLUMN IF NOT EXISTS company_linkedin TEXT,
    ADD COLUMN IF NOT EXISTS sector_other TEXT,

    -- Step 4: The Business -- structured replacements for the old concatenated blobs
    ADD COLUMN IF NOT EXISTS problem_statement TEXT,
    ADD COLUMN IF NOT EXISTS proposed_solution TEXT,
    ADD COLUMN IF NOT EXISTS target_audience TEXT,
    ADD COLUMN IF NOT EXISTS revenue_model TEXT,

    -- Step 5: Traction & Financials
    ADD COLUMN IF NOT EXISTS current_customers INTEGER,
    ADD COLUMN IF NOT EXISTS monthly_burn NUMERIC,
    ADD COLUMN IF NOT EXISTS revenue_fy_2425 NUMERIC,
    ADD COLUMN IF NOT EXISTS revenue_fy_2526 NUMERIC,
    ADD COLUMN IF NOT EXISTS revenue_fy_2627 NUMERIC,

    -- Step 3: Stage & Funding -- previous round + current valuation
    ADD COLUMN IF NOT EXISTS raised_before BOOLEAN,
    ADD COLUMN IF NOT EXISTS previous_round_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS previous_round_valuation NUMERIC,
    ADD COLUMN IF NOT EXISTS previous_round_date TEXT,
    ADD COLUMN IF NOT EXISTS current_valuation NUMERIC,

    -- Step 6: Pitch Deck & Declaration
    -- (the existing nullable `demo_video` column is repurposed as the optional
    -- "Additional Material" link going forward -- no schema change needed for it)
    ADD COLUMN IF NOT EXISTS pitch_deck_link TEXT,
    ADD COLUMN IF NOT EXISTS declaration_accepted BOOLEAN NOT NULL DEFAULT false,

    -- Draft / multi-step progress bookkeeping
    ADD COLUMN IF NOT EXISTS draft_token UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS last_completed_step INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.startups.status IS
    'Pipeline stage: New, Screening, Meeting, Due Diligence, Approved, Rejected, Archived -- plus "In Progress" for an application the applicant has not finished submitting yet.';

COMMENT ON COLUMN public.startups.draft_token IS
    'Server-issued secret required (alongside id) to PATCH a draft (status = ''In Progress'') row from the public form. Never exposed to the admin UI.';

-- ----------------------------------------------------------------------------
-- 2. RELAX NOT NULL ON COLUMNS A DRAFT ROW WON'T HAVE YET
-- ----------------------------------------------------------------------------
ALTER TABLE public.startups
    ALTER COLUMN company_name DROP NOT NULL,
    ALTER COLUMN one_line_pitch DROP NOT NULL,
    ALTER COLUMN description DROP NOT NULL,
    ALTER COLUMN hq_location DROP NOT NULL,
    ALTER COLUMN sector DROP NOT NULL,
    ALTER COLUMN founder_name DROP NOT NULL,
    ALTER COLUMN founder_email DROP NOT NULL,
    ALTER COLUMN team_size DROP NOT NULL,
    ALTER COLUMN team_background DROP NOT NULL,
    ALTER COLUMN stage DROP NOT NULL,
    ALTER COLUMN target_raise DROP NOT NULL,
    ALTER COLUMN traction DROP NOT NULL,
    ALTER COLUMN pitch_deck_path DROP NOT NULL;

-- Give pitch_deck_path a default of '' so legacy code/reads that assume a string
-- (never NULL) keep working; new-format rows never use this column anyway.
ALTER TABLE public.startups ALTER COLUMN pitch_deck_path SET DEFAULT '';

-- ----------------------------------------------------------------------------
-- 3. UPDATE EXISTING CHECK CONSTRAINTS TO TOLERATE NULL, ADD NEW ONES
-- ----------------------------------------------------------------------------
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_team_size;
ALTER TABLE public.startups ADD CONSTRAINT chk_team_size
    CHECK (team_size IS NULL OR team_size > 0);

ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_target_raise;
ALTER TABLE public.startups ADD CONSTRAINT chk_target_raise
    CHECK (target_raise IS NULL OR target_raise > 0);

ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_description_len;
ALTER TABLE public.startups ADD CONSTRAINT chk_description_len
    CHECK (description IS NULL OR char_length(description) <= 5000);

-- chk_funding_raised, chk_website_url, chk_founder_linkedin_url, chk_demo_video_url
-- already tolerate NULL/empty (funding_raised has a NOT NULL default of 0; the
-- others were already written with an `IS NULL OR ...` / nullable-column form) --
-- left untouched.

-- Each dropped first (IF EXISTS) so this whole file can be re-run safely -- e.g. after a partial
-- failure elsewhere in the script, or just to be certain everything landed. Without this guard, a
-- second run fails on the very first ADD CONSTRAINT here with a plain "already exists" error and
-- aborts before the rest of this statement (or, depending on the client, the rest of the script)
-- ever runs -- which is exactly what happened before this fix.
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_pitch_deck_link_url;
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_current_customers_nonneg;
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_monthly_burn_nonneg;
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_revenue_fy_nonneg;
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_previous_round_nonneg;
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_current_valuation_nonneg;
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_last_completed_step_range;

ALTER TABLE public.startups
    ADD CONSTRAINT chk_pitch_deck_link_url
        CHECK (pitch_deck_link IS NULL OR pitch_deck_link = '' OR pitch_deck_link ~* '^https?://'),
    ADD CONSTRAINT chk_current_customers_nonneg
        CHECK (current_customers IS NULL OR current_customers >= 0),
    ADD CONSTRAINT chk_monthly_burn_nonneg
        CHECK (monthly_burn IS NULL OR monthly_burn >= 0),
    ADD CONSTRAINT chk_revenue_fy_nonneg
        CHECK (
            (revenue_fy_2425 IS NULL OR revenue_fy_2425 >= 0) AND
            (revenue_fy_2526 IS NULL OR revenue_fy_2526 >= 0) AND
            (revenue_fy_2627 IS NULL OR revenue_fy_2627 >= 0)
        ),
    ADD CONSTRAINT chk_previous_round_nonneg
        CHECK (
            (previous_round_amount IS NULL OR previous_round_amount >= 0) AND
            (previous_round_valuation IS NULL OR previous_round_valuation >= 0)
        ),
    ADD CONSTRAINT chk_current_valuation_nonneg
        CHECK (current_valuation IS NULL OR current_valuation >= 0),
    ADD CONSTRAINT chk_last_completed_step_range
        CHECK (last_completed_step BETWEEN 0 AND 6);

-- ----------------------------------------------------------------------------
-- 4. EXTEND DUPLICATE-NAME GUARD TO ALSO FIRE ON UPDATE OF company_name
-- ----------------------------------------------------------------------------
-- A draft can be created (INSERT) before company_name is known, then have it
-- set/edited via UPDATE on a later step -- the original trigger only ran
-- BEFORE INSERT, so that later UPDATE was never checked for duplicates.
CREATE OR REPLACE FUNCTION public.check_duplicate_startup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.company_name IS NULL OR TRIM(NEW.company_name) = '' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.company_name IS NOT NULL
        AND LOWER(TRIM(OLD.company_name)) = LOWER(TRIM(NEW.company_name)) THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.startups
        WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(NEW.company_name))
          AND id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'A startup application with the company name "%" has already been submitted to our pipeline.', NEW.company_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_check_duplicate_startup ON public.startups;
CREATE TRIGGER tr_check_duplicate_startup
    BEFORE INSERT OR UPDATE OF company_name ON public.startups
    FOR EACH ROW EXECUTE FUNCTION public.check_duplicate_startup();

-- ----------------------------------------------------------------------------
-- 5. SPLIT "APPLICATION SUBMITTED" AUDIT LOGGING: LOG ONCE, ON COMPLETION
-- ----------------------------------------------------------------------------
-- Previously this only ever ran AFTER INSERT, which was fine when every insert
-- was a completed submission. Now a row can be INSERTed as a draft
-- (status = 'In Progress') well before it's actually submitted. Re-scope the
-- existing trigger to only log direct inserts that are already 'New', and add
-- a companion AFTER UPDATE trigger that logs exactly once, the moment a draft
-- transitions into 'New'.
DROP TRIGGER IF EXISTS tr_log_startup_submission ON public.startups;
CREATE TRIGGER tr_log_startup_submission
    AFTER INSERT ON public.startups
    FOR EACH ROW WHEN (NEW.status = 'New')
    EXECUTE FUNCTION public.log_startup_submission();

DROP TRIGGER IF EXISTS tr_log_startup_completion ON public.startups;
CREATE TRIGGER tr_log_startup_completion
    AFTER UPDATE ON public.startups
    FOR EACH ROW WHEN (NEW.status = 'New' AND OLD.status IS DISTINCT FROM 'New')
    EXECUTE FUNCTION public.log_startup_submission();
