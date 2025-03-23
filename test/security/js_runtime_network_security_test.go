package security_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestJavaScriptNetworkSecurity verifies that the JavaScript runtime properly controls network access
func TestJavaScriptNetworkSecurity(t *testing.T) {
	// Create runtime with memory and time limits
	secretStore := &MockFunctionSecretStore{}
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Create test servers
	allowedServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"status":"ok","message":"This is an allowed endpoint"}`)
	}))
	defer allowedServer.Close()

	privateServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"status":"ok","message":"This is a private endpoint that should not be accessible"}`)
	}))
	defer privateServer.Close()

	// Test cases for network access control
	testCases := []struct {
		name        string
		sourceCode  string
		expectError bool
		expectMsg   string
	}{
		{
			name: "Valid - Fetch from allowed public endpoint",
			sourceCode: fmt.Sprintf(`
				async function main() {
					const response = await fetch("%s");
					const data = await response.json();
					return { result: data.status, message: data.message };
				}
			`, allowedServer.URL),
			expectError: false,
			expectMsg:   "This is an allowed endpoint",
		},
		{
			name: "Invalid - Fetch with invalid URL",
			sourceCode: `
				async function main() {
					try {
						const response = await fetch("invalid-url");
						const data = await response.json();
						return { result: data.status };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // This will not cause the function to fail, but will return an error message
			expectMsg:   "error",
		},
		{
			name: "Invalid - Attempt to access local network",
			sourceCode: `
				async function main() {
					try {
						const response = await fetch("http://localhost:8080/internal");
						const data = await response.json();
						return { result: data.status };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // Should be blocked by network policy, but not cause an execution error
			expectMsg:   "error",
		},
		{
			name: "Invalid - Attempt to access private IP",
			sourceCode: `
				async function main() {
					try {
						const response = await fetch("http://192.168.1.1");
						const data = await response.json();
						return { result: data.status };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // Should be blocked by network policy, but not cause an execution error
			expectMsg:   "error",
		},
		{
			name: "Invalid - Attempt to make WebSocket connection",
			sourceCode: `
				async function main() {
					try {
						const ws = new WebSocket("ws://example.com");
						return { result: "WebSocket created" };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // Should be blocked, but not cause an execution error
			expectMsg:   "error",
		},
		{
			name: "Invalid - Attempt to use raw TCP/IP socket",
			sourceCode: `
				async function main() {
					try {
						// This is just a conceptual test, since raw sockets aren't available in standard JS
						const socket = new Socket(); // Should not exist
						socket.connect("example.com", 80);
						return { result: "Socket connected" };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // Should fail because Socket is not defined
			expectMsg:   "error",
		},
		{
			name: "Valid - Multiple fetch requests",
			sourceCode: fmt.Sprintf(`
				async function main() {
					const responses = await Promise.all([
						fetch("%s"),
						fetch("%s")
					]);
					const data1 = await responses[0].json();
					const data2 = await responses[1].json();
					return { result1: data1.status, result2: data2.status };
				}
			`, allowedServer.URL, allowedServer.URL),
			expectError: false,
			expectMsg:   "ok",
		},
		{
			name: "Invalid - Excessive fetch requests",
			sourceCode: `
				async function main() {
					const urls = [];
					for (let i = 0; i < 100; i++) {
						urls.push("https://example.com");
					}
					
					try {
						const responses = await Promise.all(
							urls.map(url => fetch(url))
						);
						return { result: "Successfully made 100 requests" };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // Should be limited by rate limiting, but not cause an execution error
			expectMsg:   "error",
		},
		{
			name: "Invalid - Fetch with excessive timeout",
			sourceCode: `
				async function main() {
					try {
						// This is a slow endpoint that will timeout
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
						const response = await fetch("https://httpbin.org/delay/10", { 
							signal: controller.signal 
						});
						clearTimeout(timeoutId);
						const data = await response.json();
						return { result: "success" };
					} catch(e) {
						return { error: e.message };
					}
				}
			`,
			expectError: false, // Should timeout due to function execution timeout
			expectMsg:   "error",
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

			// Get context with timeout to avoid hanging tests
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			// Execute function
			result, err := runtime.ExecuteFunction(ctx, fn, nil, 1)

			// Check expectations
			if tc.expectError {
				if err == nil && result.Status != "error" {
					t.Errorf("Expected error but got success with result: %s", string(result.Result))
				}
			} else {
				require.NoError(t, err, "Unexpected error")
				if tc.expectMsg == "error" {
					// Special case for when we expect the function to return an error object
					assert.Contains(t, string(result.Result), "error", "Expected error in result")
				} else if tc.expectMsg != "" {
					assert.Contains(t, string(result.Result), tc.expectMsg,
						"Expected specific message in result: %s", tc.expectMsg)
				}
			}
		})
	}
}

// TestNetworkAccessControl verifies that network policies are properly enforced
func TestNetworkAccessControl(t *testing.T) {
	// Create runtime with memory and time limits
	secretStore := &MockFunctionSecretStore{}
	runtime := tee.NewJSRuntime(100, 30, secretStore)

	// Define allowed and blocked domains for testing
	allowedDomains := []string{
		"example.com",
		"api.example.org",
		"cdn.example.net",
	}

	blockedDomains := []string{
		"evil.com",
		"malicious.org",
		"localhost",
		"127.0.0.1",
		"192.168.1.1",
		"10.0.0.1",
	}

	// Create a function that attempts to fetch from a domain
	fetchTemplate := `
		async function main() {
			try {
				const response = await fetch("http://%s");
				const text = await response.text();
				return { success: true, domain: "%s" };
			} catch(e) {
				return { success: false, error: e.message, domain: "%s" };
			}
		}
	`

	// Test fetch attempts to allowed domains
	for _, domain := range allowedDomains {
		t.Run(fmt.Sprintf("AllowedDomain_%s", domain), func(t *testing.T) {
			fn := &models.Function{
				ID:         1,
				Name:       fmt.Sprintf("FetchFrom_%s", domain),
				UserID:     1,
				SourceCode: fmt.Sprintf(fetchTemplate, domain, domain, domain),
			}

			// Execute with timeout
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			result, err := runtime.ExecuteFunction(ctx, fn, nil, 1)

			// These will fail because we're not mocking the DNS resolution,
			// but they should not be blocked by the network policy
			require.NoError(t, err, "Function execution should not error")

			// We expect these to fail due to network connectivity, not security policy
			assert.Equal(t, "success", result.Status, "Function should execute successfully")
			assert.Contains(t, string(result.Result), domain, "Result should contain the domain")
		})
	}

	// Test fetch attempts to blocked domains
	for _, domain := range blockedDomains {
		t.Run(fmt.Sprintf("BlockedDomain_%s", domain), func(t *testing.T) {
			fn := &models.Function{
				ID:         1,
				Name:       fmt.Sprintf("FetchFrom_%s", domain),
				UserID:     1,
				SourceCode: fmt.Sprintf(fetchTemplate, domain, domain, domain),
			}

			// Execute with timeout
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			result, err := runtime.ExecuteFunction(ctx, fn, nil, 1)

			// Function should execute but fetch should fail
			require.NoError(t, err, "Function execution should not error")
			assert.Equal(t, "success", result.Status, "Function should execute successfully")
			assert.Contains(t, string(result.Result), "success\":false", "Fetch should fail")
		})
	}
}
