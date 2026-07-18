-- ============================================================================
-- MIDDHA VENTURES CRM - SECURITY AUDIT REMEDIATION MIGRATION (03_security_fixes.sql)
-- ============================================================================
-- This migration script addresses all vulnerabilities identified in the audit report.
-- It eliminates bootstrap race conditions, secures storage uploads, enforces
-- database CHECK constraints, moves duplicate checking to a secure trigger,
-- and creates a single-use secure invite-token system.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ELIMINATE ADMIN BOOTSTRAP RACE CONDITION
-- ----------------------------------------------------------------------------
-- Revoke the race-prone "Allow bootstrap admin" policy completely.
-- Direct bootstrap must now be run out-of-band directly in the SQL Editor.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow bootstrap admin" ON public.admins;

-- ----------------------------------------------------------------------------
-- 2. HARDEN STARTUPS DATABASE CONSTRAINTS
-- ----------------------------------------------------------------------------
-- Add CHECK constraints for numbers and length validation.
-- Add URL constraints to prevent stored XSS (javascript: links) at the db level.
-- ----------------------------------------------------------------------------
ALTER TABLE public.startups
    ADD CONSTRAINT chk_team_size CHECK (team_size > 0),
    ADD CONSTRAINT chk_target_raise CHECK (target_raise > 0),
    ADD CONSTRAINT chk_funding_raised CHECK (funding_raised >= 0),
    ADD CONSTRAINT chk_description_len CHECK (char_length(description) <= 5000),
    ADD CONSTRAINT chk_website_url CHECK (website ~* '^https?://'),
    ADD CONSTRAINT chk_founder_linkedin_url CHECK (founder_linkedin ~* '^https?://([a-z]{2,3}\.)?linkedin\.com/'),
    ADD CONSTRAINT chk_demo_video_url CHECK (demo_video IS NULL OR demo_video = '' OR demo_video ~* '^https?://');

-- ----------------------------------------------------------------------------
-- 3. STORAGE BUCKET HARDENING
-- ----------------------------------------------------------------------------
-- Enforce allowed MIME types and 50MB file size limits on 'pitch-decks' bucket.
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
],
file_size_limit = 52428800 -- 50MB
WHERE id = 'pitch-decks';

-- ----------------------------------------------------------------------------
-- 4. DATABASE-LEVEL DUPLICATE-COMPANY PROTECTION
-- ----------------------------------------------------------------------------
-- Move the duplicate-name check into a BEFORE INSERT trigger running with
-- SECURITY DEFINER so that it works reliably regardless of user SELECT permission.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_duplicate_startup()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.startups
        WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(NEW.company_name))
    ) THEN
        RAISE EXCEPTION 'A startup application with the company name "%" has already been submitted to our pipeline.', NEW.company_name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_duplicate_startup ON public.startups;
CREATE TRIGGER tr_check_duplicate_startup
    BEFORE INSERT ON public.startups
    FOR EACH ROW EXECUTE FUNCTION public.check_duplicate_startup();

-- ----------------------------------------------------------------------------
-- 5. SECURE SINGLE-USE ADMIN INVITATION & TOKEN SYSTEM
-- ----------------------------------------------------------------------------
-- Creates the admin_invites table to handle secure admin registrations out-of-band.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false NOT NULL
);

-- Index on token for instant lookups
CREATE INDEX IF NOT EXISTS idx_admin_invites_token ON public.admin_invites(token);

-- Enable RLS on admin_invites
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Registered admins have full control over invites
DROP POLICY IF EXISTS "Admins full access to invites" ON public.admin_invites;
CREATE POLICY "Admins full access to invites" ON public.admin_invites
    FOR ALL USING (public.is_admin());

-- Allow anyone SELECT access on invites so they can verify a token before login
DROP POLICY IF EXISTS "Verify invite token SELECT" ON public.admin_invites;
CREATE POLICY "Verify invite token SELECT" ON public.admin_invites
    FOR SELECT USING (NOT used AND expires_at > now());

-- ----------------------------------------------------------------------------
-- 6. RPC TO SECURELY VERIFY PENDING ADMIN ACTION
-- ----------------------------------------------------------------------------
-- Runs with SECURITY DEFINER to safely read auth.users and verify the requested ID
-- exists and is not already registered as an admin.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_pending_admin_request(p_id UUID)
RETURNS TABLE (valid BOOLEAN, email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM auth.users WHERE id = p_id) AND NOT EXISTS(SELECT 1 FROM public.admins WHERE id = p_id) AS valid,
        u.email::TEXT
    FROM auth.users u
    WHERE u.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 7. RPC TO CLAIM AN INVITE & PROMOTE ACCOUNT TO ADMIN
-- ----------------------------------------------------------------------------
-- Securely claims an invitation token and updates public.admins.
-- Runs with SECURITY DEFINER so that the authenticated claiming user can insert
-- into the admins table under transactional verification.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_admin_invite(p_token TEXT, p_uid UUID, p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_invite_id UUID;
    v_invited_email TEXT;
BEGIN
    -- Check if token is valid, unused, and not expired
    SELECT id, email INTO v_invite_id, v_invited_email
    FROM public.admin_invites
    WHERE token = p_token AND NOT used AND expires_at > now();

    IF v_invite_id IS NULL THEN
        RAISE EXCEPTION 'Invalid, expired, or already claimed invitation token.';
    END IF;

    -- Verify that the claiming user's email matches the invited email exactly
    IF LOWER(TRIM(p_email)) != LOWER(TRIM(v_invited_email)) THEN
        RAISE EXCEPTION 'This invitation token belongs to % but you are logged in as %.', v_invited_email, p_email;
    END IF;

    -- Mark token as used
    UPDATE public.admin_invites
    SET used = TRUE
    WHERE id = v_invite_id;

    -- Insert into public.admins
    INSERT INTO public.admins (id, email)
    VALUES (p_uid, p_email)
    ON CONFLICT (id) DO UPDATE SET email = p_email;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
