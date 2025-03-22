-- Drop indexes
DROP INDEX IF EXISTS idx_contract_verifications_contract_id;
DROP INDEX IF EXISTS idx_contracts_status;
DROP INDEX IF EXISTS idx_contracts_address_network;
DROP INDEX IF EXISTS idx_contracts_user_id;
DROP INDEX IF EXISTS idx_wallets_user_id;

-- Drop tables
DROP TABLE IF EXISTS contract_verifications;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS wallets; 