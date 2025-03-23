# Memory Limiter Implementation Plan

This document provides a detailed implementation plan for the memory limitation enhancement in the JavaScript TEE runtime.

## Background

The current memory limitation mechanism in `internal/tee/js_runtime.go` relies on Go's `debug.SetMemoryLimit`, which controls the Go runtime's memory usage but doesn't provide fine-grained control over the JavaScript VM's memory usage. This can lead to situations where JavaScript functions consume excessive memory without being properly restricted.

## Approach

We will implement a custom memory allocator that integrates with the Goja JavaScript engine to provide accurate memory usage tracking and enforcement of limits.

## Implementation Steps

### 1. Create Memory Limiter Interface

```go
// MemoryLimiter provides an interface for tracking and limiting memory usage
type MemoryLimiter interface {
    // Allocate requests memory allocation and returns error if limit exceeded
    Allocate(size int) error
    
    // Release notifies the limiter that memory has been freed
    Release(size int)
    
    // CurrentUsage returns the current memory usage in bytes
    CurrentUsage() int64
    
    // Limit returns the maximum allowed memory usage in bytes
    Limit() int64
    
    // Reset resets the memory usage counter
    Reset()
}
```

### 2. Implement Basic Memory Limiter

```go
// BasicMemoryLimiter implements the MemoryLimiter interface
type BasicMemoryLimiter struct {
    allocated int64
    limit     int64
    mu        sync.Mutex
}

// NewBasicMemoryLimiter creates a new memory limiter with the specified limit in MB
func NewBasicMemoryLimiter(limitMB int64) *BasicMemoryLimiter {
    return &BasicMemoryLimiter{
        allocated: 0,
        limit:     limitMB * 1024 * 1024, // Convert to bytes
    }
}

// Allocate checks if the allocation would exceed the limit
func (l *BasicMemoryLimiter) Allocate(size int) error {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    if l.allocated + int64(size) > l.limit {
        return fmt.Errorf("memory limit exceeded: would use %d bytes, limit is %d bytes", 
            l.allocated + int64(size), l.limit)
    }
    
    l.allocated += int64(size)
    return nil
}

// Release decrements the allocated memory counter
func (l *BasicMemoryLimiter) Release(size int) {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    l.allocated -= int64(size)
    if l.allocated < 0 {
        // This shouldn't happen, but prevent negative values
        l.allocated = 0
    }
}

// CurrentUsage returns the current memory usage
func (l *BasicMemoryLimiter) CurrentUsage() int64 {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    return l.allocated
}

// Limit returns the memory limit
func (l *BasicMemoryLimiter) Limit() int64 {
    return l.limit
}

// Reset resets the memory usage counter
func (l *BasicMemoryLimiter) Reset() {
    l.mu.Lock()
    defer l.mu.Unlock()
    
    l.allocated = 0
}
```

### 3. Integrate with Goja JavaScript Engine

The integration with Goja requires:

1. Adding the memory limiter to the JSRuntime struct:

```go
// JSRuntime provides a JavaScript runtime environment within the TEE
type JSRuntime struct {
    vm           *goja.Runtime
    memoryLimit  int64 // in MB
    timeoutLimit int   // in seconds
    secretStore  SecretStore
    memoryLimiter MemoryLimiter
    // ... other fields
}
```

2. Initializing it in the constructor:

```go
// NewJSRuntime creates a new JavaScript runtime
func NewJSRuntime(memoryLimit int64, timeoutLimit int, secretStore SecretStore) *JSRuntime {
    memoryLimiter := NewBasicMemoryLimiter(memoryLimit)
    
    runtime := &JSRuntime{
        vm:            goja.New(),
        memoryLimit:   memoryLimit,
        timeoutLimit:  timeoutLimit,
        secretStore:   secretStore,
        memoryLimiter: memoryLimiter,
    }

    // Initialize the runtime
    runtime.initialize()

    return runtime
}
```

3. Creating a custom array buffer allocator:

```go
// MemoryLimitedArrayBufferAllocator implements Goja's ArrayBufferAllocator interface
type MemoryLimitedArrayBufferAllocator struct {
    limiter MemoryLimiter
}

// Allocate attempts to allocate memory, checking against the limit
func (a *MemoryLimitedArrayBufferAllocator) Allocate(size int) ([]byte, error) {
    if err := a.limiter.Allocate(size); err != nil {
        return nil, err
    }
    
    return make([]byte, size), nil
}

// Free releases allocated memory
func (a *MemoryLimitedArrayBufferAllocator) Free(buf []byte) {
    a.limiter.Release(len(buf))
}
```

4. Registering the array buffer allocator with Goja:

```go
// In JSRuntime.initialize():
func (r *JSRuntime) initialize() {
    // ... existing code

    // Set up array buffer allocator with memory limits
    allocator := &MemoryLimitedArrayBufferAllocator{limiter: r.memoryLimiter}
    r.vm.SetArrayBufferAllocator(allocator)
    
    // ... rest of the initialization
}
```

### 4. Add Object Size Tracking

We need to enhance the memory limiter to track object allocations as well as array buffers:

