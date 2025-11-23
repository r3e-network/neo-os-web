-- Extend tenant column coverage to remaining app tables.

ALTER TABLE IF EXISTS chainlink_data_feeds ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS chainlink_data_feed_updates ADD COLUMN IF NOT EXISTS tenant TEXT;

ALTER TABLE IF EXISTS chainlink_datastreams ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS chainlink_datastream_frames ADD COLUMN IF NOT EXISTS tenant TEXT;

ALTER TABLE IF EXISTS chainlink_dta_products ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS chainlink_dta_orders ADD COLUMN IF NOT EXISTS tenant TEXT;

ALTER TABLE IF EXISTS confidential_enclaves ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS confidential_sealed_keys ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS confidential_attestations ADD COLUMN IF NOT EXISTS tenant TEXT;

ALTER TABLE IF EXISTS app_cre_playbooks ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS app_cre_runs ADD COLUMN IF NOT EXISTS tenant TEXT;

ALTER TABLE IF EXISTS app_gas_accounts ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS app_gas_transactions ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS app_gas_dead_letters ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS app_gas_withdrawal_approvals ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS app_gas_withdrawal_schedules ADD COLUMN IF NOT EXISTS tenant TEXT;
ALTER TABLE IF EXISTS app_gas_settlement_attempts ADD COLUMN IF NOT EXISTS tenant TEXT;
