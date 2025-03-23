# Database Connection Pooling

## Overview

This document outlines the implementation of database connection pooling in the Neo N3 Service Layer. Connection pooling is a technique used to maintain a cache of database connections that can be reused when future requests to the database are required. This improves performance by reducing the overhead of establishing new connections to the database for each operation.

## Benefits of Connection Pooling

1. **Reduced Latency**: Reusing existing connections eliminates the overhead of establishing new connections.
2. **Improved Throughput**: More database operations can be processed simultaneously with a pool of connections.
3. **Resource Efficiency**: Limits the number of connections to prevent database server overload.
4. **Connection Management**: Handles connection lifecycle, including validation, timeout, and cleanup.
5. **Resilience**: Provides mechanisms for handling connection failures and retries.

## Implementation Approach

The Service Layer uses the `sqlx` package which extends Go's standard `database/sql` package with additional functionality. The connection pooling is managed through configuration of the database connection pool.

### Connection Pool Configuration

```go
// DBConfig represents the configuration for database connection pool
type DBConfig struct {
    Host            string        `yaml:"host"`
    Port            int           `yaml:"port"`
    Username        string        `yaml:"username"`
    Password        string        `yaml:"password"`
    Database        string        `yaml:"database"`
    SSLMode         string        `yaml:"ssl_mode"`
    MaxOpenConns    int           `yaml:"max_open_conns"`    // Maximum number of open connections
    MaxIdleConns    int           `yaml:"max_idle_conns"`    // Maximum number of idle connections
    ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime"` // Maximum connection lifetime
    ConnMaxIdleTime time.Duration `yaml:"conn_max_idle_time"` // Maximum idle time for a connection
}

// NewDatabaseConnection creates a new database connection with optimized connection pooling
func NewDatabaseConnection(config *DBConfig) (*sqlx.DB, error) {
    // Construct DSN (data source name)
    dsn := fmt.Sprintf(
        "host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        config.Host, config.Port, config.Username, config.Password, config.Database, config.SSLMode,
    )
    
    // Open database connection
    db, err := sqlx.Open("postgres", dsn)
    if err != nil {
        return nil, fmt.Errorf("failed to open database connection: %w", err)
    }
    
    // Set connection pool parameters
    db.SetMaxOpenConns(config.MaxOpenConns)       // Default: 25
    db.SetMaxIdleConns(config.MaxIdleConns)       // Default: 25
    db.SetConnMaxLifetime(config.ConnMaxLifetime) // Default: 5 minutes
    db.SetConnMaxIdleTime(config.ConnMaxIdleTime) // Default: 1 minute
    
    // Verify connection
    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("failed to ping database: %w", err)
    }
    
    return db, nil
}
```

### Optimal Connection Pool Settings

The following are recommended settings based on performance testing:

| Setting | Recommended Value | Description |
|---------|------------------|-------------|
| `MaxOpenConns` | 25-50 | The maximum number of open connections to the database. Should be set based on your database server capacity and expected concurrent usage. |
| `MaxIdleConns` | Equal to `MaxOpenConns` | The maximum number of idle connections to maintain in the connection pool. Setting this equal to `MaxOpenConns` ensures that connections remain ready for reuse. |
| `ConnMaxLifetime` | 5-15 minutes | The maximum amount of time a connection may be reused. Helps avoid issues with stale connections, especially after database restarts or network changes. |
| `ConnMaxIdleTime` | 1-5 minutes | The maximum amount of time a connection may be idle before being closed. Helps control resource usage when the server is under lighter load. |

## Connection Validation

To ensure that connections in the pool are valid and ready to use, implement connection validation through periodic pings or health checks.

```go
// StartConnectionHealthCheck starts a background goroutine that periodically checks the database connection health
func StartConnectionHealthCheck(db *sqlx.DB, interval time.Duration, logger zerolog.Logger) {
    go func() {
        ticker := time.NewTicker(interval)
        defer ticker.Stop()
        
        for {
            select {
            case <-ticker.C:
                if err := db.Ping(); err != nil {
                    logger.Error().Err(err).Msg("Database connection health check failed")
                } else {
                    logger.Debug().Msg("Database connection health check successful")
                }
            }
        }
    }()
}
```

## Connection Metrics

Monitoring connection pool usage is essential for optimizing and troubleshooting. Implement metrics collection for the connection pool:

```go
// DatabaseMetrics collects and exposes metrics related to the database connection pool
type DatabaseMetrics struct {
    openConnections  prometheus.Gauge
    idleConnections  prometheus.Gauge
    inUseConnections prometheus.Gauge
    waitCount        prometheus.Counter
    waitDuration     prometheus.Histogram
    maxIdleTime      prometheus.Histogram
    maxLifetime      prometheus.Histogram
}

