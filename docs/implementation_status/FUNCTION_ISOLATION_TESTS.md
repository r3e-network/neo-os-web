# Function Isolation Test Implementation

This document outlines the test implementation for the JavaScript function isolation feature in the Service Layer project.

## Overview

The function isolation feature requires comprehensive testing to ensure that it provides the expected level of security. The tests will verify:

1. Global variable isolation between function executions
2. Built-in prototype isolation and immutability
3. User data isolation between different user contexts
4. Execution state isolation between consecutive function calls
5. Resource cleanup after function execution

## Test Cases

### 1. Global Variable Isolation Test

This test verifies that global variables defined in one function execution do not leak into subsequent executions.

```go
func TestGlobalVariableIsolation(t *testing.T) {
    // Create runtime
    secretStore := NewMockSecretStore()
    runtime := tee.NewJSRuntime(100, 30, secretStore)

    // First function creates a global variable
    globalSetFunc := &models.Function{
        ID:     1,
        Name:   "GlobalSet",
        UserID: 1,
        SourceCode: `
            // Set a global variable
            window.globalTestVariable = "test data";
            
            function main() {
                return { created: true, value: window.globalTestVariable };
            }
        `,
    }

    // Second function tries to access the global variable
    globalGetFunc := &models.Function{
        ID:     2,
        Name:   "GlobalGet",
        UserID: 1,
        SourceCode: `
            function main() {
                return { exists: window.globalTestVariable !== undefined, value: window.globalTestVariable };
            }
        `,
    }

    // Execute the functions
    result1, _ := runtime.ExecuteFunction(context.Background(), globalSetFunc, nil, 1)
    result2, _ := runtime.ExecuteFunction(context.Background(), globalGetFunc, nil, 1)

    // Parse results
    var data1 map[string]interface{}
    var data2 map[string]interface{}
    json.Unmarshal(result1.Result, &data1)
    json.Unmarshal(result2.Result, &data2)

    // Verify first function created the variable
    assert.Equal(t, true, data1["created"])
    assert.Equal(t, "test data", data1["value"])

    // Verify second function cannot access the variable
    assert.Equal(t, false, data2["exists"])
    assert.Equal(t, nil, data2["value"])
}
```

### 2. Prototype Modification Test

This test verifies that modifications to built-in prototypes in one function do not affect subsequent executions.

```go
func TestPrototypeModificationIsolation(t *testing.T) {
    // Create runtime
    secretStore := NewMockSecretStore()
    runtime := tee.NewJSRuntime(100, 30, secretStore)

    // First function modifies a prototype
    protoModFunc := &models.Function{
        ID:     3,
        Name:   "ProtoMod",
        UserID: 1,
        SourceCode: `
            // Try to modify String prototype
            try {
                String.prototype.testMethod = function() { return "modified"; };
            } catch(e) {
                // Expected to fail in strict mode with frozen prototypes
            }
            
            function main() {
                return { 
                    hasMethod: typeof String.prototype.testMethod === "function",
                    frozen: (() => {
                        try {
                            String.prototype.anotherTest = function() {};
                            return false; // Not frozen if we can add methods
                        } catch(e) {
                            return true; // Frozen if we get an error
                        }
                    })()
                };
            }
        `,
    }

    // Second function checks if the prototype modification persists
    protoCheckFunc := &models.Function{
        ID:     4,
        Name:   "ProtoCheck",
        UserID: 1,
        SourceCode: `
            function main() {
                return { 
                    hasMethod: typeof String.prototype.testMethod === "function" 
                };
            }
        `,
    }

    // Execute the functions
    result1, _ := runtime.ExecuteFunction(context.Background(), protoModFunc, nil, 1)
    result2, _ := runtime.ExecuteFunction(context.Background(), protoCheckFunc, nil, 1)

    // Parse results
    var data1 map[string]interface{}
    var data2 map[string]interface{}
    json.Unmarshal(result1.Result, &data1)
    json.Unmarshal(result2.Result, &data2)

    // Verify first function reports prototypes are frozen
    assert.Equal(t, true, data1["frozen"], "Prototypes should be frozen")
    
    // Verify second function cannot see any prototype modifications
    assert.Equal(t, false, data2["hasMethod"], "Prototype modifications should not persist")
}
```

### 3. User Data Isolation Test

This test verifies that functions executed by different users cannot access each other's data.

