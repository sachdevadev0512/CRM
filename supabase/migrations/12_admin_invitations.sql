-- ============================================================================
-- MIDDHA VENTURES CRM - EMAIL-BASED ADMINISTRATOR INVITATIONS (12_admin_invitations.sql)
-- ============================================================================
-- Replaces the direct "type a temporary password for someone else" admin creation
-- flow with a proper email invitation: an existing administrator invites an email
-- address, Supabase Auth sends the invite email (auth.admin.inviteUserByEmail, run
-- from the secure server backend in server.ts), the invitee clicks the link, sets
-- their own password, and only then is granted a row in public.admins.
--
-- This table is only ever written to by the service-role client inside server.ts
-- (mirrors how register-administrator/create_new_admin_user worked in prior
-- migrations) — the only client-side RLS policy needed is a read policy so the
-- Admin Management UI can list pending/past invitations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    invited_by_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Only one live pending invitation per email address at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_invites_pending_email
    ON public.admin_invites(email) WHERE status = 'pending';

-- Fast lookup of the invite a freshly-authenticated invitee is trying to accept.
CREATE INDEX IF NOT EXISTS idx_admin_invites_invited_user_id ON public.admin_invites(invited_user_id);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Registered admins can read the invitations list (Pending Invitations UI).
-- No client-side INSERT/UPDATE/DELETE policy: all mutations happen exclusively
-- through the service-role client inside server.ts's /api/crm-service/*-admin-invite routes.
DROP POLICY IF EXISTS "Admins read invites" ON public.admin_invites;
CREATE POLICY "Admins read invites" ON public.admin_invites
    FOR SELECT USING (public.is_admin());
