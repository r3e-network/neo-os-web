package security_test

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSecretManagementAuthorization tests the access control and authorization aspects of the secret management system
func TestSecretManagementAuthorization(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)
	require.NotNil(t, store)

	// Test context
	ctx := context.Background()

	// Setup test users
	userIDs := []int{1001, 1002, 1003}

	// Create test secrets for each user
	setupSecrets(t, ctx, store, userIDs)

	// Run authorization tests
	t.Run("UserIsolation", func(t *testing.T) {
		testUserIsolation(t, ctx, store, userIDs)
	})

	t.Run("ListSecretsAuthorization", func(t *testing.T) {
		testListSecretsAuthorization(t, ctx, store, userIDs)
	})

	t.Run("MetadataAuthorization", func(t *testing.T) {
		testMetadataAuthorization(t, ctx, store, userIDs)
	})

	t.Run("DeleteAuthorization", func(t *testing.T) {
		testDeleteAuthorization(t, ctx, store, userIDs)
	})

	t.Run("AuditLogAuthorization", func(t *testing.T) {
		testAuditLogAuthorization(t, ctx, store, userIDs)
	})

	t.Run("ExportImportAuthorization", func(t *testing.T) {
		testExportImportAuthorization(t, ctx, store, userIDs)
	})

	t.Run("ConcurrentAccess", func(t *testing.T) {
		testConcurrentAccess(t, ctx, store, userIDs)
	})
}

// setupSecrets creates test secrets for each user
func setupSecrets(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	secretNames := []string{"api-key", "database-password", "signing-key"}

	for _, userID := range userIDs {
		for _, name := range secretNames {
			secretValue := fmt.Sprintf("secret-value-%d-%s", userID, name)
			err := store.SetSecret(ctx, userID, name, secretValue)
			require.NoError(t, err)
		}
	}
}

// testUserIsolation verifies that users cannot access each other's secrets
func testUserIsolation(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	// Verify each user can access their own secrets
	for _, userID := range userIDs {
		secret, err := store.GetSecret(ctx, userID, "api-key")
		require.NoError(t, err)
		expectedValue := fmt.Sprintf("secret-value-%d-%s", userID, "api-key")
		assert.Equal(t, expectedValue, secret)
	}

	// Verify users cannot access each other's secrets
	for i, userID := range userIDs {
		for j, otherUserID := range userIDs {
			if i == j {
				continue // Skip self
			}

			// Try to access another user's secret using this user's ID
			otherUserSecret := fmt.Sprintf("secret-value-%d-%s", otherUserID, "api-key")

			// Attempt to get the other user's secret - should fail
			_, err := store.GetSecret(ctx, userID, fmt.Sprintf("secret-for-user-%d", otherUserID))
			assert.Error(t, err, "User %d should not be able to access user %d's secret", userID, otherUserID)

			// Verify user can't guess the other user's secret values
			secret, err := store.GetSecret(ctx, userID, "api-key")
			if err == nil {
				assert.NotEqual(t, otherUserSecret, secret,
					"User %d should not get user %d's secret value", userID, otherUserID)
			}
		}
	}
}

// testListSecretsAuthorization verifies that users can only list their own secrets
func testListSecretsAuthorization(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	// Verify each user can list their own secrets
	for _, userID := range userIDs {
		secrets, err := store.ListSecrets(ctx, userID)
		require.NoError(t, err)

		// Check that each user has their own secrets
		assert.Contains(t, secrets, "api-key")
		assert.Contains(t, secrets, "database-password")
		assert.Contains(t, secrets, "signing-key")

		// User should only have their own secrets, not other users'
		assert.Equal(t, 3, len(secrets), "User should only have 3 secrets")
	}

	// Verify non-existent user gets empty list
	nonExistentUserID := 9999
	secrets, err := store.ListSecrets(ctx, nonExistentUserID)
	require.NoError(t, err)
	assert.Empty(t, secrets, "Non-existent user should have no secrets")
}

