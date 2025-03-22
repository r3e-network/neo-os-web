-- Drop tables in reverse order to handle dependencies
DROP TABLE IF EXISTS oracle_data;
DROP TABLE IF EXISTS oracle_configs;
DROP TABLE IF EXISTS random_numbers;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS gas_accounts;
DROP TABLE IF EXISTS price_data;
DROP TABLE IF EXISTS price_feeds;
DROP TABLE IF EXISTS trigger_events;
DROP TABLE IF EXISTS triggers;
DROP TABLE IF EXISTS execution_logs;
DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS function_secrets;
DROP TABLE IF EXISTS secrets;
DROP TABLE IF EXISTS functions;
DROP TABLE IF EXISTS users;