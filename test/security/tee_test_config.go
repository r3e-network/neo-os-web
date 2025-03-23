package security

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
)

// TestTEEConfig holds test configuration for TEE testing
type TestTEEConfig struct {
	// The directory where test data is stored
	TestDataDir string

	// The original environment variables before modification
	OriginalEnvVars map[string]string

	// Managed environment variables to clean up
	ManagedEnvVars []string
}

// SetupTEETestEnvironment sets up the test environment for TEE tests
func SetupTEETestEnvironment(t *testing.T) *TestTEEConfig {
	t.Helper()

	// Create test config
	testConfig := &TestTEEConfig{
		TestDataDir:     filepath.Join("testdata", "tee"),
		OriginalEnvVars: make(map[string]string),
		ManagedEnvVars:  []string{},
	}

	// Create test data directory if it doesn't exist
	if err := os.MkdirAll(testConfig.TestDataDir, 0755); err != nil {
		t.Fatalf("Failed to create test data directory: %v", err)
	}

	// Set up environment variables for testing
	envVars := map[string]string{
		"SGX_ENABLED":                "1",
		"EXPECTED_MRENCLAVE":         "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		"EXPECTED_MRSIGNER":          "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		"AZURE_REGION":               "eastus",
		"AZURE_VM_SIZE":              "Standard_DC4s_v3",
		"AZURE_ATTESTATION_URL":      "https://shared.eastus.attest.azure.net",
		"AZURE_ATTESTATION_PROVIDER": "shared",
		"AZURE_ATTESTATION_INSTANCE": "shared",
		"AZURE_ATTESTATION_REGION":   "eastus",
		"AZURE_ATTESTATION_SCOPE":    "https://attest.azure.net/.default",
		"TEE_JS_MEMORY_LIMIT":        "128",
		"TEE_EXECUTION_TIMEOUT":      "30",
		"TEE_MAX_CPU_TIME":           "10",
		"TEE_PROVIDER":               "azure",
	}

	// Store original values and set new ones
	for key, value := range envVars {
		testConfig.OriginalEnvVars[key] = os.Getenv(key)
		os.Setenv(key, value)
		testConfig.ManagedEnvVars = append(testConfig.ManagedEnvVars, key)
	}

	// Create mock attestation token file
	createMockAttestationToken(t, testConfig.TestDataDir)

	return testConfig
}

// TeardownTEETestEnvironment cleans up the test environment
func (c *TestTEEConfig) TeardownTEETestEnvironment(t *testing.T) {
	t.Helper()

	// Restore original environment variables
	for _, key := range c.ManagedEnvVars {
		originalValue, exists := c.OriginalEnvVars[key]
		if exists {
			os.Setenv(key, originalValue)
		} else {
			os.Unsetenv(key)
		}
	}
}

// GetTEEConfig returns a TEE configuration for testing
func (c *TestTEEConfig) GetTEEConfig() *config.TEEConfig {
	return &config.TEEConfig{
		Provider: "azure",
		Azure: config.AzureConfig{
			Region:         "eastus",
			VMSize:         "Standard_DC4s_v3",
			AttestationURL: "https://shared.eastus.attest.azure.net",
			Runtime: struct {
				JSMemoryLimit    int `yaml:"js_memory_limit" env:"AZURE_JS_MEMORY_LIMIT,default=128"`
				ExecutionTimeout int `yaml:"execution_timeout" env:"AZURE_EXECUTION_TIMEOUT,default=30"`
			}{
				JSMemoryLimit:    128,
				ExecutionTimeout: 30,
			},
			Attestation: struct {
				URL      string `yaml:"url" env:"AZURE_ATTESTATION_URL"`
				Provider string `yaml:"provider" env:"AZURE_ATTESTATION_PROVIDER"`
				Instance string `yaml:"instance" env:"AZURE_ATTESTATION_INSTANCE,default=shared"`
				Region   string `yaml:"region" env:"AZURE_ATTESTATION_REGION,default=eastus"`
				Scope    string `yaml:"scope" env:"AZURE_ATTESTATION_SCOPE,default=https://attest.azure.net/.default"`
			}{
				URL:      "https://shared.eastus.attest.azure.net",
				Provider: "shared",
				Instance: "shared",
				Region:   "eastus",
				Scope:    "https://attest.azure.net/.default",
			},
		},
		Runtime: config.RuntimeConfig{
			JSMemoryLimit:    128,
			ExecutionTimeout: 30,
			MaxCPUTime:       10,
		},
	}
}

// createMockAttestationToken creates a mock attestation token for testing
func createMockAttestationToken(t *testing.T, testDataDir string) {
	t.Helper()

	// Create a simple mock token (header.payload.signature format for JWT)
	header := `{"alg":"RS256","typ":"JWT"}`
	payload := fmt.Sprintf(`{
		"exp": %d,
		"iat": %d,
		"iss": "https://shared.eastus.attest.azure.net",
		"jti": "mock-token-id",
		"sgx": {
			"mrenclave": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			"mrsigner": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			"svn": 1,
			"tee_type": "SGX"
		}
	}`, time.Now().Add(time.Hour*24).Unix(), time.Now().Unix())

	// Base64 encode header and payload (use RawURLEncoding to match JWT format)
	headerEncoded := base64.RawURLEncoding.EncodeToString([]byte(header))
	payloadEncoded := base64.RawURLEncoding.EncodeToString([]byte(payload))

	// Simple signature (in a real attestation token, this would be properly signed)
	mockSignature := "mocksignature"

	// Combine into a JWT format
	mockToken := fmt.Sprintf("%s.%s.%s", headerEncoded, payloadEncoded, mockSignature)

	// Write to a file for testing
	tokenFile := filepath.Join(testDataDir, "mock_attestation_token.jwt")
	if err := os.WriteFile(tokenFile, []byte(mockToken), 0644); err != nil {
		t.Fatalf("Failed to write mock attestation token: %v", err)
	}

	// Also write the raw attestation data
	attestationData := []byte(fmt.Sprintf(`{
		"token": "%s",
		"attestation": {"type": "sgx", "timestamp": %d},
		"expiration": "%s"
	}`, mockToken, time.Now().Unix(), time.Now().Add(time.Hour*24).Format(time.RFC3339)))

	attestationFile := filepath.Join(testDataDir, "mock_attestation.json")
	if err := os.WriteFile(attestationFile, attestationData, 0644); err != nil {
		t.Fatalf("Failed to write mock attestation data: %v", err)
	}
}