```go
func TestUserDataIsolation(t *testing.T) {
    // Create runtime
    secretStore := NewMockSecretStore()
    runtime := tee.NewJSRuntime(100, 30, secretStore)

    // Function to check the execution context
    checkContextFunc := &models.Function{
        ID:     5,
        Name:   "CheckContext",
        UserID: 1, // Will be overridden in execution
        SourceCode: `
            function main() {
                return { 
                    userID: executionContext.userID
                };
            }
        `,
    }

    // Execute the function for two different users
    result1, _ := runtime.ExecuteFunction(context.Background(), checkContextFunc, nil, 1)
    result2, _ := runtime.ExecuteFunction(context.Background(), checkContextFunc, nil, 2)

    // Parse results
    var data1 map[string]interface{}
    var data2 map[string]interface{}
    json.Unmarshal(result1.Result, &data1)
    json.Unmarshal(result2.Result, &data2)

    // Verify each execution has the correct user ID
    assert.Equal(t, float64(1), data1["userID"], "Function should execute with user ID 1")
    assert.Equal(t, float64(2), data2["userID"], "Function should execute with user ID 2")
}
```

### 4. Execution State Isolation Test

This test verifies that state doesn't persist between consecutive executions of the same function.

```go
func TestExecutionStateIsolation(t *testing.T) {
    // Create runtime
    secretStore := NewMockSecretStore()
    runtime := tee.NewJSRuntime(100, 30, secretStore)

    // Function that uses and modifies state
    stateFunc := &models.Function{
        ID:     6,
        Name:   "StateTest",
        UserID: 1,
        SourceCode: `
            // Try to use a variable that should be undefined 
            // if we have proper isolation
            let count = (typeof counter !== 'undefined') ? counter + 1 : 1;
            
            // Store it for the next execution
            counter = count;
            
            function main() {
                return { count: count };
            }
        `,
    }

    // Execute the function multiple times
    result1, _ := runtime.ExecuteFunction(context.Background(), stateFunc, nil, 1)
    result2, _ := runtime.ExecuteFunction(context.Background(), stateFunc, nil, 1)
    result3, _ := runtime.ExecuteFunction(context.Background(), stateFunc, nil, 1)

    // Parse results
    var data1 map[string]interface{}
    var data2 map[string]interface{}
    var data3 map[string]interface{}
    json.Unmarshal(result1.Result, &data1)
    json.Unmarshal(result2.Result, &data2)
    json.Unmarshal(result3.Result, &data3)

    // If isolated, each execution should start with count=1
    assert.Equal(t, float64(1), data1["count"], "First execution should start with count=1")
    assert.Equal(t, float64(1), data2["count"], "Second execution should start with count=1")
    assert.Equal(t, float64(1), data3["count"], "Third execution should start with count=1")
}
```

### 5. Function Execution Context Test

This test verifies that each function execution has a proper execution context with function ID, user ID, and execution ID.

```go
func TestFunctionExecutionContext(t *testing.T) {
    // Create runtime
    secretStore := NewMockSecretStore()
    runtime := tee.NewJSRuntime(100, 30, secretStore)

    // Function that examines its execution context
    contextFunc := &models.Function{
        ID:     7,
        Name:   "ContextTest",
        UserID: 3,
        SourceCode: `
            function main() {
                return { 
                    functionID: executionContext.functionID,
                    userID: executionContext.userID,
                    hasExecutionID: typeof executionContext.executionID === 'string',
                    hasStartTime: typeof executionContext.startTime === 'number'
                };
            }
        `,
    }

    // Execute the function
    result, _ := runtime.ExecuteFunction(context.Background(), contextFunc, nil, 3)

    // Parse result
    var data map[string]interface{}
    json.Unmarshal(result.Result, &data)

    // Verify execution context
    assert.Equal(t, "7", data["functionID"], "Function ID should be correct")
    assert.Equal(t, float64(3), data["userID"], "User ID should be correct")
    assert.Equal(t, true, data["hasExecutionID"], "Execution should have an ID")
    assert.Equal(t, true, data["hasStartTime"], "Execution should have a start time")
}
```

## Integration with Main Test Suite

These tests will be integrated into the existing test suite in the `test/tee/js_runtime_isolation_test.go` file. The file will include:

1. Import statements for required packages
2. Test utility functions
3. The test functions described above
4. Any additional helper functions needed for testing

## Testing Strategy

The tests will be run as part of the normal test suite. To ensure proper coverage, they will be executed:

1. Individually during development to verify each aspect of isolation
2. As part of the complete test suite to ensure integration with other security features
3. With various security configurations to test edge cases

Additional tests may be added as the feature evolves or if issues are discovered during development. 