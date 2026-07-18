-- ============================================================================
-- MIDDHA VENTURES CRM - CRITICAL SECURITY & COMPLIANCE FIXES (07_critical_security_fixes.sql)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REMOVE AUTO-ADMIN-SYNC PRIVILEGE ESCALATION
-- ----------------------------------------------------------------------------
-- Drop the trigger that automatically promoted every registered auth.users row
-- into public.admins (which granted full administrative access to anonymous users).
-- Also clean up the trigger function.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Clean up any damage by deleting rows from public.admins whose corresponding
-- auth.users.id is an anonymous user, guarded by is_anonymous column check.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
          AND table_name = 'users' 
          AND column_name = 'is_anonymous'
    ) THEN
        EXECUTE 'DELETE FROM public.admins WHERE id IN (SELECT id FROM auth.users WHERE is_anonymous = true)';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PREVENT ADMIN SELF-LOCKOUT AT DATABASE LAYER
-- ----------------------------------------------------------------------------
-- Enforce that administrators cannot delete themselves, and they cannot delete
-- the last remaining administrator in the system.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_admin_lockout()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
BEGIN
    -- Check if the operating user is attempting to delete their own record
    IF OLD.id = auth.uid() THEN
        RAISE EXCEPTION 'Admin was not removed. This is either not permitted (you cannot revoke your own access or remove the last remaining admin) or the required database policy is missing — see supabase/migrations/03_security_fixes.sql.';
    END IF;

    -- Check if deleting this record would leave zero administrators
    SELECT COUNT(*) INTO admin_count FROM public.admins;
    IF admin_count <= 1 THEN
        RAISE EXCEPTION 'Admin was not removed. This is either not permitted (you cannot revoke your own access or remove the last remaining admin) or the required database policy is missing — see supabase/migrations/03_security_fixes.sql.';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_admin_lockout ON public.admins;
CREATE TRIGGER tr_prevent_admin_lockout
    BEFORE DELETE ON public.admins
    FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_lockout();

-- ----------------------------------------------------------------------------
-- 3. PRESERVE REVIEWER NOTES WHEN AN ADMINISTRATOR IS REVOKED
-- ----------------------------------------------------------------------------
-- Make the notes.author_id column nullable and change its foreign key constraint
-- from ON DELETE CASCADE to ON DELETE SET NULL to prevent deleting notes when 
-- an admin is revoked.
-- ----------------------------------------------------------------------------
ALTER TABLE public.notes ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_author_id_fkey;

ALTER TABLE public.notes
    ADD CONSTRAINT notes_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES public.admins(id)
    ON DELETE SET NULL;