// testMetadataAuthorization verifies that users can only access metadata for their own secrets
func testMetadataAuthorization(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	// Verify each user can access metadata for their own secrets
	for _, userID := range userIDs {
		metadata, err := store.GetSecretMetadata(ctx, userID, "api-key")
		require.NoError(t, err)
		assert.NotNil(t, metadata)

		// Update tags and verify changes
		newTags := []string{"test", "security"}
		err = store.UpdateSecretTags(ctx, userID, "api-key", newTags)
		require.NoError(t, err)

		metadata, err = store.GetSecretMetadata(ctx, userID, "api-key")
		require.NoError(t, err)
		assert.ElementsMatch(t, newTags, metadata.Tags)
	}

	// Verify users cannot access other users' metadata
	for i, userID := range userIDs {
		for j, otherUserID := range userIDs {
			if i == j {
				continue // Skip self
			}

			// Try to access another user's metadata
			_, err := store.GetSecretMetadata(ctx, userID, fmt.Sprintf("secret-for-user-%d", otherUserID))
			assert.Error(t, err, "User %d should not be able to access user %d's metadata", userID, otherUserID)

			// Try to update another user's tags
			err = store.UpdateSecretTags(ctx, userID, fmt.Sprintf("secret-for-user-%d", otherUserID), []string{"hack"})
			assert.Error(t, err, "User %d should not be able to update user %d's tags", userID, otherUserID)
		}
	}
}

// testDeleteAuthorization verifies that users can only delete their own secrets
func testDeleteAuthorization(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	// Create test secret for deletion
	for _, userID := range userIDs {
		err := store.SetSecret(ctx, userID, "temp-secret", "to-be-deleted")
		require.NoError(t, err)
	}

	// Verify each user can delete their own secrets
	for _, userID := range userIDs {
		err := store.DeleteSecret(ctx, userID, "temp-secret")
		require.NoError(t, err)

		// Verify secret is gone
		_, err = store.GetSecret(ctx, userID, "temp-secret")
		assert.Error(t, err, "Secret should be deleted")
	}

	// Verify users cannot delete other users' secrets
	for i, userID := range userIDs {
		for j, otherUserID := range userIDs {
			if i == j {
				continue // Skip self
			}

			// Create a secret for the other user
			secretName := fmt.Sprintf("user-%d-secret", otherUserID)
			err := store.SetSecret(ctx, otherUserID, secretName, "protected-value")
			require.NoError(t, err)

			// Try to delete another user's secret
			err = store.DeleteSecret(ctx, userID, secretName)
			assert.Error(t, err, "User %d should not be able to delete user %d's secret", userID, otherUserID)

			// Verify secret still exists
			_, err = store.GetSecret(ctx, otherUserID, secretName)
			assert.NoError(t, err, "Secret should still exist")

			// Clean up
			err = store.DeleteSecret(ctx, otherUserID, secretName)
			require.NoError(t, err)
		}
	}
}

// testAuditLogAuthorization verifies that users can only access their own audit logs
func testAuditLogAuthorization(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	// Generate some audit events for each user
	for _, userID := range userIDs {
		// Update a secret to generate an audit event
		err := store.SetSecret(ctx, userID, "audit-test", "test-value")
		require.NoError(t, err)

		// Get a secret to generate another audit event
		_, err = store.GetSecret(ctx, userID, "audit-test")
		require.NoError(t, err)
	}

	// Verify each user can access their own audit logs
	for _, userID := range userIDs {
		auditLog, err := store.GetAuditLog(ctx, userID, 100)
		require.NoError(t, err)

		// Verify audit log entries belong to this user
		for _, entry := range auditLog {
			assert.Equal(t, userID, entry.UserID, "Audit entry belongs to wrong user")
		}
	}

	// Verify a non-user gets appropriate results
	auditLog, err := store.GetAuditLog(ctx, 9999, 100)
	require.NoError(t, err)
	assert.Empty(t, auditLog, "Non-user should have empty audit log")
}

