# Service Layer Directory Structure Migration Plan

## Overview

This document provides a detailed plan for resolving the duplication between `internal` and `internal/core` directories. We've identified duplicated service implementations in the following areas:

1. GasBank
2. Oracle
3. PriceFeed

## Migration Approach

Based on our analysis of the codebase, we've determined the best approach is to:

1. Keep the more robust implementations in `internal/core/*`
2. Define service interfaces in `internal/models`
3. Create wrappers in `internal/*/wrapper.go` that implement these interfaces
4. Update the existing services in `internal/*` to delegate to the wrappers

## Detailed Steps

### 1. Interface Definitions

We've already created service interfaces in the models directory:

- `models.PriceFeedService` in `internal/models/price_feed.go`
- `models.GasBankService` in `internal/models/gas_bank.go`
- `models.OracleService` in `internal/models/oracle.go`

### 2. Implementation Plan for PriceFeed

#### Step 1: Create Wrapper Implementation

We've created a wrapper in `internal/pricefeed/wrapper.go` that implements the `models.PriceFeedService` interface by delegating to the core implementation.

#### Step 2: Update Original Service

The original `Service` in `internal/pricefeed/service.go` needs several updates:

1. Fix imports to include the core implementation
2. Add the wrapper field to the `Service` struct
3. Update the `NewService` function to create and use the core implementation
4. Modify all methods to delegate to the wrapper

**Issues to Resolve:**

- The core implementation may use a different config structure than expected
- Dependency differences between implementations
- Method signature mismatches

### 3. Implementation Plan for GasBank

#### Step 1: Create Wrapper Implementation

Create a wrapper in `internal/gasbank/wrapper.go` that implements the `models.GasBankService` interface.

#### Step 2: Update Original Service

Similar to PriceFeed, update the original `Service` to delegate to the wrapper.

### 4. Implementation Plan for Oracle

#### Step 1: Create Wrapper Implementation

Create a wrapper in `internal/oracle/wrapper.go` that implements the `models.OracleService` interface.

#### Step 2: Update Original Service

Similar to PriceFeed, update the original `Service` to delegate to the wrapper.

## Testing Strategy

For each service:

1. Unit test the wrapper implementation
2. Integration test the original service with the wrapper
3. Ensure all existing tests pass with the new structure

## Rollout Plan

1. Implement changes in a feature branch
2. Run comprehensive tests
3. Deploy to staging environment
4. Monitor for any issues
5. Deploy to production

## Future Considerations

Once the migration is stable, we should consider:

1. Gradually migrating all dependents to use the interfaces directly
2. Eventually removing the wrapper layer if no longer needed
3. Ensuring consistent patterns across all services

## Conclusion

This migration will resolve the duplication issues while maintaining backward compatibility. It establishes a clear pattern for service implementations and promotes better code organization.