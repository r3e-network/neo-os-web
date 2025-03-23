package security

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAzureTEEBasic(t *testing.T) {
	// Skip in CI environments or when SGX is not available
	if os.Getenv("CI") != "" {
		t.Skip("Skipping TEE tests in CI environment")
	}

	// Setup test environment
	testConfig := SetupTEETestEnvironment(t)
	defer testConfig.TeardownTEETestEnvironment(t)

	// Create logger
	logConfig := config.LoggingConfig{
		Level:  "debug",
		Format: "json",
		Output: "stdout",
	}
	log := logger.New(logConfig)

	// Create TEE manager
	teeConfig := testConfig.GetTEEConfig()
	manager, err := tee.New(teeConfig, log)
	require.NoError(t, err)
	require.NotNil(t, manager)

	// Test attestation
	ctx := context.Background()
	attestation, err := manager.GetAttestation(ctx)
	require.NoError(t, err)
	require.NotNil(t, attestation)
	assert.Contains(t, string(attestation), "attestation")
}

func TestAzureTEESecretStorage(t *testing.T) {
	// Skip in CI environments or when SGX is not available
	if os.Getenv("CI") != "" {
		t.Skip("Skipping TEE tests in CI environment")
	}

	// Setup test environment
	testConfig := SetupTEETestEnvironment(t)
	defer testConfig.TeardownTEETestEnvironment(t)

	// Create logger
	logConfig := config.LoggingConfig{
		Level:  "debug",
		Format: "json",
		Output: "stdout",
	}
	log := logger.New(logConfig)

	// Create TEE manager
	teeConfig := testConfig.GetTEEConfig()
	manager, err := tee.New(teeConfig, log)
	require.NoError(t, err)
	require.NotNil(t, manager)

	// Test secret storage
	ctx := context.Background()
	now := time.Now()
	secret := &models.Secret{
		UserID:    1,
		Name:      "test-secret",
		Value:     "test-value",
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Store the secret
	err = manager.StoreSecret(ctx, secret)
	require.NoError(t, err)

	// Retrieve the secret
	value, err := manager.GetSecret(ctx, secret.UserID, secret.Name)
	require.NoError(t, err)
	assert.Equal(t, secret.Value, value)

	// Delete the secret
	err = manager.DeleteSecret(ctx, secret.UserID, secret.Name)
	require.NoError(t, err)

	// Verify the secret is deleted
	_, err = manager.GetSecret(ctx, secret.UserID, secret.Name)
	require.Error(t, err)
}

func TestAzureTEEFunctionExecution(t *testing.T) {
	// Skip in CI environments or when SGX is not available
	if os.Getenv("CI") != "" {
		t.Skip("Skipping TEE tests in CI environment")
	}

	// Setup test environment
	testConfig := SetupTEETestEnvironment(t)
	defer testConfig.TeardownTEETestEnvironment(t)

	// Create logger
	logConfig := config.LoggingConfig{
		Level:  "debug",
		Format: "json",
		Output: "stdout",
	}
	log := logger.New(logConfig)

	// Create TEE manager
	teeConfig := testConfig.GetTEEConfig()
	manager, err := tee.New(teeConfig, log)
	require.NoError(t, err)
	require.NotNil(t, manager)

	// Test function execution
	ctx := context.Background()
	function := &models.Function{
		ID:         1,
		UserID:     1,
		Name:       "test-function",
		SourceCode: "function main(params) { return { result: params.input * 2 }; }",
	}

	// Define parameters
	params := map[string]interface{}{
		"input": 21,
	}

	// Define secrets (we'll store these first)
	secretName := "test-secret"
	secretValue := "test-value"
	now := time.Now()
	secret := &models.Secret{
		UserID:    function.UserID,
		Name:      secretName,
		Value:     secretValue,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Store the secret
	err = manager.StoreSecret(ctx, secret)
	require.NoError(t, err)

	// Execute the function
	result, err := manager.ExecuteFunction(ctx, function, params, nil)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "success", result.Status)

	// Verify the result
	assert.Contains(t, string(result.Result), "42")
}
