# JavaScript Function Isolation Implementation

This document outlines the detailed implementation plan for enhancing function isolation in the JavaScript TEE runtime.

## Background

The current JavaScript runtime implementation in `internal/tee/js_runtime.go` creates a single VM instance that is reused for multiple function executions. This approach can lead to state leakage between function executions, as global variables or modified prototypes from one execution might affect subsequent executions. This poses a security risk in a multi-tenant environment where different users' functions should be completely isolated from each other.

## Approach

We will implement an improved function isolation mechanism that:

1. Creates a fresh JavaScript VM for each function execution
2. Ensures no state is shared between function executions
3. Prevents modifications to built-in prototypes from persisting
4. Isolates global variables between different function executions
5. Implements proper cleanup after function execution

## Implementation Steps

### 1. Update JSRuntime to Create New VM per Execution

```go
// Update ExecuteFunction method to create a new VM for each execution
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Create a fresh JavaScript VM for each execution
    r.vm = goja.New()
    
    // Initialize the runtime with security features
    r.initialize()
    
    // ... rest of the method
}
```

### 2. Manage Runtime State Properly

We need to ensure that the JSRuntime struct properly manages state across VM recreations:

```go
// Add execution-specific state to JSRuntime
type JSRuntime struct {
    // Existing fields...
    
    // Execution-specific state (reset for each execution)
    currentFunctionID string
    currentUserID     int
    executionID       string
    
    // Persistent state (maintained across executions)
    secretStore       SecretStore
    memoryLimit       int64
    timeoutLimit      int
}

// Update ExecuteFunction to set execution-specific state
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Create a fresh JavaScript VM for each execution
    r.vm = goja.New()
    
    // Set execution-specific state
    r.currentFunctionID = function.ID
    r.currentUserID = userID
    r.executionID = generateExecutionID()
    
    // Initialize the runtime with security features
    r.initialize()
    
    // ... rest of the method
}
```

### 3. Enhance Global Object Compartmentalization

We'll implement stronger compartmentalization of the global object:

```go
// Add method to create a secure global object
func (r *JSRuntime) createSecureGlobalObject() {
    // Create a secure object to serve as global
    secureGlobal := r.vm.NewObject()
    
    // Only expose whitelisted global objects
    allowedGlobals := map[string]bool{
        "console": true,
        "JSON": true,
        "Math": true,
        "Date": true,
        "RegExp": true,
        "String": true,
        "Number": true,
        "Boolean": true,
        "Array": true,
        "Object": true,
        "Error": true,
        "TypeError": true,
        "SyntaxError": true,
        "RangeError": true,
    }
    
    // Get original global object
    origGlobal := r.vm.GlobalObject()
    
    // Copy allowed properties only
    for name, allowed := range allowedGlobals {
        if allowed {
            if val := origGlobal.Get(name); val != nil {
                secureGlobal.Set(name, val)
            }
        }
    }
    
    // Add our secure APIs
    secureGlobal.Set("fetch", r.secureFetch)
    secureGlobal.Set("secrets", r.createSecretAPI())
    secureGlobal.Set("crypto", r.createCryptoAPI())
    
    // Use the secure global as the new global object
    // Note: In practice, Goja might not allow direct replacement of global object
    // This is a conceptual implementation that would need adaptation to Goja's APIs
    r.vm.SetGlobalObject(secureGlobal)
}
```

### 4. Implement Prototype Freezing

To prevent modifications to built-in prototypes:

```go
// Add method to freeze built-in prototypes
func (r *JSRuntime) freezeBuiltInPrototypes() {
    // Get Object.freeze function
    freeze := r.vm.Get("Object").ToObject(r.vm).Get("freeze")
    
    // List of built-in prototypes to freeze
    prototypes := []string{
        "Object.prototype",
        "Array.prototype",
        "String.prototype",
        "Number.prototype",
        "Boolean.prototype",
        "Function.prototype",
        "Date.prototype",
        "RegExp.prototype",
        "Error.prototype",
    }
    
    // Freeze each prototype
    for _, path := range prototypes {
        parts := strings.Split(path, ".")
        var obj goja.Value = r.vm.GlobalObject()
        
        // Navigate the object path
        for _, part := range parts {
            if obj == nil || goja.IsUndefined(obj) || goja.IsNull(obj) {
                break
            }
            obj = obj.ToObject(r.vm).Get(part)
        }
        
        // Freeze the prototype if it exists
        if obj != nil && !goja.IsUndefined(obj) && !goja.IsNull(obj) {
            freeze.ToObject(r.vm).Call(nil, obj)
        }
    }
}
```

