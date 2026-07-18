-- ============================================================================
-- MIDDHA VENTURES CRM - STORAGE POLICY SECURING (09_storage_upload_policy.sql)
-- ============================================================================

-- Scope the "Allow authenticated upload to pitch decks" policy so that users
-- can only upload to a folder that matches their own authenticated/anonymous user ID.
-- This prevents any authenticated/anonymous session from writing to paths outside 
-- of their own scoped folder.

DROP POLICY IF EXISTS "Allow authenticated upload to pitch decks" ON storage.objects;

CREATE POLICY "Allow authenticated upload to pitch decks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'pitch-decks'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
