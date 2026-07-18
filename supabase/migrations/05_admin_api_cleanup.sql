-- ============================================================================
-- MIDDHA VENTURES CRM - DATABASE CLEANUP MIGRATION (05_admin_api_cleanup.sql)
-- ============================================================================
-- This migration removes the obsolete and insecure public.create_new_admin_user
-- SQL function which directly inserted into auth.users, ensuring that all 
-- administrator creations occur exclusively via the official Supabase Auth 
-- Admin API inside our secure server backend.
-- ============================================================================

-- Safely drop the direct-insertion RPC function
DROP FUNCTION IF EXISTS public.create_new_admin_user(TEXT, TEXT) CASCADE;