```go
// Hook into object creation to track object size
func (r *JSRuntime) trackObjectCreation() {
    // Get Object.prototype.constructor
    objectConstructor := r.vm.Get("Object").ToObject(r.vm).Get("prototype").ToObject(r.vm).Get("constructor")
    
    // Create a proxy for new objects
    proxyConstructor := r.vm.ToValue(func(call goja.FunctionCall) goja.Value {
        // Estimate object size (simplified implementation)
        estimatedSize := 64 // Base object overhead
        
        // Try to allocate memory
        if err := r.memoryLimiter.Allocate(estimatedSize); err != nil {
            panic(r.vm.ToValue(err.Error()))
        }
        
        // Call original constructor
        return objectConstructor.ToObject(r.vm).Call(nil, call.Arguments...)
    })
    
    // Replace Object constructor
    r.vm.Set("Object", proxyConstructor)
}
```

### 5. Add Array Size Tracking

Similar to object tracking, we need to track array allocations:

```go
// Hook into array creation to track array size
func (r *JSRuntime) trackArrayCreation() {
    // Get Array constructor
    arrayConstructor := r.vm.Get("Array").ToObject(r.vm)
    
    // Create a proxy for new arrays
    proxyConstructor := r.vm.ToValue(func(call goja.FunctionCall) goja.Value {
        // Estimate array size (simplified implementation)
        estimatedSize := 32 // Base array overhead
        
        // If length is provided, add size for elements
        if len(call.Arguments) > 0 {
            length := call.Arguments[0].ToInteger()
            estimatedSize += int(length) * 8 // Assuming 8 bytes per element pointer
        }
        
        // Try to allocate memory
        if err := r.memoryLimiter.Allocate(estimatedSize); err != nil {
            panic(r.vm.ToValue(err.Error()))
        }
        
        // Call original constructor
        return arrayConstructor.Call(nil, call.Arguments...)
    })
    
    // Replace Array constructor
    r.vm.Set("Array", proxyConstructor)
}
```

### 6. Reset Memory Usage Between Function Executions

We need to ensure that the memory limiter is reset between function executions:

```go
// In ExecuteFunction method:
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // Reset memory usage counter at the start
    r.memoryLimiter.Reset()
    
    // ... rest of the method
}
```

### 7. Handle Out-of-Memory Errors Gracefully

We need to catch memory allocation errors and handle them gracefully:

```go
// Add to ExecuteFunction method:
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
    // ... existing code
    
    // Execute the function in a goroutine to allow for timeout
    done := make(chan struct{})
    var execErr error
    var jsResult goja.Value

    go func() {
        defer func() {
            if r := recover(); r != nil {
                // Check if this is a memory error
                if err, ok := r.(error); ok && strings.Contains(err.Error(), "memory limit exceeded") {
                    execErr = fmt.Errorf("memory limit exceeded: %v", err)
                } else {
                    execErr = fmt.Errorf("execution panicked: %v", r)
                }
            }
            close(done)
        }()
        
        // ... existing function execution code
    }()
    
    // ... rest of the method
}
```

## Testing Strategy

We will test the memory limiter with the following test cases:

1. **Basic Memory Tracking**: Verify that the memory limiter accurately tracks memory usage.
2. **Memory Limit Enforcement**: Test that the limiter prevents allocations that would exceed the limit.
3. **Array Allocation Tracking**: Ensure that array allocations are properly tracked.
4. **Object Allocation Tracking**: Verify that object allocations are properly tracked.
5. **Memory Release**: Test that memory is properly released when no longer needed.
6. **Concurrent Allocations**: Ensure the limiter works correctly with concurrent allocations.

See the [TEE_SECURITY_TESTS.md](TEE_SECURITY_TESTS.md) document for detailed test cases, particularly the MEM-01 through MEM-05 tests.

## Timeline

| Task | Timeline | Dependencies |
|------|----------|--------------|
| Create Memory Limiter Interface | Day 1 | None |
| Implement Basic Memory Limiter | Day 1-2 | Memory Limiter Interface |
| ArrayBuffer Allocator Integration | Day 2-3 | Basic Memory Limiter |
| Object Size Tracking | Day 3-4 | ArrayBuffer Integration |
| Array Size Tracking | Day 3-4 | ArrayBuffer Integration |
| Reset and Error Handling | Day 4-5 | Previous implementations |
| Unit Tests | Day 5-7 | All implementations |
| Integration Tests | Day 7-8 | Unit Tests |

## Success Criteria

The memory limiter implementation will be considered successful when:

1. It accurately tracks memory usage for all JavaScript objects, arrays, and buffers.
2. It correctly enforces the memory limit specified during runtime creation.
3. JavaScript functions that attempt to exceed the memory limit fail gracefully with clear error messages.
4. The implementation has minimal performance impact on normal function execution.
5. All test cases pass, including those in the TEE_SECURITY_TESTS.md document.

## References

1. [Goja JavaScript Engine Documentation](https://github.com/dop251/goja)
2. [V8 Memory Management](https://v8.dev/blog/free-tracking)
3. [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management) 