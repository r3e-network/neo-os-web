-- Admin emails table for Edge Functions authorization
-- Required by all MiniApp Edge Functions for admin verification

CREATE TABLE IF NOT EXISTS public.admin_emails (
    user_id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage admin emails"
    ON public.admin_emails
    FOR ALL
    TO service_role
    USING (true);

CREATE POLICY "Admins can view all admin emails"
    ON public.admin_emails
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_emails
            WHERE user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.admin_emails TO authenticated;

COMMENT ON TABLE public.admin_emails IS 'Authorized admin users for MiniApp Edge Functions';
COMMENT ON COLUMN public.admin_emails.user_id IS 'Reference to auth.users(id)';
COMMENT ON COLUMN public.admin_emails.role IS 'admin: full access, moderator: limited access';
