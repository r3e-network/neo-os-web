# Compatibility Strategy for External Dependencies

## Overview

This document outlines our strategy for handling compatibility with external dependencies, particularly those that may undergo API changes between versions. Our service layer relies on several external packages, including the Neo-Go SDK, which can change its API between versions.

## Compatibility Layer Approach

We've implemented a compatibility layer pattern to isolate our codebase from API changes in external dependencies. This approach provides several benefits:

1. **Centralized Adaptation**: All adaptations to external API changes are made in a single location.
2. **Simplified Testing**: Compatibility layers can be easily mocked for testing.
3. **Version Documentation**: Clear documentation of which versions are supported.
4. **Graceful Degradation**: Provides fallback mechanisms when features are not available.

## Implementation

### Directory Structure

Compatibility layers are located in `internal/[package]/compat/` directories. For example:
- `internal/blockchain/compat/` - Contains Neo-Go compatibility utilities

### Neo-Go Compatibility

The Neo-Go SDK has evolved significantly across versions. Our compatibility layer handles:

1. **Wallet Account Operations**: Abstracting the creation and management of wallet accounts
2. **Transaction Types**: Handling changes in transaction structure and creation
3. **Data Types**: Converting between our internal types and Neo-Go's types (e.g., Uint160, Uint256)
4. **RPC Client**: Handling changes in the RPC client API

### Example Usage

Instead of using Neo-Go types directly:

```go
// Direct usage (brittle)
account, _ := wallet.NewAccount()
privateKey := account.PrivateKey() // May change in different versions
```

We use our compatibility layer:

```go
// Using compatibility layer
account, _ := wallet.NewAccount()
helper := compat.NewAccountHelper(account)
privateKey := helper.GetPrivateKeyHex() // Stable across versions
```

## Supported Versions

| Dependency | Versions Tested | Notes |
|------------|----------------|-------|
| Neo-Go     | v0.99.0, v0.101.1, v0.105.1 | Primary development on v0.99.0 |
| Gin        | v1.10.0        | Stable API    |
| Goja       | v0.0.0-20250309171923-bcd7cc6bf64c | JavaScript runtime |

## Upgrade Strategy

When upgrading external dependencies:

1. Update the dependency in `go.mod`
2. Run the test suite to identify breaking changes
3. Update the compatibility layer to handle any API changes
4. Document the changes in the compatibility layer
5. Update the supported versions table in this document

## Future Improvements

1. **Version Detection**: Implement runtime detection of dependency versions
2. **Feature Detection**: Test for feature availability before use
3. **Automatic Testing**: Set up CI/CD to test against multiple dependency versions 