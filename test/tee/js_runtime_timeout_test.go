package tee

import (
	"context"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
)

// TestTimeoutBasic tests that a function that exceeds the timeout is terminated
func TestTimeoutBasic(t *testing.T) {
	// Create a runtime with a short timeout (1 second)
	secretStore := newMockSecretStore()
	runtime := tee.NewJSRuntime(100, 1, secretStore)

	// Create a function with an infinite loop
	function := &models.Function{
		ID:     1,
		Name:   "InfiniteLoop",
		UserID: 1,
		SourceCode: `
            function main() {
                // Infinite loop
                while(true) {
                    // This should be interrupted by timeout
                }
                return "Should never reach here";
            }
        `,
	}

	// Execute the function
	startTime := time.Now()
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)
	duration := time.Since(startTime)

	// Verify timeout behavior
	assert.NotNil(t, result)
	assert.Equal(t, "error", result.Status)
	assert.Contains(t, result.Error, "timeout")

	// Verify that it took approximately the timeout duration (with some margin)
	assert.True(t, duration > 900*time.Millisecond, "Execution terminated too early")
	assert.True(t, duration < 2*time.Second, "Execution took too long to terminate")
}

// TestTimeoutWithCPUIntensiveTask tests timeout with a CPU-intensive calculation
func TestTimeoutWithCPUIntensiveTask(t *testing.T) {
	// Create a runtime with a short timeout (2 seconds)
	secretStore := newMockSecretStore()
	runtime := tee.NewJSRuntime(100, 2, secretStore)

	// Create a function with a CPU-intensive calculation
	function := &models.Function{
		ID:     2,
		Name:   "CPUIntensive",
		UserID: 1,
		SourceCode: `
            function main() {
                // CPU-intensive calculation that should exceed timeout
                let result = 0;
                for (let i = 0; i < 1000000000; i++) {
                    result += Math.sqrt(i * 999999);
                }
                return result;
            }
        `,
	}

	// Execute the function
	startTime := time.Now()
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)
	duration := time.Since(startTime)

	// Verify timeout behavior
	assert.NotNil(t, result)
	assert.Equal(t, "error", result.Status)
	assert.Contains(t, result.Error, "timeout")

	// Verify that it took approximately the timeout duration
	assert.True(t, duration >= 1900*time.Millisecond, "Execution terminated too early")
	assert.True(t, duration <= 4*time.Second, "Execution took too long to terminate")
}

// TestTimeoutWithNestedFunctions tests timeout with deeply nested function calls
func TestTimeoutWithNestedFunctions(t *testing.T) {
	// Create a runtime with a short timeout (1 second)
	secretStore := newMockSecretStore()
	runtime := tee.NewJSRuntime(100, 1, secretStore)

	// Create a function with deeply nested function calls
	function := &models.Function{
		ID:     3,
		Name:   "NestedFunctions",
		UserID: 1,
		SourceCode: `
            function recursiveFunction(depth) {
                if (depth <= 0) {
                    // Base case - but we'll make it run forever
                    while(true) {}
                    return "Done";
                }
                return recursiveFunction(depth - 1);
            }

            function main() {
                return recursiveFunction(10);
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)

	// Verify timeout behavior
	assert.NotNil(t, result)
	assert.Equal(t, "error", result.Status)
	assert.Contains(t, result.Error, "timeout")
}

// TestTimeoutRespectedWithinLimit tests that a function completes if it finishes within the timeout
func TestTimeoutRespectedWithinLimit(t *testing.T) {
	// Create a runtime with a reasonable timeout (3 seconds)
	secretStore := newMockSecretStore()
	runtime := tee.NewJSRuntime(100, 3, secretStore)

	// Create a function that completes within the timeout
	function := &models.Function{
		ID:     4,
		Name:   "CompleteWithinLimit",
		UserID: 1,
		SourceCode: `
            function main() {
                // Do some work but finish within the timeout
                let result = 0;
                for (let i = 0; i < 1000000; i++) {
                    result += i;
                }
                return "Completed successfully: " + result;
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)

	// Verify successful completion
	assert.NotNil(t, result)
	assert.Equal(t, "success", result.Status)
	assert.Contains(t, string(result.Result), "Completed successfully")
}

// TestTimeoutWithAsyncOperations tests timeout behavior with setTimeout operations
func TestTimeoutWithAsyncOperations(t *testing.T) {
	// Skip this test if setTimeout is not implemented in the runtime
	t.Skip("This test requires setTimeout implementation in the runtime")

	// Create a runtime with a short timeout (2 seconds)
	secretStore := newMockSecretStore()
	runtime := tee.NewJSRuntime(100, 2, secretStore)

	// Create a function that uses setTimeout to exceed the timeout
	function := &models.Function{
		ID:     5,
		Name:   "AsyncTimeout",
		UserID: 1,
		SourceCode: `
            function main() {
                return new Promise((resolve) => {
                    // Try to resolve after the timeout
                    setTimeout(() => {
                        resolve("Should never reach here");
                    }, 5000); // 5 seconds
                });
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)

	// Verify timeout behavior
	assert.NotNil(t, result)
	assert.Equal(t, "error", result.Status)
	assert.Contains(t, result.Error, "timeout")
}