// NewDatabaseMetrics creates and registers database metrics
func NewDatabaseMetrics() *DatabaseMetrics {
    m := &DatabaseMetrics{
        openConnections: prometheus.NewGauge(prometheus.GaugeOpts{
            Name: "db_open_connections",
            Help: "The number of open connections in the database pool",
        }),
        idleConnections: prometheus.NewGauge(prometheus.GaugeOpts{
            Name: "db_idle_connections",
            Help: "The number of idle connections in the database pool",
        }),
        inUseConnections: prometheus.NewGauge(prometheus.GaugeOpts{
            Name: "db_in_use_connections",
            Help: "The number of in-use connections in the database pool",
        }),
        waitCount: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "db_wait_count_total",
            Help: "The total number of connections waited for",
        }),
        waitDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
            Name:    "db_wait_duration_seconds",
            Help:    "The duration of connection waits",
            Buckets: prometheus.ExponentialBuckets(0.001, 2, 10), // from 1ms to ~1s
        }),
        maxIdleTime: prometheus.NewHistogram(prometheus.HistogramOpts{
            Name:    "db_max_idle_time_seconds",
            Help:    "The maximum time connections are idle",
            Buckets: prometheus.ExponentialBuckets(1, 2, 10), // from 1s to ~17m
        }),
        maxLifetime: prometheus.NewHistogram(prometheus.HistogramOpts{
            Name:    "db_max_lifetime_seconds",
            Help:    "The maximum lifetime of connections",
            Buckets: prometheus.ExponentialBuckets(10, 2, 10), // from 10s to ~2.8h
        }),
    }

    // Register metrics with Prometheus
    prometheus.MustRegister(m.openConnections)
    prometheus.MustRegister(m.idleConnections)
    prometheus.MustRegister(m.inUseConnections)
    prometheus.MustRegister(m.waitCount)
    prometheus.MustRegister(m.waitDuration)
    prometheus.MustRegister(m.maxIdleTime)
    prometheus.MustRegister(m.maxLifetime)

    return m
}

// StartMetricsCollection starts a background goroutine that periodically collects database stats
func (m *DatabaseMetrics) StartMetricsCollection(db *sqlx.DB, interval time.Duration) {
    go func() {
        ticker := time.NewTicker(interval)
        defer ticker.Stop()
        
        for {
            select {
            case <-ticker.C:
                stats := db.Stats()
                m.openConnections.Set(float64(stats.OpenConnections))
                m.idleConnections.Set(float64(stats.Idle))
                m.inUseConnections.Set(float64(stats.OpenConnections - stats.Idle))
                m.waitCount.Add(float64(stats.WaitCount))
                m.waitDuration.Observe(stats.WaitDuration.Seconds())
            }
        }
    }()
}
```

## Context-Aware Database Operations

All database operations should use context-aware methods to ensure proper timeout handling and cancellation:

```go
// Example of context-aware database operation
func (r *Repository) GetByID(ctx context.Context, id string) (*Entity, error) {
    var entity Entity
    query := `SELECT * FROM entities WHERE id = $1`
    
    // Use QueryRowxContext instead of QueryRowx
    if err := r.db.QueryRowxContext(ctx, query, id).StructScan(&entity); err != nil {
        return nil, fmt.Errorf("failed to get entity: %w", err)
    }
    
    return &entity, nil
}

// Example of context-aware database transaction
func (r *Repository) CreateWithTransaction(ctx context.Context, entity *Entity) error {
    // Begin transaction with context
    tx, err := r.db.BeginTxx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    
    // Ensure transaction is rolled back on error
    defer func() {
        if err != nil {
            tx.Rollback() // Ignore error from rollback
        }
    }()
    
    // Perform transaction operations with context
    _, err = tx.ExecContext(ctx, `INSERT INTO entities (id, name) VALUES ($1, $2)`, entity.ID, entity.Name)
    if err != nil {
        return fmt.Errorf("failed to insert entity: %w", err)
    }
    
    // Commit transaction
    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }
    
    return nil
}
```

## Connection Retry and Circuit Breaker

For resilience, implement connection retry logic with a circuit breaker pattern for database operations:

```go
// Simplified implementation of retry logic
func WithRetry(ctx context.Context, op func(context.Context) error, maxRetries int, backoff time.Duration) error {
    var err error
    
    for i := 0; i < maxRetries; i++ {
        err = op(ctx)
        if err == nil {
            return nil
        }
        
        // Check if the error is retryable (e.g., connection error)
        if !isRetryableError(err) {
            return err
        }
        
        // Wait with exponential backoff before retrying
        select {
        case <-time.After(backoff * time.Duration(1<<uint(i))):
            continue
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    
    return fmt.Errorf("operation failed after %d retries: %w", maxRetries, err)
}

// Helper function to determine if an error is retryable
func isRetryableError(err error) bool {
    // Connection errors, deadlocks, and serialization failures are typically retryable
    if err == nil {
        return false
    }
    
    // Check for specific error types or error message patterns
    errStr := err.Error()
    return strings.Contains(errStr, "connection") ||
           strings.Contains(errStr, "deadlock") ||
           strings.Contains(errStr, "serialization")
}
```

## Configuration Example

Below is an example YAML configuration for database connection pooling:

```yaml
database:
  host: localhost
  port: 5432
  username: postgres
  password: secret
  database: service_layer
  ssl_mode: disable
  max_open_conns: 25
  max_idle_conns: 25
  conn_max_lifetime: 5m
  conn_max_idle_time: 1m
  health_check_interval: 1m
  metrics_collection_interval: 15s
  retry:
    max_retries: 3
    initial_backoff: 100ms
```

## Conclusion

Implementing proper database connection pooling significantly improves the performance and stability of database operations in the Service Layer. By configuring appropriate pool sizes, connection lifetimes, and implementing connection validation and metrics, we can ensure efficient and reliable database interactions even under high load.

The key points to remember:

1. Configure an appropriate number of connections based on expected load and database capacity
2. Balance between connection reuse and freshness with proper lifetime settings
3. Implement connection validation to detect and handle stale connections
4. Monitor connection pool metrics to identify bottlenecks and optimize settings
5. Use context-aware database operations for proper timeout handling
6. Implement retry mechanisms for resilience against transient failures 