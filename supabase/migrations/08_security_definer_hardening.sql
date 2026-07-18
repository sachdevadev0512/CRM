-- ============================================================================
-- MIDDHA VENTURES CRM - SECURITY DEFINER HARDENING (08_security_definer_hardening.sql)
-- ============================================================================

-- Pin search path to public, pg_temp on all SECURITY DEFINER functions
-- to prevent potential search-path hijacking attacks as recommended by Supabase Security Advisor.

ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_startup_submission() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_duplicate_startup() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_admin_lockout() SET search_path = public, pg_temp;
