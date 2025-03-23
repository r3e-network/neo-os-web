# Resolving Linter Errors in Service Layer

During the refactoring process to resolve duplication between `internal` and `internal/core` directories, several linter errors were identified. This document explains these errors and provides guidance on resolving them.

## Common Error Types

### 1. Missing Package Imports

Error example:
```
undefined: logger.NewLogger
```

**Resolution:**
- Ensure the correct package is imported
- Check the package path and import it correctly
- For logger.NewLogger, check the actual constructor name in the logger package

### 2. Undefined Methods

Error example:
```
s.blockchainClient.InvokeContractFunction undefined (type blockchain.Client has no field or method InvokeContractFunction)
```

**Resolution:**
- Check the interface definition in the blockchain client
- Look for an alternative method that provides similar functionality
- Update the wrapper to use the correct method name
- If no alternative exists, extend the blockchain client interface to include this method

### 3. Type Redeclaration

Error example:
```
TransactionType redeclared in this block
```

**Resolution:**
- Prefix type names with the module name to avoid conflicts (e.g., `GasBankTransactionType`)
- Use existing types from a common package if appropriate
- Consolidate duplicate types into a shared package

### 4. Method Signature Mismatch

Error example:
```
cannot use w.coreService.GetLatestPrice(symbol) (value of type *models.PriceData) as float64 value in return statement
```

**Resolution:**
- Adapt the method to convert the return type correctly
- Extract the required value from the returned object
- Update the interface to match the implementation

### 5. Struct Field Errors

Error example:
```
unknown field Module in struct literal of type logger.Logger
```

**Resolution:**
- Check the actual fields available in the struct
- Check for a constructor method instead of direct initialization
- Use reflection to inspect struct fields if needed
- Alternative: use a simple initialization like `&logger.Logger{}`

### 6. Function Argument Count Mismatch

Error example:
```
too many arguments in call to coreGasBank.NewService
```

**Resolution:**
- Check the function signature in the implementation
- Remove or add arguments to match the expected count
- Check for optional parameters or alternative constructors
- Check if the function signature has changed between versions

## Specific Resolutions for Current Issues

### 1. Logger Creation in PriceFeed and GasBank Services

**Problem:** 
- `unknown field Module in struct literal of type logger.Logger`
- `unknown field Name in struct literal of type logger.Logger`

**Resolution:**
Replace:
```go
log := &logger.Logger{
    Module: "pricefeed",
}
```

With:
```go
// Option 1: If there is a constructor
log := logger.New("pricefeed")

// Option 2: If there is no field named Module
log := &logger.Logger{}

// Option 3: Check the actual field names
log := &logger.Logger{
    Name: "pricefeed", // Use the correct field name
}
```

### 2. Core GasBank Service Constructor

**Problem:**
```
too many arguments in call to coreGasBank.NewService
have (*config.Config, models.GasBankRepository, *blockchain.Client, *tee.Manager, *logger.Logger)
want (*config.Config, *logger.Logger, models.GasBankRepository, *blockchain.Client)
```

**Resolution:**
Update the constructor call to match the expected signature:

```go
// Check the actual parameter order in the core implementation
coreService := coreGasBank.NewService(
    config,        // Config
    log,           // Logger
    repository,    // Repository
    &blockchainClient, // Blockchain Client
    // Remove teeManager if not needed by the core implementation
)
```

### 3. Blockchain Client InvokeContract Method

**Problem:**
```
s.blockchainClient.InvokeContract undefined (type blockchain.Client has no field or method InvokeContract)
```

**Resolution:**
Check the actual methods available on the blockchain client:

```go
// Option 1: Find the correct method name
result, err := s.blockchainClient.Execute(...)

// Option 2: Check the blockchain client interface and use the appropriate method
result, err := s.blockchainClient.CallContract(...)
```

## General Approach to Resolving Linter Errors

1. **Understand the error** - Carefully read the error message to understand what's wrong
2. **Find the correct implementation** - Look at the interface definitions and implementations
3. **Make minimal changes** - Modify only what's necessary to fix the error
4. **Test thoroughly** - Ensure your changes don't break existing functionality
5. **Document your changes** - Update documentation to reflect the changes made

By following these guidelines, you can systematically resolve linter errors while maintaining code quality and functionality.