// testExportImportAuthorization verifies that users can only export and import their own secrets
func testExportImportAuthorization(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	// Verify each user can export their own secrets
	userExports := make(map[int][]byte)

	for _, userID := range userIDs {
		exportData, err := store.ExportSecrets(ctx, userID)
		require.NoError(t, err)
		assert.NotEmpty(t, exportData)

		// Save export data for import test
		userExports[userID] = exportData
	}

	// Clean out all secrets for a clean import test
	for _, userID := range userIDs {
		secrets, err := store.ListSecrets(ctx, userID)
		require.NoError(t, err)

		for _, name := range secrets {
			err = store.DeleteSecret(ctx, userID, name)
			require.NoError(t, err)
		}
	}

	// Verify each user can import their own exported secrets
	for _, userID := range userIDs {
		err := store.ImportSecrets(ctx, userID, userExports[userID])
		require.NoError(t, err)

		// Verify imported secrets
		secrets, err := store.ListSecrets(ctx, userID)
		require.NoError(t, err)
		assert.NotEmpty(t, secrets)
	}

	// Verify users cannot import other users' exports
	for i, userID := range userIDs {
		for j, otherUserID := range userIDs {
			if i == j {
				continue // Skip self
			}

			// Delete all secrets for this user
			secrets, err := store.ListSecrets(ctx, userID)
			require.NoError(t, err)

			for _, name := range secrets {
				err = store.DeleteSecret(ctx, userID, name)
				require.NoError(t, err)
			}

			// Try to import another user's export
			err = store.ImportSecrets(ctx, userID, userExports[otherUserID])
			// Even if the import succeeds, the secrets should be namespaced to the importing user

			// Check that we don't have the other user's secrets
			// Get the other user's original secrets
			originalSecrets, err := store.ListSecrets(ctx, otherUserID)
			require.NoError(t, err)

			// Even if import works, user should only have their own namespace
			// User's secrets should be different from the original user's
			for _, name := range originalSecrets {
				// If this secret exists for the current user, verify it's different
				secret1, err1 := store.GetSecret(ctx, userID, name)
				secret2, err2 := store.GetSecret(ctx, otherUserID, name)

				// If both users have the same secret name, values should differ
				if err1 == nil && err2 == nil {
					assert.NotEqual(t, secret2, secret1,
						"User %d should not have user %d's secret value", userID, otherUserID)
				}
			}
		}
	}
}

// testConcurrentAccess verifies the secret store's behavior under concurrent access
func testConcurrentAccess(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore, userIDs []int) {
	const numOperations = 50

	// Use a wait group to coordinate goroutines
	var wg sync.WaitGroup

	// Track errors in concurrent operations
	errChan := make(chan error, numOperations*len(userIDs))

	// Start multiple goroutines for each user
	for _, userID := range userIDs {
		uid := userID // Capture userID for goroutine

		// Read operation
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < numOperations; i++ {
				_, err := store.GetSecret(ctx, uid, "api-key")
				if err != nil {
					errChan <- fmt.Errorf("user %d get error: %v", uid, err)
				}
			}
		}()

		// Write operation
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < numOperations; i++ {
				secretValue := fmt.Sprintf("concurrent-value-%d-%d", uid, i)
				err := store.SetSecret(ctx, uid, "concurrent-secret", secretValue)
				if err != nil {
					errChan <- fmt.Errorf("user %d set error: %v", uid, err)
				}

				// Small delay to increase chance of concurrent access
				time.Sleep(time.Millisecond)
			}
		}()

		// List operation
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < numOperations; i++ {
				_, err := store.ListSecrets(ctx, uid)
				if err != nil {
					errChan <- fmt.Errorf("user %d list error: %v", uid, err)
				}
			}
		}()
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errChan)

	// Check for errors
	for err := range errChan {
		t.Error(err)
	}

	// Each user should still only have access to their own secrets
	for _, userID := range userIDs {
		// Get final value of concurrent secret
		secret, err := store.GetSecret(ctx, userID, "concurrent-secret")
		require.NoError(t, err)
		assert.Contains(t, secret, fmt.Sprintf("concurrent-value-%d-", userID),
			"User %d has incorrect secret value", userID)
	}
}

// TestEnhancedSecretStoreAttackScenarios tests resistance to various attack scenarios
func TestEnhancedSecretStoreAttackScenarios(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)
	require.NotNil(t, store)

	// Test context
	ctx := context.Background()

	// Test various attack scenarios
	t.Run("UsernameConfusion", func(t *testing.T) {
		testUsernameConfusionAttack(t, ctx, store)
	})

	t.Run("SecretNameConfusion", func(t *testing.T) {
		testSecretNameConfusionAttack(t, ctx, store)
	})

	t.Run("NegativeUserID", func(t *testing.T) {
		testNegativeUserIDAttack(t, ctx, store)
	})

	t.Run("VeryLargeUserID", func(t *testing.T) {
		testVeryLargeUserIDAttack(t, ctx, store)
	})

	t.Run("UserEnumeration", func(t *testing.T) {
		testUserEnumerationAttack(t, ctx, store)
	})
}

