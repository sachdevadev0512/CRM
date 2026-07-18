-- ============================================================================
-- MIDDHA VENTURES CRM - ADMINISTRATOR AUTHENTICATION REFACTOR (04_admin_direct_creation.sql)
-- ============================================================================
-- This migration refactors the administrator invitation flow to a standard
-- direct administrator creation flow. It removes the legacy invite token/link
-- system entirely and provides a secure, atomic backend RPC function for
-- creating new administrators.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CLEANUP LEGACY INVITATION SYSTEM OBJECTS
-- ----------------------------------------------------------------------------
-- Safely drop legacy table. Dropping the table automatically cascades to drop its
-- policies. Using IF EXISTS ensures this is 100% safe to execute even if the table
-- does not exist, avoiding PostgreSQL relation-not-found errors.
DROP TABLE IF EXISTS public.admin_invites CASCADE;
DROP FUNCTION IF EXISTS public.verify_pending_admin_request(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.claim_admin_invite(TEXT, UUID, TEXT) CASCADE;

-- ----------------------------------------------------------------------------
-- 2. CREATE SECURE ADMIN DIRECT CREATION RPC
-- ----------------------------------------------------------------------------
-- This function runs with SECURITY DEFINER to securely insert rows into auth.users
-- and public.admins atomically. Only authenticated administrators are permitted to
-- run this function.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_new_admin_user(p_email TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
    v_encrypted_password TEXT;
    v_operator_email TEXT;
BEGIN
    -- 1. Validate permissions: only authenticated administrators may create new administrators
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Only active administrators can create new administrators.';
    END IF;

    -- Retrieve the operator's email for the audit logs
    SELECT email INTO v_operator_email FROM public.admins WHERE id = auth.uid();

    -- 2. Validate inputs
    p_email := LOWER(TRIM(p_email));
    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'Email address cannot be empty.';
    END IF;

    IF p_password IS NULL OR char_length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters.';
    END IF;

    -- 3. Prevent duplicate emails in auth.users and public.admins
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) OR EXISTS (SELECT 1 FROM public.admins WHERE email = p_email) THEN
        RAISE EXCEPTION 'An administrator account with email "%" already exists.', p_email;
    END IF;

    -- 4. Generate new UUID for the user
    v_uid := gen_random_uuid();

    -- 5. Encrypt password using bcrypt (standard in auth.users)
    v_encrypted_password := crypt(p_password, gen_salt('bf', 10));

    -- 6. Insert the auth user securely (confirmed immediately, removing email verification dependency)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_uid,
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_password,
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
    );

    -- 7. Create the matching record in public.admins
    INSERT INTO public.admins (id, email, created_at, updated_at)
    VALUES (v_uid, p_email, now(), now());

    -- 8. Write Audit Log
    INSERT INTO public.audit_logs (user_id, user_email, action, target_id, target_name, details)
    VALUES (
        auth.uid(),
        v_operator_email,
        'Admin account created',
        v_uid,
        p_email,
        jsonb_build_object('created_by', auth.uid(), 'email', p_email)
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. ESTABLISH ADMINS DELETE RLS POLICY
-- ----------------------------------------------------------------------------
-- Ensures that existing active administrators can revoke admin privileges.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins delete access" ON public.admins;
CREATE POLICY "Admins delete access" ON public.admins
    FOR DELETE USING (public.is_admin());
