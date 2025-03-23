-- Drop triggers first
DROP TRIGGER IF EXISTS oracle_requests_status_update_trigger ON oracle_requests;
DROP TRIGGER IF EXISTS executions_status_update_trigger ON executions;
DROP TRIGGER IF EXISTS transactions_status_update_trigger ON transactions;
DROP TRIGGER IF EXISTS transaction_events_count_trigger ON transaction_events;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_status_timestamp();
DROP FUNCTION IF EXISTS update_transaction_event_count();

-- Remove added columns
ALTER TABLE oracle_requests DROP COLUMN IF EXISTS status_updated_at;
ALTER TABLE executions DROP COLUMN IF EXISTS status_updated_at;
ALTER TABLE transactions DROP COLUMN IF EXISTS status_updated_at;
ALTER TABLE transactions DROP COLUMN IF EXISTS event_count;

-- Drop indices
DROP INDEX IF EXISTS idx_event_notifications_subscription_created;
DROP INDEX IF EXISTS idx_event_subscriptions_type_user;
DROP INDEX IF EXISTS idx_oracle_requests_user_created;
DROP INDEX IF EXISTS idx_oracle_requests_status_created;
DROP INDEX IF EXISTS idx_price_feeds_symbol_updated;
DROP INDEX IF EXISTS idx_price_history_symbol_time;
DROP INDEX IF EXISTS idx_executions_user_created;
DROP INDEX IF EXISTS idx_executions_function_status;
DROP INDEX IF EXISTS idx_transaction_events_tx_type;
DROP INDEX IF EXISTS idx_transactions_created_at;
DROP INDEX IF EXISTS idx_transactions_user_status; 