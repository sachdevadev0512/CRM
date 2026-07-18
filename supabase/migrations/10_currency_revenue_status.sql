-- ============================================================================
-- MIDDHA VENTURES CRM - CURRENCY & REVENUE STATUS ADDITIONS
-- ============================================================================

-- Add new columns for currency selection, revenue status, current revenue, and current financial year revenue
ALTER TABLE public.startups
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR' NOT NULL,
    ADD COLUMN IF NOT EXISTS revenue_status TEXT DEFAULT 'Pre-Revenue' NOT NULL,
    ADD COLUMN IF NOT EXISTS current_revenue NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS current_financial_year_revenue NUMERIC DEFAULT NULL;

-- Relax the founder_linkedin constraint to allow optional empty / NULL values
ALTER TABLE public.startups DROP CONSTRAINT IF EXISTS chk_founder_linkedin_url;
ALTER TABLE public.startups
    ADD CONSTRAINT chk_founder_linkedin_url CHECK (founder_linkedin IS NULL OR founder_linkedin = '' OR founder_linkedin ~* '^https?://([a-z]{2,3}\.)?linkedin\.com/');
