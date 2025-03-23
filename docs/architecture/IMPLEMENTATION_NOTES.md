# Implementation Notes for Service Layer Duplication Resolution

## Overview

This document provides implementation notes and guidance for the team working on the Service Layer project, specifically regarding the resolution of duplication between the `internal` and `internal/core` directories.

## Core Patterns and Decisions

### 1. Interface-First Approach

We've defined service interfaces in the `models` package, making them the primary contract that both implementations and clients work with:

```go
// Example from internal/models/price_feed.go
type PriceFeedService interface {
    // Price feed management
    CreatePriceFeed(ctx context.Context, symbol string, contractAddress string, interval int, threshold float64, minSources int) (*PriceFeed, error)
    // ...other methods
}
```

This approach:
- Provides a clear contract between clients and implementations
- Allows for multiple implementations (current core and potentially others)
- Makes dependencies explicit

### 2. Wrapper Pattern

We've implemented the wrapper pattern to delegate from the higher-level `internal/*` services to the more comprehensive `internal/core/*` implementations:

```go
// Example from internal/pricefeed/wrapper.go
type Wrapper struct {
    coreService *corePriceFeed.PriceFeedService
}

func (w *Wrapper) CreatePriceFeed(ctx context.Context, symbol string, contractAddress string, 
    interval int, threshold float64, minSources int) (*models.PriceFeed, error) {
    
    return w.coreService.CreatePriceFeed(symbol, "", 
        formatInterval(interval), threshold, formatInterval(interval*10), 
        contractAddress)
}
```

This pattern:
- Preserves backward compatibility
- Resolves parameter and return type differences
- Maintains clear separation of concerns

### 3. Logger Initialization

We standardized logger initialization using the `logger.New()` constructor:

```go
log := logger.New("module-name")
```

This avoids field errors with direct struct initialization and provides a consistent pattern.

### 4. Constructor Parameter Ordering

We identified and fixed different constructor parameter ordering between implementations:

```go
// Example with corrected parameter order
coreService := coreGasBank.NewService(
    config,            // Config
    log,               // Logger
    repository,        // Repository
    &blockchainClient, // Blockchain Client
)
```

Adding descriptive comments helps maintain clarity and reduces future errors.

### 5. Dependency Handling

For dependencies that can't be easily resolved (like cross-service dependencies), we use nil for optional dependencies:

```go
// Example from Oracle service
var gasBankService *coreGasBank.Service = nil
```

The core service should check for nil dependencies and handle them gracefully.

## Common Error Patterns and Solutions

### 1. Logger Field Errors

**Problem:**
```
unknown field Module in struct literal of type logger.Logger
```

**Solution:**
```go
// Incorrect
log := &logger.Logger{
    Module: "pricefeed",
}

// Correct
log := logger.New("pricefeed")
```

### 2. Constructor Parameter Mismatch

**Problem:**
```
too many arguments in call to coreGasBank.NewService
```

**Solution:**
Check the actual function signature and update the call accordingly:
```go
// Correct parameter order
coreService := coreGasBank.NewService(
    config,
    log,
    repository,
    &blockchainClient,
)
```

### 3. Client Method Not Found

**Problem:**
```
blockchainClient.ExecuteContract undefined
```

**Solution:**
```go
// Check the interface and use the correct method name
result, err := s.blockchainClient.InvokeContractFunction(...)
```

## Testing Considerations

1. **Interface Compliance**
   - Ensure wrappers correctly implement the defined interfaces
   - Use interface assertions in tests: `var _ models.PriceFeedService = (*Wrapper)(nil)`

2. **Parameter Translation**
   - Test that parameters are correctly translated between the wrapper and core implementation
   - Focus on edge cases like null values, empty strings, etc.

3. **Error Handling**
   - Verify that errors from the core implementation are properly propagated
   - Check error wrapping and contextual information

4. **Integration Testing**
   - Test that wrapped services work with actual dependencies
   - Verify behavior is unchanged from the original implementation

## Maintenance Guidelines

1. **Interface Changes**
   - Always update the interface in the models package first
   - Then update all implementations to match the new interface
   - Consider backward compatibility needs

2. **Adding New Services**
   - Define the interface in the models package
   - Implement the core version first
   - Create a wrapper implementation 
   - Use the wrapper in the top-level service

3. **Dependency Updates**
   - When updating external dependencies, check for interface changes
   - Update wrappers to handle any changes in underlying APIs

4. **Performance Considerations**
   - The wrapper pattern adds a small overhead
   - For performance-critical code paths, consider direct implementation

## Conclusion

This architecture provides a clean separation between interfaces and implementations while maintaining backward compatibility. The wrapper pattern effectively bridges different implementations and preserves the existing API surface without duplicating business logic.

By following these patterns and guidelines, the team can continue to evolve the Service Layer with minimal duplication and improved maintainability.