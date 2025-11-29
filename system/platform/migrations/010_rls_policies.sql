-- Row Level Security (RLS) Policies for Tenant Isolation
-- These policies enforce multi-tenant data isolation at the database level,
-- eliminating the need for application-level tenant filtering.

-- Helper function to extract tenant from JWT
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'tenant_id',
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id',
    'default'
  );
$$ LANGUAGE sql STABLE;

-- Helper function to check if user has service role
CREATE OR REPLACE FUNCTION auth.is_service_role() RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role',
    FALSE
  );
$$ LANGUAGE sql STABLE;

-- Helper function to get user ID from JWT
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- Enable RLS on all tenant-scoped tables
-- ============================================================================

-- Accounts
ALTER TABLE app_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON app_accounts
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Functions
ALTER TABLE app_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON app_functions
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Triggers
ALTER TABLE app_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON app_triggers
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Secrets
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON app_secrets
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Gas Bank Accounts
ALTER TABLE gasbank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON gasbank_accounts
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Automation Jobs
ALTER TABLE automation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON automation_jobs
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Price Feeds
ALTER TABLE pricefeed_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON pricefeed_feeds
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Data Feeds
ALTER TABLE datafeeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON datafeeds
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Data Streams
ALTER TABLE datastream_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON datastream_streams
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Data Link Channels
ALTER TABLE datalink_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON datalink_channels
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- DTA Products
ALTER TABLE dta_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON dta_products
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Confidential Data
ALTER TABLE confidential_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON confidential_data
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Oracle Data Sources
ALTER TABLE oracle_datasources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON oracle_datasources
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- CRE Playbooks
ALTER TABLE cre_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON cre_playbooks
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- CCIP Messages
ALTER TABLE ccip_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON ccip_messages
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- VRF Keys
ALTER TABLE vrf_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON vrf_keys
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- Workspace Wallets
ALTER TABLE workspace_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON workspace_wallets
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());

-- ============================================================================
-- Grant permissions for PostgREST
-- ============================================================================

-- Create roles for PostgREST
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant select on all tables to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant sequence usage
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Service role bypasses RLS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

COMMENT ON POLICY "tenant_isolation" ON app_accounts IS
  'Enforces tenant isolation: users can only access data where tenant matches their JWT tenant_id claim';