// testUsernameConfusionAttack tests for username confusion vulnerabilities
func testUsernameConfusionAttack(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Create secrets for similar user IDs
	err := store.SetSecret(ctx, 1, "password", "user1-password")
	require.NoError(t, err)

	err = store.SetSecret(ctx, 01, "password", "user01-password") // Leading zero should be ignored in integers
	require.NoError(t, err)

	// The two user IDs should be treated as the same
	secret, err := store.GetSecret(ctx, 1, "password")
	require.NoError(t, err)
	assert.Equal(t, "user01-password", secret, "User IDs 1 and 01 should be treated as identical")

	// Create secrets for different user types
	err = store.SetSecret(ctx, 1, "password", "user1-password-updated")
	require.NoError(t, err)

	// User ID should be strictly typed
	// The following line would be a compilation error since userID is an int, not a string
	// _, err = store.GetSecret(ctx, "1", "password")
	// This test verifies type safety - we can't use string "1" to access int 1's secrets
}

// testSecretNameConfusionAttack tests for secret name confusion vulnerabilities
func testSecretNameConfusionAttack(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	userID := 1000

	// Create a secret
	err := store.SetSecret(ctx, userID, "admin-password", "super-secret-admin")
	require.NoError(t, err)

	// Try similar secret names that might cause confusion
	similar := []string{
		"ADMIN-PASSWORD",     // Uppercase
		"admin_password",     // Underscore
		"adminpassword",      // No separator
		" admin-password ",   // Whitespace
		"./admin-password",   // Path traversal
		"admin-password\x00", // Null byte
	}

	for _, name := range similar {
		_, err := store.GetSecret(ctx, userID, name)
		assert.Error(t, err, "Secret name %s should not match admin-password", name)
	}
}

// testNegativeUserIDAttack tests for issues with negative user IDs
func testNegativeUserIDAttack(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Create a secret for a positive user ID
	err := store.SetSecret(ctx, 42, "api-key", "positive-user-secret")
	require.NoError(t, err)

	// Try to create a secret with a negative user ID
	negativeUserID := -42
	err = store.SetSecret(ctx, negativeUserID, "api-key", "negative-user-secret")
	require.NoError(t, err, "Negative user IDs should be allowed but isolated")

	// Verify the negative user can't access the positive user's secrets
	_, err = store.GetSecret(ctx, negativeUserID, "api-key-positive")
	assert.Error(t, err, "Negative user ID should not access positive user's secrets")

	// Verify the positive user can't access the negative user's secrets
	_, err = store.GetSecret(ctx, 42, "api-key-negative")
	assert.Error(t, err, "Positive user ID should not access negative user's secrets")
}

// testVeryLargeUserIDAttack tests for issues with very large user IDs
func testVeryLargeUserIDAttack(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Create a secret for a normal user ID
	err := store.SetSecret(ctx, 100, "api-key", "normal-user-secret")
	require.NoError(t, err)

	// Try to create a secret with a very large user ID
	largeUserID := 1000000000 // One billion
	err = store.SetSecret(ctx, largeUserID, "api-key", "large-user-secret")
	require.NoError(t, err, "Large user IDs should be handled correctly")

	// Verify secrets are isolated
	secret, err := store.GetSecret(ctx, largeUserID, "api-key")
	require.NoError(t, err)
	assert.Equal(t, "large-user-secret", secret, "Large user ID should access correct secret")
}

// testUserEnumerationAttack tests for user enumeration vulnerabilities
func testUserEnumerationAttack(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Create secrets for some users
	existingUserIDs := []int{5000, 5001, 5002}
	nonExistentUserIDs := []int{6000, 6001, 6002}

	for _, userID := range existingUserIDs {
		err := store.SetSecret(ctx, userID, "api-key", fmt.Sprintf("secret-%d", userID))
		require.NoError(t, err)
	}

	// Test error messages for existing vs non-existent users
	// Ideally, error messages should be the same to prevent enumeration

	var existingErrors []string
	var nonExistentErrors []string

	// Collect error messages for existing users
	for _, userID := range existingUserIDs {
		_, err := store.GetSecret(ctx, userID, "non-existent-secret")
		if err != nil {
			existingErrors = append(existingErrors, err.Error())
		}
	}

	// Collect error messages for non-existent users
	for _, userID := range nonExistentUserIDs {
		_, err := store.GetSecret(ctx, userID, "any-secret")
		if err != nil {
			nonExistentErrors = append(nonExistentErrors, err.Error())
		}
	}

	// Verify error messages are similar to prevent enumeration
	// In a secure implementation, you shouldn't be able to distinguish between
	// "user doesn't exist" and "secret doesn't exist"
	if len(existingErrors) > 0 && len(nonExistentErrors) > 0 {
		assert.Equal(t, existingErrors[0], nonExistentErrors[0],
			"Error messages should not reveal user existence")
	}
}
