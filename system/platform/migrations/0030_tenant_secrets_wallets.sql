-- Extend tenant coverage to secrets and workspace wallets for multi-tenant enforcement.

ALTER TABLE IF EXISTS app_secrets ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS workspace_wallets ADD COLUMN IF NOT EXISTS tenant TEXT;

UPDATE app_secrets s
SET tenant = a.tenant
FROM app_accounts a
WHERE s.account_id = a.id AND (s.tenant IS NULL OR s.tenant = '');

UPDATE workspace_wallets w
SET tenant = a.tenant
FROM app_accounts a
WHERE w.workspace_id = a.id AND (w.tenant IS NULL OR w.tenant = '');

CREATE INDEX IF NOT EXISTS idx_app_secrets_tenant ON app_secrets (tenant);
CREATE INDEX IF NOT EXISTS idx_workspace_wallets_tenant ON workspace_wallets (tenant);
