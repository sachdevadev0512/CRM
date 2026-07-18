-- ============================================================================
-- MIDDHA VENTURES CRM - AUTOMATED ADMINISTRATOR SYNCHRONIZATION (06_auto_admin_sync.sql)
-- ============================================================================
-- This migration automates administrator authorization by creating a database trigger
-- on auth.users. Whenever a user is registered or created in Supabase Auth, they are
-- automatically added to the public.admins table. It also includes a one-time sync
-- query to automatically authorize existing users.
-- ============================================================================

-- 1. Create a trigger function to automatically sync new auth.users to public.admins
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.admins (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to the auth.users table
DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Perform a one-time sync of any pre-existing users in auth.users to public.admins
-- (Specifically synchronizes initial administrator and other existing users)
INSERT INTO public.admins (id, email, created_at, updated_at)
SELECT id, email, created_at, updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
