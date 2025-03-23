# Duplication Resolution Plan

This document outlines the specific plan for resolving duplication between `internal` and `internal/core` directories. We will follow a structured approach to ensure minimal disruption and maintain backward compatibility.

## Services with Duplication

The following services have duplicate implementations in both `internal` and `internal/core`:

1. **GasBank Service**
   - `internal/gasbank/service.go`
   - `internal/core/gasbank/service.go`

2. **Oracle Service**
   - `internal/oracle/service.go`
   - `internal/core/oracle/service.go`

3. **PriceFeed Service**
   - `internal/pricefeed/service.go`
   - `internal/core/pricefeed/service.go`

## Analysis and Approach

After comparing both implementations of each service, we have determined:

### GasBank Service
- The `internal/core/gasbank` implementation is more comprehensive with test coverage
- Strategy: Keep `internal/core/gasbank` and introduce a wrapper in `internal/gasbank` that uses the core implementation

### Oracle Service
- The `internal/core/oracle` implementation is more feature-complete
- Strategy: Keep `internal/core/oracle` and introduce a wrapper in `internal/oracle` that uses the core implementation

### PriceFeed Service
- The `internal/core/pricefeed` implementation has better architecture with separate fetchers and aggregator
- Strategy: Keep `internal/core/pricefeed` and introduce a wrapper in `internal/pricefeed` that uses the core implementation

## Step-by-Step Migration Plan

For each service, we will follow these steps:

1. Create interface definitions in the `internal/models` directory
2. Update the core implementations to implement these interfaces
3. Create wrapper implementations in the top-level `internal` directories
4. Update all imports throughout the codebase
5. Ensure all tests pass
6. Document the new structure

## Timeline

| Day | Task |
|-----|------|
| 1   | Define interfaces in `internal/models` |
| 2   | Update GasBank service and test |
| 3   | Update Oracle service and test |
| 4   | Update PriceFeed service and test |
| 5   | Update imports throughout codebase |
| 6   | Final testing and documentation |

## Success Criteria

- All tests passing 
- No duplicate business logic
- Clear separation of concerns
- Consistent directory structure
- Comprehensive documentation