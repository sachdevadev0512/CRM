-- Adds a per-application "assigned admin" (analysis owner) so any admin can assign
-- themselves or a colleague to review a specific startup. Nullable -- an application
-- can sit unassigned. ON DELETE SET NULL so revoking an admin (see admins.ts /
-- 07_critical_security_fixes.sql) never blocks on, or cascades into deleting, the
-- startups they were assigned to -- it just falls back to unassigned.
ALTER TABLE public.startups
    ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_startups_assigned_admin_id ON public.startups(assigned_admin_id);

-- No new RLS policy is required: the existing "Admin update startups" policy
-- (01_init.sql) is a row-level, not column-level, USING (public.is_admin()) check, so
-- it already permits any admin to write this new column on any startup row.
