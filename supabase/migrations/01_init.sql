-- -------------------------------------------------------------
-- MIDDHA VENTURES INVESTMENT CRM DATABASE SCHEMA MIGRATION
-- Save and run this inside your Supabase SQL Editor.
-- -------------------------------------------------------------

-- Enable UUID generator extension and pgcrypto consistently
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create ADMINS Table
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on Admin Email for fast lookups during verification
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);

-- 2. Create STARTUPS Table
CREATE TABLE IF NOT EXISTS public.startups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    website TEXT NOT NULL,
    one_line_pitch TEXT NOT NULL,
    description TEXT NOT NULL,
    hq_location TEXT NOT NULL,
    sector TEXT NOT NULL,
    founder_name TEXT NOT NULL,
    founder_email TEXT NOT NULL,
    founder_linkedin TEXT NOT NULL,
    team_size INTEGER NOT NULL,
    team_background TEXT NOT NULL,
    stage TEXT NOT NULL,
    funding_raised NUMERIC DEFAULT 0 NOT NULL,
    target_raise NUMERIC NOT NULL,
    traction TEXT NOT NULL,
    pitch_deck_path TEXT NOT NULL,
    demo_video TEXT,
    status TEXT NOT NULL DEFAULT 'New', -- 'New', 'Screening', 'Meeting', 'Due Diligence', 'Approved', 'Rejected', 'Archived'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for Search, Filters, and Pipeline Boards
CREATE INDEX IF NOT EXISTS idx_startups_status ON public.startups(status);
CREATE INDEX IF NOT EXISTS idx_startups_sector ON public.startups(sector);
CREATE INDEX IF NOT EXISTS idx_startups_stage ON public.startups(stage);
CREATE INDEX IF NOT EXISTS idx_startups_company_name ON public.startups(company_name);

-- 3. Create NOTES Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id UUID NOT NULL REFERENCES public.startups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    author_email TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on startup_id to fetch comments/notes quickly
CREATE INDEX IF NOT EXISTS idx_notes_startup_id ON public.notes(startup_id);

-- 4. Create AUDIT_LOGS Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL, -- 'Application submitted', 'Status changed', 'Reviewer note changes', 'Archive', 'Delete', 'Admin bootstrapped'
    target_id UUID NOT NULL,
    target_name TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on target_id and action
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON public.audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 5. Auto-Update 'updated_at' Triggers Definition
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set triggers on all relevant tables
DROP TRIGGER IF EXISTS tr_admins_updated_at ON public.admins;
CREATE TRIGGER tr_admins_updated_at
    BEFORE UPDATE ON public.admins
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_startups_updated_at ON public.startups;
CREATE TRIGGER tr_startups_updated_at
    BEFORE UPDATE ON public.startups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_notes_updated_at ON public.notes;
CREATE TRIGGER tr_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- -------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Help helper function to determine if a user is an active admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admins
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- A. ADMINS table policies
-- Admins can read admin records
CREATE POLICY "Admins read access" ON public.admins
    FOR SELECT USING (public.is_admin());

-- Allow first time creation/bootstrap
-- If table has 0 rows, anyone can insert their own auth record
CREATE POLICY "Allow bootstrap admin" ON public.admins
    FOR INSERT WITH CHECK (
        (SELECT count(*) FROM public.admins) = 0
        AND id = auth.uid()
    );

-- Allow existing admins to register/create subsequent admins (preventing privilege escalation)
CREATE POLICY "Admins insert access" ON public.admins
    FOR INSERT WITH CHECK (public.is_admin());


-- B. STARTUPS table policies
-- Public users can submit startup applications
CREATE POLICY "Public submit startup" ON public.startups
    FOR INSERT WITH CHECK (true);

-- Admins can select, update, and delete startups
CREATE POLICY "Admin select startups" ON public.startups
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin update startups" ON public.startups
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin delete startups" ON public.startups
    FOR DELETE USING (public.is_admin());


-- C. NOTES table policies
-- Only Admins can select, insert, and delete notes
CREATE POLICY "Admin select notes" ON public.notes
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin insert notes" ON public.notes
    FOR INSERT WITH CHECK (public.is_admin() AND author_id = auth.uid());

CREATE POLICY "Admin delete notes" ON public.notes
    FOR DELETE USING (public.is_admin());


-- D. AUDIT_LOGS table policies
-- Only authenticated admins can create audit logs directly (prevents fake entries)
CREATE POLICY "Admin insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (public.is_admin());

-- Only admins can read audit logs
CREATE POLICY "Admin select audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_admin());


-- Automatic Audit Logging Trigger for Startup Submissions
-- This handles public application logs securely inside the database, running with SECURITY DEFINER
-- bypassing direct public write access to the audit_logs table.
CREATE OR REPLACE FUNCTION public.log_startup_submission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, user_email, action, target_id, target_name, details)
    VALUES (
        auth.uid(), -- NULL for anonymous guest submissions
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

DROP TRIGGER IF EXISTS tr_log_startup_submission ON public.startups;
CREATE TRIGGER tr_log_startup_submission
    AFTER INSERT ON public.startups
    FOR EACH ROW EXECUTE FUNCTION public.log_startup_submission();


-- -------------------------------------------------------------
-- STORAGE BUCKET & POLICIES SETUP
-- -------------------------------------------------------------

-- Create private bucket if not exists via storage schema
-- Note: Run this inside Supabase SQL editor or create the bucket manually in UI with name 'pitch-decks'
INSERT INTO storage.buckets (id, name, public)
VALUES ('pitch-decks', 'pitch-decks', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Disallow anonymous uploads. Only authenticated users can upload to 'pitch-decks' folder
CREATE POLICY "Allow authenticated upload to pitch decks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pitch-decks');

-- Allow admins full access to pitch-decks storage
CREATE POLICY "Allow admin access to pitch decks"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'pitch-decks' AND public.is_admin())
WITH CHECK (bucket_id = 'pitch-decks' AND public.is_admin());
