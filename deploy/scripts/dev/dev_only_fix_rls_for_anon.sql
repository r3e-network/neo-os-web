-- =============================================================================
-- DEV ONLY — Fix RLS Policies for local development
-- =============================================================================
-- Audit fix M-21: This is a DEVELOPMENT WORKAROUND when the correct
-- service_role JWT key is not available. It grants `anon` full write access to
-- five tables, which is catastrophic in production: anonymous browser clients
-- holding the public anon key could read/write `pool_accounts`,
-- `account_balances`, `chain_txs`, and forge contract event records.
--
-- This script lives under `deploy/scripts/dev/` and is renamed to make the
-- intent unmistakable. The DO block below also hard-fails if the database
-- identifies as a production deployment.
-- =============================================================================

DO $$
DECLARE
    env_name text;
BEGIN
    env_name := lower(coalesce(current_setting('app.environment', true), ''));
    IF env_name IN ('prod', 'production', 'live', 'mainnet') THEN
        RAISE EXCEPTION
            'dev_only_fix_rls_for_anon.sql refuses to run in environment %', env_name
            USING HINT = 'this script is dev-only; do not apply to production';
    END IF;
END $$;

-- Add policies for anon role to perform all operations
-- These policies allow the anon key to bypass RLS for development purposes

-- Pool Accounts
DROP POLICY IF EXISTS anon_all ON pool_accounts;
CREATE POLICY anon_all ON pool_accounts FOR ALL TO anon USING (true) WITH CHECK (true);

-- Account Balances
DROP POLICY IF EXISTS anon_all ON account_balances;
CREATE POLICY anon_all ON account_balances FOR ALL TO anon USING (true) WITH CHECK (true);

-- Chain Transactions
DROP POLICY IF EXISTS anon_all ON chain_txs;
CREATE POLICY anon_all ON chain_txs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Contract Events
DROP POLICY IF EXISTS anon_all ON contract_events;
CREATE POLICY anon_all ON contract_events FOR ALL TO anon USING (true) WITH CHECK (true);

-- Simulation Transactions
DROP POLICY IF EXISTS anon_all ON simulation_txs;
CREATE POLICY anon_all ON simulation_txs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Grant all permissions to anon role
GRANT ALL ON pool_accounts TO anon;
GRANT ALL ON account_balances TO anon;
GRANT ALL ON chain_txs TO anon;
GRANT ALL ON contract_events TO anon;
GRANT ALL ON simulation_txs TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('pool_accounts', 'account_balances', 'chain_txs', 'contract_events', 'simulation_txs')
ORDER BY tablename, policyname;
