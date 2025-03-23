# TEE Security Testing Specification

This document outlines the test plan for verifying the security features of the Trusted Execution Environment (TEE) JavaScript runtime.

## Test Categories

### 1. Memory Limitation Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| MEM-01 | Run function that allocates memory within limits | Function completes successfully |
| MEM-02 | Run function that attempts to allocate memory beyond limit | Function fails with memory limit error |
| MEM-03 | Run function that gradually increases memory usage | Function stops when limit is reached |
| MEM-04 | Run function that creates large arrays | Function fails when array size exceeds limit |
| MEM-05 | Run function that creates deeply nested objects | Function fails when object size exceeds limit |

#### Test MEM-02 Example:

```go
func TestMemoryLimitation(t *testing.T) {
    // Create a runtime with a very low memory limit (5MB)
    secretStore := &mockSecretStore{}
    runtime := NewJSRuntime(5, 30, secretStore)
    
    // Create a function that tries to allocate a large array
    function := &models.Function{
        ID:         "func-1",
        Name:       "MemoryHog",
        UserID:     1,
        SourceCode: `
            function main() {
                // Try to create a large array (100MB)
                const arr = new Array(100 * 1024 * 1024);
                for (let i = 0; i < arr.length; i++) {
                    arr[i] = i;
                }
                return arr.length;
            }
        `,
    }
    
    // Execute the function
    result, err := runtime.ExecuteFunction(context.Background(), function, nil, 1)
    
    // Verify that execution failed with a memory error
    assert.NotNil(t, result)
    assert.Equal(t, "error", result.Status)
    assert.Contains(t, result.Error, "memory limit exceeded")
}
```

### 2. Timeout Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| TIME-01 | Run function that completes within timeout | Function completes successfully |
| TIME-02 | Run function with an infinite loop | Function fails with timeout error |
| TIME-03 | Run function with a long but finite loop | Function completes if within timeout, fails if exceeding timeout |
| TIME-04 | Run function with a setTimeout that exceeds timeout | Function fails with timeout error |
| TIME-05 | Run function that performs CPU-intensive calculations | Function is interrupted if it exceeds timeout |

#### Test TIME-02 Example:

```go
func TestTimeoutLimitation(t *testing.T) {
    // Create a runtime with a short timeout (1 second)
    secretStore := &mockSecretStore{}
    runtime := NewJSRuntime(100, 1, secretStore)
    
    // Create a function with an infinite loop
    function := &models.Function{
        ID:         "func-2",
        Name:       "InfiniteLoop",
        UserID:     1,
        SourceCode: `
            function main() {
                while(true) {
                    // Infinite loop
                }
                return "Should never reach here";
            }
        `,
    }
    
    // Execute the function
    result, err := runtime.ExecuteFunction(context.Background(), function, nil, 1)
    
    // Verify that execution failed with a timeout error
    assert.NotNil(t, result)
    assert.Equal(t, "error", result.Status)
    assert.Contains(t, result.Error, "timeout")
}
```

### 3. Function Isolation Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| ISO-01 | Run two functions sequentially to verify isolation | Second function cannot access first function's variables |
| ISO-02 | Modify global object in first function and check in second | Second function sees unmodified global object |
| ISO-03 | Run function that attempts to store data between runs | Data is not accessible in subsequent runs |
| ISO-04 | Run function that modifies built-in prototypes | Modifications don't affect subsequent runs |
| ISO-05 | Run function that pollutes the global namespace | Pollution doesn't affect subsequent runs |

#### Test ISO-01 Example:

```go
func TestFunctionIsolation(t *testing.T) {
    secretStore := &mockSecretStore{}
    runtime := NewJSRuntime(100, 30, secretStore)
    
    // First function that sets a "global" variable
    function1 := &models.Function{
        ID:         "func-3",
        Name:       "GlobalSetter",
        UserID:     1,
        SourceCode: `
            // Set a "global" variable
            globalSecret = "super secret value";
            
            function main() {
                return "Set global variable";
            }
        `,
    }
    
    // Second function that tries to access the "global" variable
    function2 := &models.Function{
        ID:         "func-4",
        Name:       "GlobalGetter",
        UserID:     1,
        SourceCode: `
            function main() {
                // Try to access the "global" variable
                if (typeof globalSecret !== 'undefined') {
                    return globalSecret;
                }
                return "Variable not found";
            }
        `,
    }
    
    // Run the first function
    result1, _ := runtime.ExecuteFunction(context.Background(), function1, nil, 1)
    assert.Equal(t, "success", result1.Status)
    
    // Run the second function
    result2, _ := runtime.ExecuteFunction(context.Background(), function2, nil, 1)
    assert.Equal(t, "success", result2.Status)
    
    // Convert result to string for comparison
    resultStr := string(result2.Result)
    assert.Contains(t, resultStr, "Variable not found")
    assert.NotContains(t, resultStr, "super secret value")
}
```

