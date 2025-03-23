package security_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockSecretStore for testing
type MockFunctionSecretStore struct{}

func (m *MockFunctionSecretStore) GetSecret(ctx context.Context, userID int, name string) (string, error) {
	return "mock-secret", nil
}

// TestJavaScriptInputValidation verifies that the JavaScript runtime properly validates inputs
func TestJavaScriptInputValidation(t *testing.T) {
	// Create runtime with memory and time limits
	secretStore := &MockFunctionSecretStore{}
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Test cases for input validation
	testCases := []struct {
		name        string
		sourceCode  string
		params      map[string]interface{}
		expectError bool
	}{
		{
			name: "Valid Code and Parameters",
			sourceCode: `
				function main() {
					return { result: "success", param: params.test };
				}
			`,
			params: map[string]interface{}{
				"test": "valid",
			},
			expectError: false,
		},
		{
			name: "Invalid - No Main Function",
			sourceCode: `
				function notMain() {
					return { result: "success" };
				}
			`,
			params:      nil,
			expectError: true,
		},
		{
			name: "Invalid - Syntax Error",
			sourceCode: `
				function main() {
					return { result: "success" }
				} // Missing semicolon in JavaScript strict mode
				const x = 5 // This line causes an error
			`,
			params:      nil,
			expectError: true,
		},
		{
			name: "Invalid - Oversized Parameters",
			sourceCode: `
				function main() {
					return { result: "success" };
				}
			`,
			params:      generateLargeParams(),
			expectError: true,
		},
		{
			name: "Invalid - Deep Recursive Parameters",
			sourceCode: `
				function main() {
					return { result: "success" };
				}
			`,
			params:      generateDeepRecursiveParams(),
			expectError: true,
		},
		{
			name: "Invalid - Malicious Parameter Keys",
			sourceCode: `
				function main() {
					return { result: "success" };
				}
			`,
			params: map[string]interface{}{
				"__proto__":   "attack",
				"constructor": "attack",
			},
			expectError: true,
		},
		{
			name: "Valid - Unicode Parameters",
			sourceCode: `
				function main() {
					return { result: params.unicodeParam };
				}
			`,
			params: map[string]interface{}{
				"unicodeParam": "こんにちは世界", // Hello World in Japanese
			},
			expectError: false,
		},
		{
			name: "Valid - Nested Object Parameters",
			sourceCode: `
				function main() {
					return { result: params.nested.value };
				}
			`,
			params: map[string]interface{}{
				"nested": map[string]interface{}{
					"value": "nested value",
				},
			},
			expectError: false,
		},
		{
			name: "Valid - Array Parameters",
			sourceCode: `
				function main() {
					return { result: params.array.length, first: params.array[0] };
				}
			`,
			params: map[string]interface{}{
				"array": []interface{}{"first", "second", "third"},
			},
			expectError: false,
		},
		{
			name: "Invalid - Function in Parameters",
			sourceCode: `
				function main() {
					return { result: "success" };
				}
			`,
			params: map[string]interface{}{
				"fn": "function() { alert('XSS'); }",
			},
			expectError: true,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create function model
			fn := &models.Function{
				ID:         1,
				Name:       tc.name,
				UserID:     1,
				SourceCode: tc.sourceCode,
			}

			// Execute function
			result, err := runtime.ExecuteFunction(context.Background(), fn, tc.params, 1)

			// Check expectations
			if tc.expectError {
				if err == nil && result.Status != "error" {
					t.Errorf("Expected error but got success with result: %s", string(result.Result))
				}
			} else {
				require.NoError(t, err, "Unexpected error")
				assert.Equal(t, "success", result.Status, "Expected success status")
			}
		})
	}
}

// TestParameterSanitization verifies that parameters are properly sanitized
func TestParameterSanitization(t *testing.T) {
	// Create runtime
	secretStore := &MockFunctionSecretStore{}
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Create a function that returns its parameters
	fn := &models.Function{
		ID:     1,
		Name:   "ParamEcho",
		UserID: 1,
		SourceCode: `
			function main() {
				// Return the parameters we received
				return params;
			}
		`,
	}

	// Test with various malicious inputs
	testCases := []struct {
		name        string
		params      map[string]interface{}
		checkOutput func(t *testing.T, output []byte)
	}{
		{
			name: "HTML Injection Attempt",
			params: map[string]interface{}{
				"value": "<script>alert('xss')</script>",
			},
			checkOutput: func(t *testing.T, output []byte) {
				// The output should contain the HTML, but it should not execute
				assert.Contains(t, string(output), "<script>alert('xss')</script>",
					"The parameter should be preserved as a string")
			},
		},
		{
			name: "Prototype Pollution Attempt",
			params: map[string]interface{}{
				"__proto__": map[string]interface{}{
					"polluted": true,
				},
			},
			checkOutput: func(t *testing.T, output []byte) {
				// The output should not contain the __proto__ property
				assert.NotContains(t, string(output), "__proto__",
					"The __proto__ parameter should be stripped")
			},
		},
		{
			name: "NoSQL Injection Attempt",
			params: map[string]interface{}{
				"$where": "this.password == 'password'",
			},
			checkOutput: func(t *testing.T, output []byte) {
				// The output should either not contain the $where property or it should be sanitized
				assert.NotContains(t, string(output), "$where",
					"The $where parameter should be stripped or sanitized")
			},
		},
		{
			name: "Circular Reference Attempt",
			params: func() map[string]interface{} {
				// Create a circular reference
				circular := make(map[string]interface{})
				circular["self"] = circular
				return map[string]interface{}{
					"circular": circular,
				}
			}(),
			checkOutput: func(t *testing.T, output []byte) {
				// The output should not contain a circular reference
				// If the output serializes successfully, the circular reference was handled
				assert.NotEmpty(t, output, "The output should not be empty")
			},
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Execute function
			result, err := runtime.ExecuteFunction(context.Background(), fn, tc.params, 1)

			// The function should execute without error
			require.NoError(t, err, "Function execution should not error")

			// Check that the status is success
			assert.Equal(t, "success", result.Status, "Function should return success status")

			// Check the output
			tc.checkOutput(t, result.Result)
		})
	}
}

// generateLargeParams creates a map with a large number of entries
func generateLargeParams() map[string]interface{} {
	params := make(map[string]interface{})
	for i := 0; i < 10000; i++ {
		params[fmt.Sprintf("key%d", i)] = fmt.Sprintf("value%d", i)
	}
	return params
}

// generateDeepRecursiveParams creates a deeply nested map structure
func generateDeepRecursiveParams() map[string]interface{} {
	var createNestedMap func(depth int) map[string]interface{}
	createNestedMap = func(depth int) map[string]interface{} {
		if depth <= 0 {
			return map[string]interface{}{"value": "leaf"}
		}
		return map[string]interface{}{
			"nested": createNestedMap(depth - 1),
		}
	}
	return createNestedMap(100) // Create a map nested 100 levels deep
}
