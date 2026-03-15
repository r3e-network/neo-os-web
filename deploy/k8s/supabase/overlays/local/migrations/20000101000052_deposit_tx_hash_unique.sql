-- Prevent duplicate deposit requests for the same on-chain transaction.
-- Partial unique index allows multiple NULLs (pending deposits without tx_hash).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_deposits_tx_hash_unique
  ON deposit_requests (tx_hash)
  WHERE tx_hash IS NOT NULL;
