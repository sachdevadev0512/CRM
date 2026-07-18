-- ============================================================================
-- MIDDHA VENTURES CRM - SECURITY, Scalability, and UUID Improvements Migration
-- ============================================================================
-- This migration script applies key updates to improve database consistency,
-- secure audit logging, control admin privilege escalation, and restrict
-- storage uploads. It is designed to be idempotent (safe to run multiple times).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. UUID GENERATION CONSISTENCY
-- ----------------------------------------------------------------------------
-- Description: Enables the pgcrypto extension to ensure that the default
-- gen_random_uuid() function is consistently and natively supported across
-- all PostgreSQL clusters, without altering the existing tables.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 2. ADMIN CREATION (BOOTSTRAP + FUTURE ADMINS)
-- ----------------------------------------------------------------------------
-- Description: Retains the initial "Allow bootstrap admin" policy for when
-- the admins table is empty. Adds an explicit RLS policy to allow authenticated,
-- existing admins to register/insert new admin rows, while preventing any non-admin
-- users from doing so, thereby preventing unauthorized privilege escalation.
-- ----------------------------------------------------------------------------

-- Ensure the existing bootstrap policy is intact (or recreate it safely)
DROP POLICY IF EXISTS "Allow bootstrap admin" ON public.admins;
CREATE POLICY "Allow bootstrap admin" ON public.admins
    FOR INSERT WITH CHECK (
        (SELECT count(*) FROM public.admins) = 0
        AND id = auth.uid()
    );

-- Add policy to allow registered admins to invite/add other admins
DROP POLICY IF EXISTS "Admins insert access" ON public.admins;
CREATE POLICY "Admins insert access" ON public.admins
    FOR INSERT WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. SECURE AUDIT LOGS
-- ----------------------------------------------------------------------------
-- Description: Revokes public direct write access on the audit_logs table to
-- prevent anonymous users or malicious actors from injecting fake audit records.
-- Direct inserts are restricted to authenticated admins. To safely log public
-- application submissions, a secure database trigger (SECURITY DEFINER) is
-- attached to the startups table to log the submissions automatically.
-- ----------------------------------------------------------------------------

-- Revoke insecure public direct access to audit logs
DROP POLICY IF EXISTS "Public insert audit logs" ON public.audit_logs;

-- Allow authenticated admins to log client-side actions (status updates, deletes, notes, etc.)
DROP POLICY IF EXISTS "Admin insert audit logs" ON public.audit_logs;
CREATE POLICY "Admin insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (public.is_admin());

-- Database-level trigger to securely log anonymous startup submissions
CREATE OR REPLACE FUNCTION public.log_startup_submission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, user_email, action, target_id, target_name, details)
    VALUES (
        auth.uid(), -- Will be NULL if submitted by an anonymous guest visitor
        NEW.founder_email,
        'Application submitted',
        NEW.id,
        NEW.company_name,
        jsonb_build_object(
            'sector', NEW.sector,
            'target_raise', NEW.target_raise,
            'stage', NEW.stage,
            'logged_by', 'system_trigger'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to startups table
DROP TRIGGER IF EXISTS tr_log_startup_submission ON public.startups;
CREATE TRIGGER tr_log_startup_submission
    AFTER INSERT ON public.startups
    FOR EACH ROW EXECUTE FUNCTION public.log_startup_submission();

-- ----------------------------------------------------------------------------
-- 4. SECURE STORAGE UPLOADS
-- ----------------------------------------------------------------------------
-- Description: Disallows anonymous public file uploads to the 'pitch-decks' bucket.
-- Restricts uploads exclusively to authenticated users (e.g. registered founders
-- or prospective admins). Admins retain full read/write/delete access to all objects.
-- ----------------------------------------------------------------------------

-- Revoke anyone-can-upload public access policy
DROP POLICY IF EXISTS "Allow public upload to pitch decks" ON storage.objects;

-- Create secure policy restricting upload to authenticated users only
DROP POLICY IF EXISTS "Allow authenticated upload to pitch decks" ON storage.objects;
CREATE POLICY "Allow authenticated upload to pitch decks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pitch-decks');
