# JavaScript Runtime Timeout Implementation

This document outlines the detailed implementation plan for enhancing the timeout mechanism in the JavaScript TEE runtime.

## Background

The current timeout implementation in `internal/tee/js_runtime.go` uses context cancellation to terminate function execution, but it doesn't provide fine-grained control over long-running operations within the JavaScript environment. This could lead to situations where JavaScript functions containing infinite loops or excessively long operations might not be properly interrupted.

## Approach

We will implement an improved timeout mechanism that:

1. Regularly interrupts the JavaScript VM to check for timeout conditions
2. Provides graceful termination of functions that exceed their time limit
3. Ensures proper cleanup of resources after a timeout
4. Gives detailed feedback about where the timeout occurred

## Implementation Steps

### 1. Add Interrupt Mechanism

We'll add an interrupt channel and ticker to regularly check for timeout conditions:

```go
// Add to JSRuntime struct
type JSRuntime struct {
    // Existing fields...
    interruptCh   chan struct{} // Channel for interrupt signals
    interruptTick time.Duration // How often to check for interrupts (e.g., 100ms)
}

// Update the NewJSRuntime constructor
func NewJSRuntime(memoryLimit int64, timeoutLimit int, secretStore SecretStore) *JSRuntime {
    runtime := &JSRuntime{
        vm:            goja.New(),
        memoryLimit:   memoryLimit,
        timeoutLimit:  timeoutLimit,
        secretStore:   secretStore,
        interruptTick: 100 * time.Millisecond,
    }

    // Initialize the runtime
    runtime.initialize()

    return runtime
}
```

### 2. Implement Interrupt Checker Goroutine

```go
// Add to ExecuteFunction method
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Create timeout context
    ctxWithTimeout, cancel := context.WithTimeout(ctx, time.Duration(r.timeoutLimit)*time.Second)
    defer cancel()
    
    // Create interrupt channel
    r.interruptCh = make(chan struct{})
    defer close(r.interruptCh)
    
    // Start interrupt checker goroutine
    go r.runInterruptChecker(ctxWithTimeout)
    
    // ... rest of the method
}

// Add new method for interrupt checking
func (r *JSRuntime) runInterruptChecker(ctx context.Context) {
    ticker := time.NewTicker(r.interruptTick)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            // Check if context is done (timeout reached)
            if ctx.Err() != nil {
                // Interrupt the JavaScript execution
                r.vm.Interrupt("execution timeout after " + time.Duration(r.timeoutLimit).String())
                return
            }
        case <-r.interruptCh:
            // Normal termination - exit the goroutine
            return
        }
    }
}
```

### 3. Add VM Interrupt Handler

We need to ensure the VM properly handles the interrupt:

```go
// Add to initialize method
func (r *JSRuntime) initialize() {
    // ... existing code
    
    // Register callback for VM interrupts
    r.vm.SetInterruptHandler(func() bool {
        // Check if context is done
        select {
        case <-r.interruptCh:
            // Normal termination, don't terminate JS execution
            return false
        default:
            // Forced interrupt due to timeout
            return true // Return true to terminate JS execution
        }
    })
    
    // ... rest of the initialization
}
```

### 4. Handle Infinite Loops with Loop Counter

To detect and interrupt infinite loops more reliably, we'll add a loop counter:

```go
// Add to JSRuntime struct
type JSRuntime struct {
    // Existing fields...
    loopCount       int64
    maxLoopCount    int64
    loopCountMutex  sync.Mutex
}

// Update initialize method
func (r *JSRuntime) initialize() {
    // ... existing code
    
    // Reset loop counter
    r.loopCount = 0
    r.maxLoopCount = 10000000 // Allow 10 million iterations before considering it an infinite loop
    
    // Register loop interrupt handler
    r.vm.SetLoopInterrupt(func() bool {
        r.loopCountMutex.Lock()
        r.loopCount++
        count := r.loopCount
        r.loopCountMutex.Unlock()
        
        // Check if loop count exceeded
        if count > r.maxLoopCount {
            return true // Interrupt the loop
        }
        
        // Otherwise let the loop continue
        return false
    })
    
    // ... rest of the initialization
}
```

### 5. Add Timeout Detection for Function Calls

We'll also monitor function calls to detect long-running functions:

```go
// Add method to track function calls
func (r *JSRuntime) trackFunctionCalls() {
    // Get Function.prototype.call
    fnProtoCall := r.vm.Get("Function").ToObject(r.vm).Get("prototype").ToObject(r.vm).Get("call")
    originalCall := fnProtoCall.Export().(func(goja.FunctionCall) goja.Value)
    
    // Override with our instrumented version
    r.vm.Set("Function", r.vm.ToValue(func(call goja.FunctionCall) goja.Value {
        // Check for timeout before each function call
        select {
        case <-r.interruptCh:
            panic(r.vm.ToValue("function execution interrupted due to timeout"))
        default:
            // Continue with normal function call
            return originalCall(call)
        }
    }))
}
```

