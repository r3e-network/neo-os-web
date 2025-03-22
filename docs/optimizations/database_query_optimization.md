# Database Query Optimization

## Overview

This document details the database query optimization strategy for the Neo N3 Service Layer. Based on performance testing results, we've identified several database queries that can be optimized to improve overall system performance.

## Performance Analysis Results

### Query Performance Issues

Performance testing has revealed the following database performance issues:

1. **Slow Transaction Queries**: Queries that join transaction and transaction_events tables show poor performance under load, especially when filtering by status or time range.

2. **Function Execution Listing**: Queries for function execution history with filtering and pagination are inefficient, especially for users with many executions.

3. **Price Feed History**: Retrieving price feed history with date range filtering performs poorly due to inefficient indexing.

4. **Oracle Request Queries**: Queries that filter oracle requests by status and date range show suboptimal performance.

5. **Event Subscription Queries**: Complex queries for event subscriptions with filtering by event type and parameters are inefficient.

## Optimization Approach

### 1. Index Optimization

We will add or optimize indexes for commonly accessed fields and query patterns:

#### Transaction Tables

```sql
-- Add composite index for transaction queries by user and status
CREATE INDEX idx_transactions_user_status ON transactions(user_id, status);

-- Add index for transaction time range queries
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Add composite index for transaction events filtering
CREATE INDEX idx_transaction_events_tx_type ON transaction_events(transaction_id, event_type);
```

#### Function Execution Table

```sql
-- Add composite index for function execution queries
CREATE INDEX idx_executions_function_status ON executions(function_id, status, created_at);

-- Add index for user-based function execution queries
CREATE INDEX idx_executions_user_created ON executions(user_id, created_at);
```

#### Price Feed Tables

```sql
-- Add index for price feed history queries
CREATE INDEX idx_price_history_symbol_time ON price_history(symbol, timestamp);

-- Add composite index for update time range
CREATE INDEX idx_price_feeds_symbol_updated ON price_feeds(symbol, updated_at);
```

#### Oracle Tables

```sql
-- Add composite index for oracle request queries
CREATE INDEX idx_oracle_requests_status_created ON oracle_requests(status, created_at);

-- Add index for user-based oracle request queries
CREATE INDEX idx_oracle_requests_user_created ON oracle_requests(user_id, created_at);
```

#### Event Tables

```sql
-- Add composite index for event subscription queries
CREATE INDEX idx_event_subscriptions_type_user ON event_subscriptions(event_type, user_id);

-- Add index for event notification queries
CREATE INDEX idx_event_notifications_subscription_created ON event_notifications(subscription_id, created_at);
```

### 2. Query Rewriting

We will rewrite inefficient queries to improve performance:

#### Transaction Query Optimization

**Original Query:**
```sql
SELECT t.*, COUNT(te.id) as event_count 
FROM transactions t 
LEFT JOIN transaction_events te ON t.id = te.transaction_id 
WHERE t.user_id = ? AND t.status = ? 
GROUP BY t.id 
ORDER BY t.created_at DESC 
LIMIT ? OFFSET ?;
```

**Optimized Query:**
```sql
-- Use a subquery to get the event count, which performs better with large datasets
SELECT t.*, COALESCE(e.event_count, 0) as event_count 
FROM transactions t 
LEFT JOIN (
    SELECT transaction_id, COUNT(*) as event_count 
    FROM transaction_events 
    GROUP BY transaction_id
) e ON t.id = e.transaction_id 
WHERE t.user_id = ? AND t.status = ? 
ORDER BY t.created_at DESC 
LIMIT ? OFFSET ?;
```

#### Function Execution Query Optimization

**Original Query:**
```sql
SELECT e.*, f.name as function_name 
FROM executions e 
JOIN functions f ON e.function_id = f.id 
WHERE e.user_id = ? 
ORDER BY e.created_at DESC 
LIMIT ? OFFSET ?;
```

**Optimized Query:**
```sql
-- Use a covering index and avoid unnecessary joins when possible
SELECT e.* 
FROM executions e 
WHERE e.user_id = ? 
ORDER BY e.created_at DESC 
LIMIT ? OFFSET ?;

-- Then fetch function names separately if needed
SELECT id, name FROM functions WHERE id IN (?);
```

#### Price Feed History Query Optimization

**Original Query:**
```sql
SELECT * FROM price_history 
WHERE symbol = ? AND timestamp BETWEEN ? AND ? 
ORDER BY timestamp DESC;
```

**Optimized Query:**
```sql
-- Limit the columns returned and use LIMIT clause
SELECT symbol, price, timestamp 
FROM price_history 
WHERE symbol = ? AND timestamp BETWEEN ? AND ? 
ORDER BY timestamp DESC 
LIMIT 1000;
```

### 3. Database Schema Adjustments

We will make the following schema adjustments to improve query performance:

