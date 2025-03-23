package tee

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEnhancedSecretStore tests the enhanced secret store implementation
func TestEnhancedSecretStore(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)
	require.NotNil(t, store)

	// Test context
	ctx := context.Background()
	userID := 1

	// Test setting a secret
	err = store.SetSecret(ctx, userID, "api-key", "secret-value-123")
	require.NoError(t, err)

	// Test getting a secret
	secret, err := store.GetSecret(ctx, userID, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "secret-value-123", secret)

	// Test getting a non-existent secret
	_, err = store.GetSecret(ctx, userID, "non-existent")
	assert.Error(t, err)

	// Test listing secrets
	secrets, err := store.ListSecrets(ctx, userID)
	require.NoError(t, err)
	assert.Contains(t, secrets, "api-key")

	// Test updating a secret
	err = store.SetSecret(ctx, userID, "api-key", "new-secret-value-456")
	require.NoError(t, err)

	secret, err = store.GetSecret(ctx, userID, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "new-secret-value-456", secret)

	// Test getting secret metadata
	metadata, err := store.GetSecretMetadata(ctx, userID, "api-key")
	require.NoError(t, err)
	assert.Equal(t, 2, metadata.Version) // Should be version 2 after update

	// Test updating secret tags
	err = store.UpdateSecretTags(ctx, userID, "api-key", []string{"prod", "api"})
	require.NoError(t, err)

	metadata, err = store.GetSecretMetadata(ctx, userID, "api-key")
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"prod", "api"}, metadata.Tags)

	// Test getting audit log
	auditLog, err := store.GetAuditLog(ctx, userID, 100)
	require.NoError(t, err)
	assert.Greater(t, len(auditLog), 0)

	// Find update entry
	var foundUpdate bool
	for _, entry := range auditLog {
		if entry.Action == "update" && entry.SecretName == "api-key" && entry.Success {
			foundUpdate = true
			break
		}
	}
	assert.True(t, foundUpdate, "Should find update audit entry")

	// Test exporting secrets
	exportData, err := store.ExportSecrets(ctx, userID)
	require.NoError(t, err)

	// Test deleting a secret
	err = store.DeleteSecret(ctx, userID, "api-key")
	require.NoError(t, err)

	// Verify deletion
	_, err = store.GetSecret(ctx, userID, "api-key")
	assert.Error(t, err)

	// Test importing secrets
	err = store.ImportSecrets(ctx, userID, exportData)
	require.NoError(t, err)

	// Verify import
	secret, err = store.GetSecret(ctx, userID, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "new-secret-value-456", secret)
}

// TestKeyRotation tests the key rotation functionality
func TestKeyRotation(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)

	// Test context
	ctx := context.Background()
	userID := 1

	// Set key rotation interval to zero to force rotation on next operation
	store.SetKeyRotationInterval(0)

	// Set a secret
	err = store.SetSecret(ctx, userID, "test-secret", "initial-value")
	require.NoError(t, err)

	// Get the secret to verify it works
	value, err := store.GetSecret(ctx, userID, "test-secret")
	require.NoError(t, err)
	assert.Equal(t, "initial-value", value)

	// Set another secret which should trigger key rotation
	err = store.SetSecret(ctx, userID, "another-secret", "another-value")
	require.NoError(t, err)

	// Verify both secrets are still accessible
	value, err = store.GetSecret(ctx, userID, "test-secret")
	require.NoError(t, err)
	assert.Equal(t, "initial-value", value)

	value, err = store.GetSecret(ctx, userID, "another-secret")
	require.NoError(t, err)
	assert.Equal(t, "another-value", value)
}

// TestMultiUserIsolation tests that users can't access each other's secrets
func TestMultiUserIsolation(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)

	// Test context
	ctx := context.Background()

	// Create secrets for two users
	err = store.SetSecret(ctx, 1, "api-key", "user1-secret")
	require.NoError(t, err)

	err = store.SetSecret(ctx, 2, "api-key", "user2-secret")
	require.NoError(t, err)

	// Verify user1 can only access their own secret
	secret, err := store.GetSecret(ctx, 1, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "user1-secret", secret)

	// Verify user2 can only access their own secret
	secret, err = store.GetSecret(ctx, 2, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "user2-secret", secret)

	// Verify user1 can't access user2's secrets
	_, err = store.GetSecret(ctx, 1, "user2-api-key")
	assert.Error(t, err)

	// Verify user2 can't access user1's secrets
	_, err = store.GetSecret(ctx, 2, "user1-api-key")
	assert.Error(t, err)

	// Verify deleting user1's secret doesn't affect user2
	err = store.DeleteSecret(ctx, 1, "api-key")
	require.NoError(t, err)

	// User1's secret should be gone
	_, err = store.GetSecret(ctx, 1, "api-key")
	assert.Error(t, err)

	// User2's secret should still be accessible
	secret, err = store.GetSecret(ctx, 2, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "user2-secret", secret)
}

// TestEncryptionSecurity tests that secrets are properly encrypted
func TestEncryptionSecurity(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)

	// Create a secret and get its internal representation
	ctx := context.Background()
	userID := 1
	secretName := "test-secret"
	secretValue := "super-secret-value"

	// Set the secret
	err = store.SetSecret(ctx, userID, secretName, secretValue)
	require.NoError(t, err)

	// Get internal data structure
	internalSecrets := store.GetInternalSecretsForTesting()

	// Verify user has an entry
	userSecrets, ok := internalSecrets[userID]
	require.True(t, ok, "User should have secrets entry")

	// Verify secret name exists in user secrets
	encryptedSecret, ok := userSecrets[secretName]
	require.True(t, ok, "Secret should exist in user secrets")

	// Verify secret data is encrypted (not equal to plaintext)
	encryptedData := encryptedSecret.EncryptedData
	require.NotEqual(t, secretValue, string(encryptedData), "Secret should be encrypted")

	// Verify IV is set
	require.NotEmpty(t, encryptedSecret.IV, "IV should not be empty")

	// Verify key ID is set
	require.NotEmpty(t, encryptedSecret.KeyID, "Key ID should not be empty")
}
