package tee

import (
	"context"
	"strings"
	"testing"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
)

// TestInputValidation tests that malicious inputs are caught and rejected
func TestInputValidation(t *testing.T) {
	// Create runtime
	secretStore := NewMockSecretStore()
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Test with malicious params
	maliciousParams := map[string]interface{}{
		"script": "<script>alert('xss')</script>",
		"html":   "<img src='x' onerror='alert(1)'>",
		"code":   "javascript:alert(1)",
	}

	// Function that uses params
	function := &models.Function{
		ID:     1,
		Name:   "InputValidator",
		UserID: 1,
		SourceCode: `
            function main() {
                return params;
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), function, maliciousParams, 1)

	// Should fail with validation error
	assert.Equal(t, "error", result.Status)
	assert.Contains(t, string(result.Result), "validation error")
}

// TestNetworkAccessControl tests that fetch API security controls work
func TestNetworkAccessControl(t *testing.T) {
	// Create runtime
	secretStore := NewMockSecretStore()
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Function that tries to access a non-allowlisted domain
	nonAllowedDomainFunc := &models.Function{
		ID:     2,
		Name:   "NonAllowedDomain",
		UserID: 1,
		SourceCode: `
            async function main() {
                try {
                    await fetch("https://malicious-domain.example");
                    return "Success"; // Should not reach here
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), nonAllowedDomainFunc, nil, 1)

	// Should fail with domain not in allowlist
	assert.Equal(t, "success", result.Status)
	assert.Contains(t, string(result.Result), "Domain not in allowlist")

	// Function that tries to use HTTP instead of HTTPS
	httpFunc := &models.Function{
		ID:     3,
		Name:   "HttpProtocol",
		UserID: 1,
		SourceCode: `
            async function main() {
                try {
                    await fetch("http://api.coingecko.com");
                    return "Success"; // Should not reach here
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ = runtime.ExecuteFunction(context.Background(), httpFunc, nil, 1)

	// Should fail with HTTPS requirement
	assert.Equal(t, "success", result.Status)
	assert.Contains(t, string(result.Result), "Only HTTPS URLs are allowed")

	// Function that tries to use invalid method
	invalidMethodFunc := &models.Function{
		ID:     4,
		Name:   "InvalidMethod",
		UserID: 1,
		SourceCode: `
            async function main() {
                try {
                    await fetch("https://api.coingecko.com", {
                        method: "INVALID_METHOD"
                    });
                    return "Success"; // Should not reach here
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ = runtime.ExecuteFunction(context.Background(), invalidMethodFunc, nil, 1)

	// Should fail with invalid method
	assert.Equal(t, "success", result.Status)
	assert.Contains(t, string(result.Result), "Invalid HTTP method")
}

// TestSandboxSecurity tests that the sandbox security features work
func TestSandboxSecurity(t *testing.T) {
	// Create runtime
	secretStore := NewMockSecretStore()
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Function that tries to access the global object
	globalAccessFunc := &models.Function{
		ID:     5,
		Name:   "GlobalAccess",
		UserID: 1,
		SourceCode: `
            function main() {
                try {
                    // Try to access global window object
                    let win = window || this;
                    return "Got global: " + (typeof win);
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), globalAccessFunc, nil, 1)

	// Should fail or return undefined/protected type
	assert.Equal(t, "success", result.Status)
	// Either we get an error or window is undefined
	assert.True(t,
		strings.Contains(string(result.Result), "Error") ||
			strings.Contains(string(result.Result), "undefined"),
		"Expected error or undefined for global access attempt, got: %s", string(result.Result))

	// Function that tries to modify a built-in prototype
	protoModFunc := &models.Function{
		ID:     6,
		Name:   "PrototypeModification",
		UserID: 1,
		SourceCode: `
            function main() {
                try {
                    // Try to modify String prototype
                    String.prototype.evil = function() { return "evil"; };
                    return "Modified: " + "test".evil();
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ = runtime.ExecuteFunction(context.Background(), protoModFunc, nil, 1)

	// Should fail with error about not being able to modify frozen object
	assert.Equal(t, "success", result.Status)
	assert.Contains(t, string(result.Result), "Error")

	// Function that tries to use eval
	evalFunc := &models.Function{
		ID:     7,
		Name:   "EvalAttempt",
		UserID: 1,
		SourceCode: `
            function main() {
                try {
                    // Try to use eval
                    return eval("'Executed evil code'");
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ = runtime.ExecuteFunction(context.Background(), evalFunc, nil, 1)

	// Should fail with eval being undefined
	assert.Equal(t, "success", result.Status)
	assert.Contains(t, string(result.Result), "Error")
}

// TestResourceLimits tests that resource limitations are enforced
func TestResourceLimits(t *testing.T) {
	// Create runtime with small memory limit
	secretStore := NewMockSecretStore()
	runtime := tee.NewJSRuntime(10, 30, secretStore) // 10MB limit

	// Function that tries to allocate too much memory
	memoryHogFunc := &models.Function{
		ID:     8,
		Name:   "MemoryHog",
		UserID: 1,
		SourceCode: `
            function main() {
                try {
                    // Try to allocate a large array
                    const arr = new Array(10000000).fill("x".repeat(1000));
                    return "Created large array: " + arr.length;
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        `,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), memoryHogFunc, nil, 1)

	// Should fail with memory error
	assert.Equal(t, "error", result.Status)

	// Create runtime with short timeout
	runtime = tee.NewJSRuntime(100, 1, secretStore) // 1 second timeout

	// Function that runs an infinite loop
	infiniteLoopFunc := &models.Function{
		ID:     9,
		Name:   "InfiniteLoop",
		UserID: 1,
		SourceCode: `
            function main() {
                // Run an infinite loop
                while(true) {}
                return "This should never be reached";
            }
        `,
	}

	// Execute the function
	result, _ = runtime.ExecuteFunction(context.Background(), infiniteLoopFunc, nil, 1)

	// Should fail with timeout
	assert.Equal(t, "error", result.Status)
	assert.Contains(t, string(result.Result), "timeout")
}
