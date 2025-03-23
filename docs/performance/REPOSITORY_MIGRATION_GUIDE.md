# Repository Migration Guide

This guide explains how to migrate from the standard repository implementations to the new optimized implementations that utilize enhanced database schemas and query patterns.

## Transaction Repository Migration

### 1. Run the Database Migration

Before using the optimized repositories, ensure you've run the database migration to add the necessary indices and schema changes:

```bash
# For development environments
go run cmd/migrate/main.go up

# For production environments
./service_layer migrate up
```

This will apply the migration in `internal/database/migrations/performance/001_add_performance_indices.up.sql` which adds:
- Performance indices for common query patterns
- Denormalized fields like `event_count` and `status_updated_at`
- Database triggers to maintain these fields automatically

### 2. Update Repository Creation

#### Option 1: Use the Repository Factory (Recommended)

The repository factory provides a clean interface for creating repositories with the option to use optimized implementations:

```go
import (
    "github.com/R3E-Network/service_layer/internal/database"
    "github.com/rs/zerolog/log"
)

// Create a logger instance
logger := log.With().Str("component", "database").Logger()

// Create the repository factory
factory := database.NewRepositoryFactory(db, &logger)

// Get an optimized repository implementation
txRepo := factory.CreateTransactionRepository(true)

// Use the repository as you normally would
transactions, err := txRepo.ListTransactions(ctx, service, status, entityID, page, limit)
```

#### Option 2: Direct Instantiation

You can also create the optimized repository directly:

```go
import "github.com/R3E-Network/service_layer/internal/database"

// Create the optimized repository
txRepo := database.NewOptimizedTransactionRepository(db)

// Use the repository as you normally would
transactions, err := txRepo.ListTransactions(ctx, service, status, entityID, page, limit)
```

### 3. Integration with Services

For services that depend on repositories, update their constructors to accept the repository factory:

```go
// Before
func NewTransactionService(repo database.TransactionRepository, ...) *TransactionService {
    // ...
}

// After
func NewTransactionServiceWithFactory(
    factory *database.RepositoryFactory,
    useOptimizedRepo bool,
    // other parameters...
) *TransactionService {
    repo := factory.CreateTransactionRepository(useOptimizedRepo)
    // Create and return service with the repository
}
```

This allows the service to use either the standard or optimized implementation based on configuration.

### 4. Gradual Migration Strategy

To minimize risk, consider a phased approach:

1. **Testing Phase**: Enable optimized repositories in test environments first
2. **Monitoring Phase**: Deploy to production with standard repositories but collect query metrics
3. **Partial Migration**: Enable optimized repositories for non-critical paths
4. **Full Migration**: Switch all repositories to optimized implementations

### 5. Configuration

Add a configuration option to control which implementation is used:

```go
type Config struct {
    // Other configuration options...
    Database struct {
        // Other database options...
        UseOptimizedRepositories bool `json:"useOptimizedRepositories" yaml:"useOptimizedRepositories"`
    } `json:"database" yaml:"database"`
}
```

Then use this configuration when creating repositories:

```go
factory := database.NewRepositoryFactory(db, logger)
txRepo := factory.CreateTransactionRepository(config.Database.UseOptimizedRepositories)
```

This allows for easy toggling between implementations via configuration.

### 6. Testing

Make sure to update your tests to work with both repository implementations:

```go
func TestWithBothRepositoryImplementations(t *testing.T) {
    // Setup database
    db := setupTestDatabase()
    
    // Test implementations
    implementations := []struct{
        name string
        createRepo func() database.TransactionRepository
    }{
        {
            name: "Standard",
            createRepo: func() database.TransactionRepository {
                return database.NewSQLTransactionRepository(db)
            },
        },
        {
            name: "Optimized",
            createRepo: func() database.TransactionRepository {
                return database.NewOptimizedTransactionRepository(db)
            },
        },
    }
    
    for _, impl := range implementations {
        t.Run(impl.name, func(t *testing.T) {
            repo := impl.createRepo()
            // Run your tests with this repository
        })
    }
}
```

This ensures your code works correctly with both implementations.

## Performance Monitoring

When migrating to optimized repositories, monitor these key metrics:

1. **Query execution time**: Compare before and after for each repository method
2. **Database CPU usage**: Monitor overall database load
3. **Lock contention**: Watch for any increase in lock wait time
4. **Cache hit rate**: If using caching, ensure it's still effective

## Rollback Plan

If issues are encountered with the optimized repositories:

1. Set `UseOptimizedRepositories` to `false` in your configuration
2. Restart your application to switch back to standard repositories
3. If schema changes are causing issues, run the down migration:

```bash
# For development environments
go run cmd/migrate/main.go down

# For production environments
./service_layer migrate down
```

This will revert the schema changes while preserving your data. 