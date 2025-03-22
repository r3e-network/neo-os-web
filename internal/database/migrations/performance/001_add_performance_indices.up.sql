-- Add performance indices based on query optimization analysis

-- Transaction tables
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_events_tx_type ON transaction_events(transaction_id, event_type);

-- Function execution table
CREATE INDEX IF NOT EXISTS idx_executions_function_status ON executions(function_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_executions_user_created ON executions(user_id, created_at);

-- Price feed tables
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_time ON price_history(symbol, timestamp);
CREATE INDEX IF NOT EXISTS idx_price_feeds_symbol_updated ON price_feeds(symbol, updated_at);

-- Oracle tables
CREATE INDEX IF NOT EXISTS idx_oracle_requests_status_created ON oracle_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_requests_user_created ON oracle_requests(user_id, created_at);

-- Event tables
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_type_user ON event_subscriptions(event_type, user_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_subscription_created ON event_notifications(subscription_id, created_at);

-- Add event_count column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS event_count INTEGER DEFAULT 0;

-- Update existing records
UPDATE transactions t SET event_count = (
    SELECT COUNT(*) FROM transaction_events te WHERE te.transaction_id = t.id
);

-- Add status_updated_at column to tables with status fields
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE executions ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE oracle_requests ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set initial values for status_updated_at
UPDATE transactions SET status_updated_at = created_at WHERE status_updated_at IS NULL;
UPDATE executions SET status_updated_at = created_at WHERE status_updated_at IS NULL;
UPDATE oracle_requests SET status_updated_at = created_at WHERE status_updated_at IS NULL;

-- Create trigger function to update event_count
CREATE OR REPLACE FUNCTION update_transaction_event_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE transactions SET event_count = event_count + 1 WHERE id = NEW.transaction_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE transactions SET event_count = event_count - 1 WHERE id = OLD.transaction_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep event_count updated
DROP TRIGGER IF EXISTS transaction_events_count_trigger ON transaction_events;
CREATE TRIGGER transaction_events_count_trigger
AFTER INSERT OR DELETE ON transaction_events
FOR EACH ROW EXECUTE PROCEDURE update_transaction_event_count();

-- Create trigger function to update status_updated_at
CREATE OR REPLACE FUNCTION update_status_timestamp() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to keep status_updated_at updated
DROP TRIGGER IF EXISTS transactions_status_update_trigger ON transactions;
CREATE TRIGGER transactions_status_update_trigger
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE PROCEDURE update_status_timestamp();

DROP TRIGGER IF EXISTS executions_status_update_trigger ON executions;
CREATE TRIGGER executions_status_update_trigger
BEFORE UPDATE ON executions
FOR EACH ROW EXECUTE PROCEDURE update_status_timestamp();

DROP TRIGGER IF EXISTS oracle_requests_status_update_trigger ON oracle_requests;
CREATE TRIGGER oracle_requests_status_update_trigger
BEFORE UPDATE ON oracle_requests
FOR EACH ROW EXECUTE PROCEDURE update_status_timestamp();