### 6. Cleanup Resources After Timeout

Ensure we properly clean up resources when a timeout occurs:

```go
// Update the ExecuteFunction method
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // ... existing code
    
    // Execute the function in a goroutine
    done := make(chan struct{})
    var execErr error
    var jsResult goja.Value

    go func() {
        defer func() {
            if r := recover(); r != nil {
                // Handle timeout panics specifically
                if err, ok := r.(error); ok && strings.Contains(err.Error(), "interrupted") {
                    execErr = fmt.Errorf("function execution timed out after %d seconds", r.timeoutLimit)
                } else {
                    execErr = fmt.Errorf("execution panicked: %v", r)
                }
            }
            close(done)
        }()
        
        // ... existing function execution code
    }()
    
    // Wait for function to complete or timeout
    select {
    case <-done:
        // Function completed normally
    case <-ctxWithTimeout.Done():
        // Context timeout - but we don't need to do anything here
        // The interrupt checker will have already triggered VM interruption
        // Just wait for the goroutine to finish cleanup
        <-done
    }
    
    // ... handle results and return
}
```

### 7. Add Detailed Timeout Reporting

Enhance the execution result to provide more details about timeouts:

```go
// Update error handling in ExecuteFunction
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // ... existing code
    
    // Handle errors in result
    if execErr != nil {
        result.Status = "error"
        
        // Add specific timeout information
        if strings.Contains(execErr.Error(), "timed out") {
            result.Error = fmt.Sprintf("Function execution timed out after %d seconds", r.timeoutLimit)
            result.TimeoutDetails = &models.TimeoutDetails{
                TimeoutLimit: r.timeoutLimit,
                LoopCount:   r.loopCount,
                StackTrace:  getStackTrace(r.vm), // Helper to get current JS stack
            }
        } else {
            result.Error = execErr.Error()
        }
        
        // ... rest of error handling
    }
    
    // ... rest of the method
}

// Helper function to get JavaScript stack trace
func getStackTrace(vm *goja.Runtime) string {
    // This is a simplified version - actual implementation would use
    // Goja's runtime capabilities to extract the current execution state
    return "Stack trace not available" // Placeholder
}
```

### 8. Reset State Between Executions

Ensure we reset all timeout-related state between executions:

```go
// Add to ExecuteFunction at the beginning
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Reset state for this execution
    r.loopCountMutex.Lock()
    r.loopCount = 0
    r.loopCountMutex.Unlock()
    
    // ... rest of the method
}
```

## Testing Strategy

We'll test the timeout mechanism with the following test cases:

1. **Basic Timeout**: Verify that functions that exceed the timeout limit are properly terminated.
2. **Infinite Loop**: Test that infinite loops are detected and interrupted.
3. **CPU-Intensive Operations**: Ensure CPU-intensive calculations are interrupted on timeout.
4. **Nested Functions**: Test timeouts in deeply nested function calls.
5. **Async Operations**: Check timeout behavior with setTimeout and other async operations.

See the [TEE_SECURITY_TESTS.md](TEE_SECURITY_TESTS.md) document for detailed test cases, particularly the TIME-01 through TIME-05 tests.

## Timeline

| Task | Timeline | Dependencies |
|------|----------|--------------|
| Add Interrupt Mechanism | Day 1 | None |
| Implement Interrupt Checker | Day 1-2 | Interrupt Mechanism |
| VM Interrupt Handler | Day 2 | Interrupt Checker |
| Loop Counter Implementation | Day 2-3 | VM Interrupt Handler |
| Function Call Tracking | Day 3-4 | Loop Counter |
| Resource Cleanup | Day 4 | Function Call Tracking |
| Timeout Reporting | Day 4-5 | Resource Cleanup |
| Unit Tests | Day 5-6 | All implementations |
| Integration Tests | Day 6-7 | Unit Tests |

## Success Criteria

The timeout implementation will be considered successful when:

1. Functions that exceed their timeout limit are properly terminated.
2. All resources are properly cleaned up after a timeout.
3. Timeout errors include detailed information about where the timeout occurred.
4. The implementation has minimal performance impact on normal function execution.
5. All test cases pass, including those in the TEE_SECURITY_TESTS.md document.

## References

1. [Goja JavaScript Engine Documentation](https://github.com/dop251/goja)
2. [Go Context Package](https://golang.org/pkg/context/)
3. [JavaScript Execution Model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop) 