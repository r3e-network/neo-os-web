# JavaScript Function Isolation Implementation

This document describes the implementation of function isolation in the JavaScript TEE runtime for the Service Layer project.

## Overview

The function isolation feature ensures that JavaScript functions executing in the Trusted Execution Environment (TEE) are completely isolated from each other. This isolation prevents the following security issues:

1. Global variable leakage between functions
2. Built-in prototype modifications affecting other functions
3. Cross-user data access
4. State persistence between function invocations
5. Malicious global object pollution

## Implementation Details

### Creating New VM Instances

The key aspect of our implementation is creating a fresh JavaScript VM instance for each function execution, rather than reusing a single VM. This is done by updating the `ExecuteFunction` method in `internal/tee/js_runtime.go`:

```go
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Create a fresh JavaScript VM for each execution to ensure isolation
    r.vm = goja.New()
    
    // Set execution-specific state
    r.currentFunctionID = fmt.Sprintf("%d", function.ID)
    r.currentUserID = userID
    r.executionID = generateExecutionID()
    
    // Initialize the runtime with security features
    r.initialize()
    
    // ... rest of the method
}
```

### Function-Specific Execution Context

For each function execution, a specific context object is created:

```go
func (r *JSRuntime) createExecutionContext() {
    execContext := r.vm.NewObject()
    
    // Add execution-specific data
    execContext.Set("functionID", r.currentFunctionID)
    execContext.Set("userID", r.currentUserID)
    execContext.Set("executionID", r.executionID)
    execContext.Set("startTime", time.Now().Unix())
    
    // Make it available to JavaScript code
    r.vm.Set("executionContext", execContext)
}
```

### Freezing Built-in Prototypes

To prevent modifications to built-in prototypes:

```go
func (r *JSRuntime) freezeBuiltInPrototypes() {
    // Run code to freeze built-in prototypes
    freezeCode := `
        (function() {
            // Get Object.freeze function
            const freeze = Object.freeze;
            
            // List of built-in prototypes to freeze
            const prototypes = [
                Object.prototype,
                Array.prototype,
                String.prototype,
                Number.prototype,
                Boolean.prototype,
                Function.prototype,
                Date.prototype,
                RegExp.prototype,
                Error.prototype,
                Promise.prototype
            ];
            
            // Freeze each prototype
            prototypes.forEach(function(proto) {
                if (proto && typeof proto === 'object') {
                    freeze(proto);
                }
            });
        })();
    `
    
    // Execute the code to freeze prototypes
    _, err := r.vm.RunString(freezeCode)
    if err != nil {
        // Log the error but continue - this is setup code
        fmt.Printf("Error freezing prototypes: %v\n", err)
    }
}
```

### Enhanced Sandbox Security

Additional sandboxing measures are implemented:

```go
func (r *JSRuntime) enableStrictSandbox() {
    // Run code in strict mode with additional sandboxing
    sandboxCode := `
        (function() {
            "use strict";
            
            // Prevent access to Function constructor
            Object.defineProperty(window, 'Function', {
                value: undefined,
                writable: false,
                configurable: false
            });
            
            // Prevent 'with' statement usage (already prevented in strict mode)
            // Prevent access to global object through constructor chains
            Object.defineProperty(Object.prototype, 'constructor', {
                value: function() {
                    throw new Error('Access to constructor is restricted in secure function context');
                },
                writable: false,
                configurable: false
            });
        })();
    `
    
    // Execute the sandbox setup
    _, err := r.vm.RunString(sandboxCode)
    if err != nil {
        // Log the error but continue - this is setup code
        fmt.Printf("Error setting up sandbox: %v\n", err)
    }
}
```

### Proper Resource Cleanup

After function execution, resources are properly cleaned up:

```go
func (r *JSRuntime) cleanup() {
    // Clear execution-specific state
    r.currentFunctionID = ""
    r.currentUserID = 0
    r.executionID = ""
    
    // Force garbage collection to clean up VM resources
    debug.FreeOSMemory()
}
```

### IIFE Wrapping for Function Isolation

Each function is wrapped in an Immediately Invoked Function Expression (IIFE) to prevent global scope pollution:

```go
// Wrap the function in an IIFE (Immediately Invoked Function Expression)
wrapper := `
(function() {
    "use strict";
    
    %s
    
    // Verify main function exists
    if (typeof main !== "function") {
        throw new Error("Function must export a main() function");
    }
    
    // Execute main function with parameters
    return main();
})();
`

// Run the source code within the wrapper
pgm, err := goja.Compile("function", fmt.Sprintf(wrapper, function.SourceCode), false)
```

## Testing

The isolation implementation has been thoroughly tested with several test cases:

1. **Global Variables**: Tests that global variables don't leak between function executions
2. **Built-in Prototypes**: Tests that modifications to built-in prototypes don't persist
3. **User Separation**: Tests that users can't access each other's data
4. **Object Pollution**: Tests that object pollution doesn't persist between executions
5. **Consecutive Executions**: Tests that state doesn't persist across multiple executions
6. **Frozen Prototypes**: Tests that built-in prototypes are properly frozen and can't be modified
7. **Execution Context**: Tests that each function has the proper execution context

## Conclusion

The function isolation implementation provides a secure execution environment for JavaScript functions in the TEE. By creating a fresh VM for each execution and implementing various security measures, we ensure that functions can't interfere with each other, access each other's data, or persist state between executions. 