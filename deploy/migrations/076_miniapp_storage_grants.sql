-- =============================================================================
-- Mini-app shared-storage access grants
-- =============================================================================
-- Audit fix C9: os-storage-grant-access previously returned `granted: true`
-- without persisting anything, and os-storage-read-shared read ANY owner app's
-- kernel state with no grant check. The OS "shared storage" access model was an
-- unenforced convention. This table records explicit grants so grant-access can
-- fail-closed (persist or error) and read-shared can deny reads that lack a
-- matching recorded grant.
--
-- A grant means: `owner_app_id` allows `reader_app_id` to read shared storage
-- keys that start with `key_prefix` (empty prefix = all of owner's keys).
-- The underlying data is on-chain kernel state (already public via RPC), so the
-- grant is an OS-layer authorization record, not an encryption boundary.

BEGIN;

CREATE TABLE IF NOT EXISTS public.miniapp_storage_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_app_id TEXT NOT NULL,
    reader_app_id TEXT NOT NULL,
    key_prefix TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT miniapp_storage_grants_unique UNIQUE (owner_app_id, reader_app_id, key_prefix)
);

-- read-shared looks up grants by (owner_app_id, reader_app_id) then matches the
-- requested key against key_prefix in the application layer.
CREATE INDEX IF NOT EXISTS idx_miniapp_storage_grants_lookup
    ON public.miniapp_storage_grants (owner_app_id, reader_app_id);

-- Service-role only: edge functions use the service-role key; never exposed to
-- anon/authenticated via the Data API.
ALTER TABLE public.miniapp_storage_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.miniapp_storage_grants FROM anon, authenticated;
GRANT ALL ON TABLE public.miniapp_storage_grants TO service_role;

DROP POLICY IF EXISTS service_role_all_miniapp_storage_grants ON public.miniapp_storage_grants;
CREATE POLICY service_role_all_miniapp_storage_grants
    ON public.miniapp_storage_grants
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

COMMIT;
