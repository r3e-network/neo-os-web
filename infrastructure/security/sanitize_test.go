package security

import (
	"errors"
	"testing"
)

func TestSanitizeString(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		contains    string
		notContains string
	}{
		{
			name:        "JWT Token",
			input:       "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
			contains:    "[REDACTED_JWT]",
			notContains: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
		},
		{
			name:        "Bearer Token",
			input:       "Authorization: Bearer abc123def456ghi789jkl012mno345pqr678stu901vwx234",
			contains:    "[REDACTED_AUTH]", // Authorization header pattern matches first
			notContains: "abc123def456",
		},
		{
			name:        "API Key",
			input:       "api_key=test_key_fake_example_value",
			contains:    "[REDACTED_API_KEY]",
			notContains: "test_key_fake",
		},
		{
			name:        "Password",
			input:       "password=MySecretPass123",
			contains:    "[REDACTED_PASSWORD]",
			notContains: "MySecretPass123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeString(tt.input)
			if tt.contains != "" && !contains(result, tt.contains) {
				t.Errorf("Expected result to contain %q, got %q", tt.contains, result)
			}
			if tt.notContains != "" && contains(result, tt.notContains) {
				t.Errorf("Expected result to NOT contain %q, got %q", tt.notContains, result)
			}
		})
	}
}

func TestSanitizeError(t *testing.T) {
	err := errors.New("authentication failed: token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U")
	result := SanitizeError(err)

	if contains(result, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9") {
		t.Errorf("Expected JWT to be redacted, got %q", result)
	}
	if !contains(result, "[REDACTED_JWT]") {
		t.Errorf("Expected [REDACTED_JWT] in result, got %q", result)
	}
}

func TestSanitizeMap(t *testing.T) {
	input := map[string]interface{}{
		"username": "john_doe",
		"password": "secret123",
		"api_key":  "sk_test_123456",
		"email":    "john@example.com",
	}

	result := SanitizeMap(input)

	if result["username"] != "john_doe" {
		t.Errorf("Expected username to remain, got %v", result["username"])
	}
	if result["password"] != "[REDACTED]" {
		t.Errorf("Expected password to be redacted, got %v", result["password"])
	}
	if result["api_key"] != "[REDACTED]" {
		t.Errorf("Expected api_key to be redacted, got %v", result["api_key"])
	}
}

func TestSanitizeHeaders(t *testing.T) {
	headers := map[string][]string{
		"Content-Type":    {"application/json"},
		"Authorization":   {"Bearer secret_token_12345"},
		"X-Service-Token": {"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig"},
		"User-Agent":      {"TestClient/1.0"},
	}

	result := SanitizeHeaders(headers)

	if result["Content-Type"][0] != "application/json" {
		t.Errorf("Expected Content-Type to remain, got %v", result["Content-Type"])
	}
	if result["Authorization"][0] != "[REDACTED]" {
		t.Errorf("Expected Authorization to be redacted, got %v", result["Authorization"])
	}
	if result["X-Service-Token"][0] != "[REDACTED]" {
		t.Errorf("Expected X-Service-Token to be redacted, got %v", result["X-Service-Token"])
	}
}

func TestIsSensitiveKey(t *testing.T) {
	tests := []struct {
		key      string
		expected bool
	}{
		{"password", true},
		{"api_key", true},
		{"secret", true},
		{"token", true},
		{"username", false},
		{"email", false},
		{"client_secret", true},
		{"access_token", true},
	}

	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			result := IsSensitiveKey(tt.key)
			if result != tt.expected {
				t.Errorf("IsSensitiveKey(%q) = %v, want %v", tt.key, result, tt.expected)
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
