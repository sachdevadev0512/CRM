-- ============================================================================
-- MIDDHA VENTURES CRM - ALLOW NULL FOR WEBSITE AND FOUNDER LINKEDIN
-- ============================================================================

-- Alter startups table to allow NULL for website and founder_linkedin
ALTER TABLE public.startups
    ALTER COLUMN website DROP NOT NULL,
    ALTER COLUMN founder_linkedin DROP NOT NULL,
    RENAME COLUMN current_revenue TO revenue_generated_fy25;