### 4. Sandbox Security Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SBX-01 | Run function that tries to use eval | Function fails with security error |
| SBX-02 | Run function that tries to access process or require | Function fails to access these objects |
| SBX-03 | Run function that tries to modify Object prototype | Function fails or modifications are contained |
| SBX-04 | Run function that tries to access undefined globals | Function receives undefined for these accesses |
| SBX-05 | Run function that tries to make network requests to unauthorized URLs | Requests fail with security error |

#### Test SBX-01 Example:

```go
func TestSandboxSecurity(t *testing.T) {
    secretStore := &mockSecretStore{}
    runtime := NewJSRuntime(100, 30, secretStore)
    
    // Function that tries to use eval
    function := &models.Function{
        ID:         "func-5",
        Name:       "EvalAttempt",
        UserID:     1,
        SourceCode: `
            function main() {
                try {
                    // Try to use eval
                    return eval("2 + 2");
                } catch (e) {
                    return "Caught: " + e.message;
                }
            }
        `,
    }
    
    // Run the function
    result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)
    assert.Equal(t, "success", result.Status)
    
    // Verify that eval was blocked
    resultStr := string(result.Result)
    assert.Contains(t, resultStr, "Caught")
}
```

### 5. Secret Management Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| SEC-01 | Run function that accesses authorized secrets | Function gets the secrets successfully |
| SEC-02 | Run function that tries to access unauthorized secrets | Access is denied with permission error |
| SEC-03 | Run function from one user that tries to access another user's secrets | Access is denied with permission error |
| SEC-04 | Run function that tries to expose secrets outside the TEE | Secrets remain contained within the TEE |
| SEC-05 | Run function that tries to modify the secrets store | Modification attempts fail |

#### Test SEC-01 Example:

```go
func TestSecretAccess(t *testing.T) {
    // Create a mock secret store with a predefined secret
    secretStore := &mockSecretStore{
        secrets: map[int]map[string]string{
            1: {"api-key": "secret-api-key-123"},
        },
    }
    
    runtime := NewJSRuntime(100, 30, secretStore)
    
    // Function that tries to access a secret
    function := &models.Function{
        ID:         "func-6",
        Name:       "SecretAccessor",
        UserID:     1,
        SourceCode: `
            function main() {
                // Try to access the secret
                const apiKey = secrets.get("api-key");
                
                // Return a hash of the key to verify we got it without exposing it
                return crypto.sha256(apiKey).substring(0, 10);
            }
        `,
    }
    
    // Run the function
    result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)
    assert.Equal(t, "success", result.Status)
    
    // Verify that the function could access the secret
    // (we'd need to compute the expected hash for comparison)
}
```

## Integration Tests

In addition to the unit tests above, we need integration tests that verify the security of the entire TEE system:

1. **Attestation Verification Test**: Verify that the attestation process correctly validates the TEE environment.
2. **End-to-End Secret Management Test**: Test the complete lifecycle of secrets from creation to usage in functions.
3. **Function Execution Security Test**: Test the complete function execution pipeline with security checks.

## Security Acceptance Criteria

For the TEE security implementation to be considered complete, it must pass:

1. All individual test cases described above
2. Integration tests for the complete system
3. A security review by the team
4. Stress tests with multiple concurrent function executions

## Test Environment

All tests should be run in two environments:

1. **Local Development Environment**: Using mock TEE capabilities
2. **Azure Confidential Computing Environment**: Using real SGX-enabled VMs

## Test Implementation Timeline

| Week | Test Implementation Focus |
|------|---------------------------|
| 1    | Memory and Timeout Tests  |
| 2    | Isolation and Sandbox Tests |
| 3    | Secret Management Tests   |
| 4    | Integration Tests         |

## Reporting

Test results should be documented with:

1. Pass/fail status for each test
2. Performance metrics (execution time, memory usage)
3. Security findings and recommendations
4. Coverage metrics for the TEE codebase 