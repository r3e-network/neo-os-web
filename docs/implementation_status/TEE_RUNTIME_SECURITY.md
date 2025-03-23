# TEE JavaScript Runtime Security Enhancements

This document provides the technical design for implementing enhanced security features in the JavaScript Trusted Execution Environment (TEE) runtime.

## Current Implementation

The current JavaScript runtime (`internal/tee/js_runtime.go`) uses the Goja JavaScript engine with basic security measures:

- Removing unsafe globals like `eval` and `Function`
- Setting up memory limits using `debug.SetMemoryLimit`
- Implementing a secure fetch API with URL validation
- Providing a secure secret access mechanism
- Adding context-based timeout for function execution

## Security Enhancements

Based on the findings in `PRODUCTION_READINESS.md` and `COMPONENTS.md`, we need to implement the following security enhancements:

### 1. Enhanced Memory Limitations

**Current issue:** The memory limiting mechanism relies on Go's `debug.SetMemoryLimit`, which only restricts the Go runtime's memory usage, not specifically the JavaScript VM's memory.

**Solution:**

```go
// Implement a custom memory allocator for the JavaScript runtime
type MemoryLimitedAllocator struct {
    allocated int64
    limit     int64
}

func NewMemoryLimitedAllocator(limitMB int64) *MemoryLimitedAllocator {
    return &MemoryLimitedAllocator{
        allocated: 0,
        limit:     limitMB * 1024 * 1024, // Convert to bytes
    }
}

func (a *MemoryLimitedAllocator) Allocate(size int) ([]byte, error) {
    if a.allocated + int64(size) > a.limit {
        return nil, errors.New("memory limit exceeded")
    }
    
    a.allocated += int64(size)
    return make([]byte, size), nil
}

func (a *MemoryLimitedAllocator) Release(size int) {
    a.allocated -= int64(size)
    if a.allocated < 0 {
        a.allocated = 0
    }
}
```

We will integrate this with Goja by extending the runtime initialization:

```go
// In JSRuntime.initialize():
allocator := NewMemoryLimitedAllocator(r.memoryLimit)
r.vm.SetMemoryLimiter(allocator)
```

### 2. Improved Timeout Implementation

**Current issue:** The current timeout implementation only applies at the function execution level, not for individual operations within a function.

**Solution:**

Implement an interrupt mechanism that regularly checks if execution has exceeded the allowed time:

```go
// Add to JSRuntime struct
type JSRuntime struct {
    // Existing fields...
    interruptCh chan struct{} // Channel for interrupt signals
}

// Implementation in ExecuteFunction
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Set up interrupt channel
    r.interruptCh = make(chan struct{})
    
    // Start an interrupt checker goroutine
    go func() {
        ticker := time.NewTicker(100 * time.Millisecond)
        defer ticker.Stop()
        
        for {
            select {
            case <-ticker.C:
                // Check if context is done
                if ctx.Err() != nil {
                    r.vm.Interrupt("execution timeout")
                    close(r.interruptCh)
                    return
                }
            case <-r.interruptCh:
                return
            }
        }
    }()
    
    // Cleanup interrupt goroutine when done
    defer func() {
        close(r.interruptCh)
    }()
    
    // Existing implementation...
}
```

### 3. Function Isolation

**Current issue:** The current implementation doesn't fully reset the JavaScript environment between function executions.

**Solution:**

Create a new runtime for each function execution to ensure complete isolation:

```go
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Create a completely new VM for each execution
    r.vm = goja.New()
    
    // Initialize the runtime with security measures
    r.initialize()
    
    // Continue with existing implementation...
}
```

### 4. Enhanced Runtime Sandboxing

**Current issue:** The JavaScript code can access more functionality than required.

**Solution:**

1. Implement a content security policy mechanism:

```go
type JSSecurityPolicy struct {
    allowedURLs     []string
    allowedAPIs     map[string]bool
    maxLoopCount    int
    maxObjectSize   int
    maxArrayLength  int
}

func NewJSSecurityPolicy() *JSSecurityPolicy {
    return &JSSecurityPolicy{
        allowedURLs: []string{},
        allowedAPIs: map[string]bool{
            "console": true,
            "fetch": true,
            "secrets": true,
            "crypto": true,
        },
        maxLoopCount: 10000,
        maxObjectSize: 1000,
        maxArrayLength: 10000,
    }
}
```

2. Implement a loop counter to prevent infinite loops:

```go
// Add a loop counter to JSRuntime
type JSRuntime struct {
    // Existing fields
    loopCount int
    policy    *JSSecurityPolicy
}

// Register loop hook with the VM
func (r *JSRuntime) initialize() {
    // Existing implementation
    
    r.vm.SetLoopInterrupt(func() bool {
        r.loopCount++
        if r.loopCount > r.policy.maxLoopCount {
            return true // Interrupt the loop
        }
        return false
    })
}
```

3. Add property access monitoring:

```go
// Monitor and restrict property access
func (r *JSRuntime) restrictGlobalAccess() {
    wrapper := r.vm.NewObject()
    
    // For each built-in object, proxy access through our wrapper
    global := r.vm.GlobalObject()
    
    for key, allowed := range r.policy.allowedAPIs {
        if allowed {
            wrapper.Set(key, global.Get(key))
        }
    }
    
    // Replace global object with our wrapper
    // This is a simplification - actual implementation would be more complex
    r.vm.SetGlobalObject(wrapper)
}
```

### 5. Enhanced Secret Management

**Current issue:** The current secret management doesn't include access control beyond the user ID.

**Solution:**

Implement a more granular access control system for secrets:

```go
// Define a SecretAccessContext
type SecretAccessContext struct {
    UserID      int
    FunctionID  string
    ExecutionID string
    AccessTime  time.Time
}

// Update the SecretStore interface
type SecretStore interface {
    GetSecret(ctx context.Context, accessCtx SecretAccessContext, name string) (string, error)
}

// Update the secret access method
func (r *JSRuntime) secureGetSecret(call goja.FunctionCall) goja.Value {
    // Existing validation
    
    // Create access context with full metadata
    accessCtx := SecretAccessContext{
        UserID:      userID,
        FunctionID:  r.functionID,  // Need to store this in JSRuntime
        ExecutionID: r.executionID, // Need to store this in JSRuntime
        AccessTime:  time.Now(),
    }
    
    // Access the secret with context
    secretValue, err := r.secretStore.GetSecret(context.Background(), accessCtx, secretName)
    
    // Continue with existing implementation
}
```

## Implementation Plan

1. Create unit tests for each security feature
2. Implement memory limitations
3. Enhance timeout mechanism
4. Add function isolation improvements
5. Implement enhanced runtime sandboxing
6. Improve secret management

## Success Criteria

The implementation will be considered successful when:

1. Memory-intensive functions are properly limited and fail gracefully
2. Functions that run too long are properly terminated
3. Malicious code cannot escape the sandbox
4. Each function execution is fully isolated from others
5. Secret access is properly controlled and audited
6. All tests pass, demonstrating the effectiveness of the security measures

## References

1. Goja JavaScript engine documentation
2. OWASP guidelines for secure JavaScript execution
3. Azure Confidential Computing best practices 