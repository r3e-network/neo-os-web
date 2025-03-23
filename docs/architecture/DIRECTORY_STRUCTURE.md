# Directory Structure Documentation

## Current Structure Issue

The Service Layer project currently has duplication between the `internal` and `internal/core` directories. Both directories contain implementations of similar services:

- gasbank
- oracle
- pricefeed
- and others

These duplicate implementations have different interfaces, structures, and behaviors, which leads to confusion, maintenance challenges, and potential bugs.

## Proposed Structure

We propose the following directory structure:

```
/internal
├── api         # API handlers and routing
├── blockchain  # Neo N3 blockchain client and utilities
├── config      # Configuration and environment handling
├── core        # Core business logic (primary service implementations)
│   ├── auth        # Authentication and authorization
│   ├── automation  # Contract automation
│   ├── functions   # JavaScript function execution
│   ├── gasbank     # Gas bank service
│   ├── oracle      # Oracle service
│   ├── pricefeed   # Price feed service
│   ├── random      # Random number generation
│   └── secrets     # Secret management
├── database    # Database connection and migrations
├── errors      # Error definitions and handling
├── metrics     # Metrics collection
├── models      # Data models and interfaces
├── monitoring  # System monitoring
├── repository  # Data access layer
├── tee         # Trusted Execution Environment
└── version     # Version information
```

## Rules for Refactoring

1. **Core Service Rule**: All primary business logic should reside in `/internal/core/*`. This includes the core service implementations.

2. **Interface Rule**: Service interfaces should be defined in `/internal/models` to be used by other components.

3. **Supporting Services Rule**: Supporting and infrastructure services should be in their respective `/internal/*` directories.

4. **Duplication Resolution Rule**: When resolving duplication:
   - Keep the more complete/robust implementation
   - Ensure all tests are updated to work with the chosen implementation
   - Maintain backward compatibility where possible

## Implementation Plan

1. For each duplicated service:
   - Compare both implementations
   - Identify the more comprehensive implementation
   - Move it to the appropriate location based on the rules above
   - Update imports and dependencies
   - Ensure tests pass

2. Remove redundant implementations after successful migration