### 5. Implement Execution Context

Create an execution context that provides a secure way to access execution-specific data:

```go
// Add method to create execution context
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

### 6. Implement Strict Sandbox Mode

Enable strict mode and add additional sandboxing:

```go
// Add method to enable strict sandbox mode
func (r *JSRuntime) enableStrictSandbox() {
    // Run code in strict mode
    strictModeCode := `"use strict";`
    
    // Add sandbox setup code
    sandboxCode := `
        // Prevent defining or accessing global variables directly
        (function() {
            const originalEval = eval;
            eval = function(code) {
                if (typeof code === 'string' && code.includes('with')) {
                    throw new Error('The with statement is not allowed in secure function context');
                }
                return originalEval('use strict; ' + code);
            };
            
            // Prevent access to global object via constructor chains
            Object.prototype.constructor.constructor = function() {
                throw new Error('Access to Function constructor is not allowed in secure function context');
            };
        })();
    `
    
    // Execute the sandbox setup
    _, err := r.vm.RunString(strictModeCode + sandboxCode)
    if err != nil {
        // Log the error but continue - this is setup code
        fmt.Printf("Error setting up sandbox: %v\n", err)
    }
}
```

### 7. Add Complete Cleanup After Execution

Ensure proper cleanup after function execution:

```go
// Add cleanup method
func (r *JSRuntime) cleanup() {
    // Clear VM reference to allow garbage collection
    r.vm = nil
    
    // Reset execution-specific state
    r.currentFunctionID = ""
    r.currentUserID = 0
    r.executionID = ""
    
    // Force garbage collection
    runtime.GC()
}

// Update ExecuteFunction to call cleanup
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // ... existing implementation
    
    // Add defer for cleanup
    defer r.cleanup()
    
    // ... rest of the method
}
```

### 8. Update Function Secret Access

Update the secret access mechanism to work with the isolated execution context:

```go
// Update secureGetSecret method
func (r *JSRuntime) secureGetSecret(call goja.FunctionCall) goja.Value {
    if len(call.Arguments) < 1 {
        panic(r.vm.ToValue("Secret access requires a secret name"))
    }

    secretName := call.Arguments[0].String()

    // Get userID directly from our runtime state
    userID := r.currentUserID

    // Access the secret store to get the actual secret
    secretValue, err := r.secretStore.GetSecret(context.Background(), userID, secretName)
    if err != nil {
        panic(r.vm.ToValue(fmt.Sprintf("Error retrieving secret: %v", err)))
    }

    return r.vm.ToValue(secretValue)
}
```

## Testing Strategy

We'll test the function isolation mechanism with the following test cases:

1. **Global Variable Isolation**: Verify that global variables set in one function execution are not visible in another.
2. **Prototype Isolation**: Test that modifications to built-in prototypes don't affect subsequent executions.
3. **Context Isolation**: Ensure that execution context is properly isolated between function executions.
4. **Memory Cleanup**: Verify that memory is properly released after function execution.
5. **Cross-User Isolation**: Test that functions from different users cannot access each other's data.

See the [TEE_SECURITY_TESTS.md](TEE_SECURITY_TESTS.md) document for detailed test cases, particularly the ISO-01 through ISO-05 tests.

## Timeline

| Task | Timeline | Dependencies |
|------|----------|--------------|
| Update JSRuntime for VM per Execution | Day 1 | None |
| Runtime State Management | Day 1-2 | JSRuntime Update |
| Global Object Compartmentalization | Day 2-3 | Runtime State Management |
| Prototype Freezing | Day 3 | Global Object Compartmentalization |
| Execution Context Implementation | Day 3-4 | Prototype Freezing |
| Strict Sandbox Mode | Day 4 | Execution Context |
| Cleanup Implementation | Day 4-5 | All previous tasks |
| Unit Tests | Day 5-6 | All implementations |
| Integration Tests | Day 6-7 | Unit Tests |

## Success Criteria

The function isolation implementation will be considered successful when:

1. Functions cannot access global variables or state from previous executions.
2. Modifications to built-in prototypes don't affect subsequent function executions.
3. Functions from different users cannot access each other's data.
4. Memory is properly released after each function execution.
5. All test cases pass, including those in the TEE_SECURITY_TESTS.md document.

## References

1. [Goja JavaScript Engine Documentation](https://github.com/dop251/goja)
2. [JavaScript Secure Coding Practices](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
3. [V8 Isolates Concept](https://v8.dev/docs/embed) 