#### Denormalize Transaction Events Counter

Add a `event_count` column to the transactions table to avoid expensive JOINs:

```sql
ALTER TABLE transactions ADD COLUMN event_count INTEGER DEFAULT 0;

-- Update existing records
UPDATE transactions t SET event_count = (
    SELECT COUNT(*) FROM transaction_events te WHERE te.transaction_id = t.id
);

-- Create a trigger to keep the count updated
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

CREATE TRIGGER transaction_events_count_trigger
AFTER INSERT OR DELETE ON transaction_events
FOR EACH ROW EXECUTE PROCEDURE update_transaction_event_count();
```

#### Add Status Last Updated Timestamp

Add a `status_updated_at` column to tables with status fields to optimize status-change queries:

```sql
ALTER TABLE transactions ADD COLUMN status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE executions ADD COLUMN status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE oracle_requests ADD COLUMN status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to keep the timestamp updated
CREATE OR REPLACE FUNCTION update_status_timestamp() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_status_update_trigger
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE PROCEDURE update_status_timestamp();

CREATE TRIGGER executions_status_update_trigger
BEFORE UPDATE ON executions
FOR EACH ROW EXECUTE PROCEDURE update_status_timestamp();

CREATE TRIGGER oracle_requests_status_update_trigger
BEFORE UPDATE ON oracle_requests
FOR EACH ROW EXECUTE PROCEDURE update_status_timestamp();
```

### 4. Query Caching Strategy

We will implement caching for frequently executed and expensive queries:

#### Redis Caching Implementation

1. **Transaction Counts**: Cache transaction counts by status and user
   ```
   CACHE KEY: "tx_count:{user_id}:{status}"
   EXPIRY: 5 minutes
   INVALIDATION: On transaction status change
   ```

2. **Recent Price Data**: Cache recent price data for frequently accessed symbols
   ```
   CACHE KEY: "price:{symbol}:latest"
   EXPIRY: Based on update frequency (e.g., 1 minute for volatile assets)
   INVALIDATION: On price update
   ```

3. **User Function List**: Cache list of user's functions
   ```
   CACHE KEY: "functions:{user_id}:list"
   EXPIRY: 10 minutes
   INVALIDATION: On function create/update/delete
   ```

4. **Execution History Counts**: Cache counts of function executions
   ```
   CACHE KEY: "executions:{function_id}:count"
   EXPIRY: 5 minutes
   INVALIDATION: On new execution
   ```

#### In-Memory Caching for Reference Data

1. **Price Feed Configuration**: Cache price feed configuration in memory
2. **Event Types**: Cache event type definitions
3. **System Configuration**: Cache system configuration parameters

## Implementation Plan

### Phase 1: Index Optimization (High Priority)

1. Create SQL migration script for adding new indexes
2. Test index effectiveness with EXPLAIN ANALYZE
3. Monitor query performance before and after index creation
4. Document index usage and maintenance guidelines

### Phase 2: Query Rewriting (High Priority)

1. Identify and optimize top 10 most expensive queries
2. Rewrite repository implementations to use optimized queries
3. Add query metrics and logging for performance analysis
4. Test and validate query performance improvements

### Phase 3: Schema Adjustments (Medium Priority)

1. Create migration scripts for schema changes
2. Update repository layer to use new schema features
3. Backfill data for new columns
4. Create database triggers for maintaining denormalized data

### Phase 4: Caching Implementation (Medium Priority)

1. Set up Redis caching infrastructure
2. Implement cache manager with appropriate interfaces
3. Add caching to repository implementations
4. Implement cache invalidation strategies
5. Monitor cache hit rates and effectiveness

## Performance Impact Measurement

To measure the effectiveness of these optimizations, we will:

1. Capture baseline query performance before optimizations
2. Measure query performance after each optimization phase
3. Monitor database load under simulated production traffic
4. Track key performance indicators:
   - Query execution time (average, 95th percentile)
   - Database CPU and memory usage
   - Lock contention and wait events
   - Index usage statistics

## Expected Outcomes

The expected outcomes of these database optimizations include:

1. 40-60% reduction in query execution time for optimized queries
2. Improved throughput for database-intensive operations
3. Reduced database CPU and memory usage
4. Better scalability under increasing load
5. More predictable query performance

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| Index overhead for writes | Medium | Medium | Monitor write performance and adjust indexes as needed |
| Cache invalidation issues | High | Medium | Implement thorough testing and monitoring for cache consistency |
| Schema migration complexity | Medium | Low | Carefully plan migrations and include rollback procedures |
| Query plan changes after optimization | Medium | Medium | Use query plan locking where appropriate and monitor performance |

## Conclusion

The outlined database query optimization strategy addresses key performance bottlenecks identified during testing. By implementing these optimizations, we expect to significantly improve the overall performance and scalability of the Neo N3 Service Layer database operations.