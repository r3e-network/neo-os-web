package tee

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
)

// TestGlobalVariableIsolation verifies that global variables do not persist between executions
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
	result1, err := runtime.ExecuteFunction(context.Background(), globalSetFunc, nil, 1)
	assert.NoError(t, err)
	result2, err := runtime.ExecuteFunction(context.Background(), globalGetFunc, nil, 1)
	assert.NoError(t, err)

	// Parse results
	var data1 map[string]interface{}
	var data2 map[string]interface{}
	err = json.Unmarshal(result1.Result, &data1)
	assert.NoError(t, err)
	err = json.Unmarshal(result2.Result, &data2)
	assert.NoError(t, err)

	// Verify first function created the variable
	assert.Equal(t, true, data1["created"])
	assert.Equal(t, "test data", data1["value"])

	// Verify second function cannot access the variable
	assert.Equal(t, false, data2["exists"])
	assert.Equal(t, nil, data2["value"])
}

// TestPrototypeModificationIsolation verifies that prototype modifications don't persist
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
	result1, err := runtime.ExecuteFunction(context.Background(), protoModFunc, nil, 1)
	assert.NoError(t, err)
	result2, err := runtime.ExecuteFunction(context.Background(), protoCheckFunc, nil, 1)
	assert.NoError(t, err)

	// Parse results
	var data1 map[string]interface{}
	var data2 map[string]interface{}
	err = json.Unmarshal(result1.Result, &data1)
	assert.NoError(t, err)
	err = json.Unmarshal(result2.Result, &data2)
	assert.NoError(t, err)

	// Verify first function reports prototypes are frozen
	assert.Equal(t, true, data1["frozen"], "Prototypes should be frozen")

	// Verify second function cannot see any prototype modifications
	assert.Equal(t, false, data2["hasMethod"], "Prototype modifications should not persist")
}

// TestUserDataIsolation verifies that different user contexts are isolated
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
	result1, err := runtime.ExecuteFunction(context.Background(), checkContextFunc, nil, 1)
	assert.NoError(t, err)
	result2, err := runtime.ExecuteFunction(context.Background(), checkContextFunc, nil, 2)
	assert.NoError(t, err)

	// Parse results
	var data1 map[string]interface{}
	var data2 map[string]interface{}
	err = json.Unmarshal(result1.Result, &data1)
	assert.NoError(t, err)
	err = json.Unmarshal(result2.Result, &data2)
	assert.NoError(t, err)

	// Verify each execution has the correct user ID
	assert.Equal(t, float64(1), data1["userID"], "Function should execute with user ID 1")
	assert.Equal(t, float64(2), data2["userID"], "Function should execute with user ID 2")
}

// TestExecutionStateIsolation verifies that state doesn't persist between executions
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
	result1, err := runtime.ExecuteFunction(context.Background(), stateFunc, nil, 1)
	assert.NoError(t, err)
	result2, err := runtime.ExecuteFunction(context.Background(), stateFunc, nil, 1)
	assert.NoError(t, err)
	result3, err := runtime.ExecuteFunction(context.Background(), stateFunc, nil, 1)
	assert.NoError(t, err)

	// Parse results
	var data1 map[string]interface{}
	var data2 map[string]interface{}
	var data3 map[string]interface{}
	err = json.Unmarshal(result1.Result, &data1)
	assert.NoError(t, err)
	err = json.Unmarshal(result2.Result, &data2)
	assert.NoError(t, err)
	err = json.Unmarshal(result3.Result, &data3)
	assert.NoError(t, err)

	// If isolated, each execution should start with count=1
	assert.Equal(t, float64(1), data1["count"], "First execution should start with count=1")
	assert.Equal(t, float64(1), data2["count"], "Second execution should start with count=1")
	assert.Equal(t, float64(1), data3["count"], "Third execution should start with count=1")
}

// TestFunctionExecutionContext verifies the execution context properties
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
	result, err := runtime.ExecuteFunction(context.Background(), contextFunc, nil, 3)
	assert.NoError(t, err)

	// Parse result
	var data map[string]interface{}
	err = json.Unmarshal(result.Result, &data)
	assert.NoError(t, err)

	// Verify execution context
	assert.Equal(t, "7", data["functionID"], "Function ID should be correct")
	assert.Equal(t, float64(3), data["userID"], "User ID should be correct")
	assert.Equal(t, true, data["hasExecutionID"], "Execution should have an ID")
	assert.Equal(t, true, data["hasStartTime"], "Execution should have a start time")
}

// TestResourceCleanup verifies that resources are properly cleaned up
func TestResourceCleanup(t *testing.T) {
	// Create runtime with a small memory limit to make memory usage noticeable
	secretStore := NewMockSecretStore()
	runtime := tee.NewJSRuntime(10, 30, secretStore)

	// Function that allocates a significant amount of memory
	memoryFunc := &models.Function{
		ID:     8,
		Name:   "MemoryTest",
		UserID: 1,
		SourceCode: `
            // Create a large array
            const largeArray = new Array(1000000).fill(1);
            
            function main() {
                return { arraySize: largeArray.length };
            }
        `,
	}

	// Execute the memory-intensive function multiple times
	// If cleanup is working, this shouldn't cause memory issues
	for i := 0; i < 5; i++ {
		result, err := runtime.ExecuteFunction(context.Background(), memoryFunc, nil, 1)
		assert.NoError(t, err)
		assert.Equal(t, "success", result.Status)

		var data map[string]interface{}
		err = json.Unmarshal(result.Result, &data)
		assert.NoError(t, err)
		assert.Equal(t, float64(1000000), data["arraySize"])
	}
}
