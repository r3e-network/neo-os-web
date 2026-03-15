-- Migration 051: Restrict miniapp_submissions public SELECT to approved only
-- Previously anon could read all submissions including pending/rejected.

DROP POLICY IF EXISTS public_read_submissions ON miniapp_submissions;

CREATE POLICY public_read_submissions
    ON miniapp_submissions FOR SELECT TO anon
    USING (status = 'approved');
