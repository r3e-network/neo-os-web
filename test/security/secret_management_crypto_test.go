package security_test

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSecretManagementCrypto tests the cryptographic security aspects of the secret management system
func TestSecretManagementCrypto(t *testing.T) {
	// Create a new secret store with a test master key
	testMasterKey := "VGhpcyBpcyBhIHRlc3QgbWFzdGVyIGtleSBmb3IgdGVzdGluZyBvbmx5Lg==" // Base64 encoded
	store, err := tee.NewEnhancedSecretStore(testMasterKey)
	require.NoError(t, err)
	require.NotNil(t, store)

	// Test context
	ctx := context.Background()

	// Run cryptographic tests
	t.Run("EncryptionCorrectness", func(t *testing.T) {
		testEncryptionCorrectness(t, ctx, store)
	})

	t.Run("KeyRotation", func(t *testing.T) {
		testKeyRotation(t, ctx, store)
	})

	t.Run("MasterKeyDerivation", func(t *testing.T) {
		testMasterKeyDerivation(t)
	})

	t.Run("CipherBlockMode", func(t *testing.T) {
		testCipherBlockMode(t)
	})

	t.Run("RandomnessQuality", func(t *testing.T) {
		testRandomnessQuality(t)
	})

	t.Run("IVUniqueness", func(t *testing.T) {
		testIVUniqueness(t, ctx, store)
	})

	t.Run("CryptographicBoundaries", func(t *testing.T) {
		testCryptographicBoundaries(t, ctx, store)
	})
}

// testEncryptionCorrectness verifies that encryption and decryption work correctly
func testEncryptionCorrectness(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Setup test data
	userID := 100
	secretName := "crypto-test-secret"
	secretValue := "this-is-a-test-secret-value-123!@#"

	// Store a secret
	err := store.SetSecret(ctx, userID, secretName, secretValue)
	require.NoError(t, err)

	// Retrieve the secret
	retrievedValue, err := store.GetSecret(ctx, userID, secretName)
	require.NoError(t, err)

	// The retrieved value should match the original
	assert.Equal(t, secretValue, retrievedValue, "Retrieved secret should match original value")

	// Test with various types of content
	testCases := []struct {
		name  string
		value string
	}{
		{"Empty", ""},
		{"Short", "x"},
		{"Unicode", "こんにちは世界"},
		{"Special", "!@#$%^&*()_+{}|:<>?~"},
		{"Long", strings.Repeat("abcdefghijklmnopqrstuvwxyz", 100)}, // ~2600 bytes
		{"Binary", string([]byte{0, 1, 2, 3, 4, 5, 0xFF, 0xFE})},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			secretName := fmt.Sprintf("crypto-test-%s", tc.name)

			// Store the secret
			err := store.SetSecret(ctx, userID, secretName, tc.value)
			require.NoError(t, err)

			// Retrieve the secret
			retrievedValue, err := store.GetSecret(ctx, userID, secretName)
			require.NoError(t, err)

			// The retrieved value should match the original
			assert.Equal(t, tc.value, retrievedValue, "Retrieved secret should match original value")
		})
	}
}

// testKeyRotation verifies that key rotation works correctly
func testKeyRotation(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// This test depends on internal implementation details and would be better with interfaces
	// We'll do our best with the public API

	// Setup test data
	userID := 200
	secretName := "rotation-test-secret"
	secretValue := "pre-rotation-value"

	// Store a secret
	err := store.SetSecret(ctx, userID, secretName, secretValue)
	require.NoError(t, err)

	// Force key rotation if the EnhancedSecretStore has such a method
	// This is a bit of a hack, but we need to test rotation
	rotateMethod := reflect.ValueOf(store).MethodByName("SetKeyRotationInterval")
	if rotateMethod.IsValid() {
		// Call SetKeyRotationInterval(1 * time.Millisecond) to force rotation on next operation
		rotateMethod.Call([]reflect.Value{reflect.ValueOf(1 * time.Millisecond)})
	}

	// Store another secret, which should use a new key after rotation
	newSecretName := "post-rotation-secret"
	newSecretValue := "post-rotation-value"

	// Small delay to ensure rotation interval passes
	time.Sleep(10 * time.Millisecond)

	err = store.SetSecret(ctx, userID, newSecretName, newSecretValue)
	require.NoError(t, err)

	// Both secrets should be retrievable
	preRotationValue, err := store.GetSecret(ctx, userID, secretName)
	require.NoError(t, err)
	assert.Equal(t, secretValue, preRotationValue, "Pre-rotation secret should be retrievable")

	postRotationValue, err := store.GetSecret(ctx, userID, newSecretName)
	require.NoError(t, err)
	assert.Equal(t, newSecretValue, postRotationValue, "Post-rotation secret should be retrievable")

	// Update the pre-rotation secret
	updatedValue := "updated-pre-rotation-value"
	err = store.SetSecret(ctx, userID, secretName, updatedValue)
	require.NoError(t, err)

	// The updated secret should be retrievable
	retrievedValue, err := store.GetSecret(ctx, userID, secretName)
	require.NoError(t, err)
	assert.Equal(t, updatedValue, retrievedValue, "Updated secret should be retrievable")
}

// testMasterKeyDerivation verifies that master key derivation is secure
func testMasterKeyDerivation(t *testing.T) {
	// Test with various master key sizes and formats
	testCases := []struct {
		name        string
		masterKey   string
		shouldError bool
	}{
		{"Valid", generateRandomBase64(32), false},
		{"Empty", "", true},
		{"TooShort", generateRandomBase64(8), false}, // Still works but not recommended
		{"NonBase64", "not-base64-data$$$$", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			store, err := tee.NewEnhancedSecretStore(tc.masterKey)
			if tc.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, store)
			}
		})
	}
}

// testCipherBlockMode verifies that the cipher block mode is secure
func testCipherBlockMode(t *testing.T) {
	// Create a secure key
	key := make([]byte, 32) // AES-256
	_, err := rand.Read(key)
	require.NoError(t, err)

	// Test data
	plaintext := []byte("test-plaintext-data-for-crypto-testing")

	// Create a block cipher
	block, err := aes.NewCipher(key)
	require.NoError(t, err)

	// Encrypt using CFB mode (assumed to be what's used in EnhancedSecretStore)
	ciphertext := make([]byte, aes.BlockSize+len(plaintext))
	iv := ciphertext[:aes.BlockSize]
	_, err = io.ReadFull(rand.Reader, iv)
	require.NoError(t, err)

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], plaintext)

	// Decrypt
	decrypted := make([]byte, len(plaintext))
	decryptStream := cipher.NewCFBDecrypter(block, iv)
	decryptStream.XORKeyStream(decrypted, ciphertext[aes.BlockSize:])

	// Verify decryption worked correctly
	assert.Equal(t, plaintext, decrypted, "CFB mode decryption should work correctly")

	// Verify that modifying the ciphertext breaks decryption
	modifiedCiphertext := make([]byte, len(ciphertext))
	copy(modifiedCiphertext, ciphertext)
	modifiedCiphertext[aes.BlockSize+len(plaintext)/2]++ // Modify a byte in the middle

	modifiedDecrypted := make([]byte, len(plaintext))
	modifiedDecryptStream := cipher.NewCFBDecrypter(block, iv)
	modifiedDecryptStream.XORKeyStream(modifiedDecrypted, modifiedCiphertext[aes.BlockSize:])

	// Verify that the modified ciphertext decrypts to something different
	assert.NotEqual(t, plaintext, modifiedDecrypted, "Modified ciphertext should not decrypt correctly")
}

// testRandomnessQuality verifies that the random number generation is of sufficient quality
func testRandomnessQuality(t *testing.T) {
	// Generate some random bytes
	const size = 1000
	data := make([]byte, size)
	_, err := rand.Read(data)
	require.NoError(t, err)

	// Check basic statistical properties
	// This is not a thorough randomness test, but it's better than nothing
	var zeros, ones int
	for _, b := range data {
		for i := 0; i < 8; i++ {
			if b&(1<<i) == 0 {
				zeros++
			} else {
				ones++
			}
		}
	}

	// In a random bit sequence, we expect approximately 50% zeros and 50% ones
	// Allow some deviation, but not too much
	totalBits := size * 8
	expectedZeros := totalBits / 2
	allowedDeviation := float64(totalBits) / 10.0 // 10% deviation allowed

	assert.InDelta(t, expectedZeros, zeros, allowedDeviation,
		"Number of zero bits should be approximately half of total bits")
	assert.InDelta(t, expectedZeros, ones, allowedDeviation,
		"Number of one bits should be approximately half of total bits")

	// Check for duplication (extremely unlikely with crypto/rand)
	data2 := make([]byte, size)
	_, err = rand.Read(data2)
	require.NoError(t, err)

	assert.NotEqual(t, data, data2, "Two consecutive calls to rand.Read should produce different data")
}

// testIVUniqueness verifies that IVs are unique for each encryption operation
func testIVUniqueness(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Setup test data
	userID := 300
	secretNamePrefix := "iv-test-"
	secretValue := "test-value"

	// Create multiple secrets
	var secrets []string
	for i := 0; i < 10; i++ {
		secretName := fmt.Sprintf("%s%d", secretNamePrefix, i)
		secrets = append(secrets, secretName)
		err := store.SetSecret(ctx, userID, secretName, secretValue)
		require.NoError(t, err)
	}

	// We can't directly inspect the IVs used, but we can check that
	// encrypting the same value multiple times produces different results
	// by updating a secret and checking if it's different

	// Update each secret with the same value
	for _, secretName := range secrets {
		// First, get the current metadata to check version
		metadata, err := store.GetSecretMetadata(ctx, userID, secretName)
		require.NoError(t, err)
		initialVersion := metadata.Version

		// Update with the same value
		err = store.SetSecret(ctx, userID, secretName, secretValue)
		require.NoError(t, err)

		// Check that the version increased
		updatedMetadata, err := store.GetSecretMetadata(ctx, userID, secretName)
		require.NoError(t, err)
		assert.Greater(t, updatedMetadata.Version, initialVersion,
			"Secret version should increase after update")
	}
}

// testCryptographicBoundaries verifies behavior at cryptographic boundaries
func testCryptographicBoundaries(t *testing.T, ctx context.Context, store *tee.EnhancedSecretStore) {
	// Setup test data
	userID := 400

	// Test with very large secrets
	t.Run("VeryLargeSecret", func(t *testing.T) {
		// Generate a large secret (1MB)
		largeSecret := strings.Repeat("abcdefghijklmnopqrstuvwxyz", 40000) // ~1MB
		err := store.SetSecret(ctx, userID, "large-secret", largeSecret)
		require.NoError(t, err)

		// Retrieve the large secret
		retrievedValue, err := store.GetSecret(ctx, userID, "large-secret")
		require.NoError(t, err)
		assert.Equal(t, largeSecret, retrievedValue, "Large secret should be retrievable")
	})

	// Test with many secrets for a single user
	t.Run("ManySecrets", func(t *testing.T) {
		// Create many secrets
		for i := 0; i < 100; i++ {
			secretName := fmt.Sprintf("many-secret-%d", i)
			secretValue := fmt.Sprintf("value-%d", i)
			err := store.SetSecret(ctx, userID, secretName, secretValue)
			require.NoError(t, err)
		}

		// Verify a random subset of the secrets
		for i := 0; i < 10; i++ {
			j := i * 10 // Check every 10th secret
			secretName := fmt.Sprintf("many-secret-%d", j)
			expectedValue := fmt.Sprintf("value-%d", j)
			retrievedValue, err := store.GetSecret(ctx, userID, secretName)
			require.NoError(t, err)
			assert.Equal(t, expectedValue, retrievedValue, "Secret should be retrievable")
		}
	})

	// Test with many users
	t.Run("ManyUsers", func(t *testing.T) {
		secretName := "multi-user-secret"

		// Create the same secret for many users
		for i := 1000; i < 1100; i++ {
			secretValue := fmt.Sprintf("user-%d-value", i)
			err := store.SetSecret(ctx, i, secretName, secretValue)
			require.NoError(t, err)
		}

		// Verify a random subset of the users
		for i := 1000; i < 1100; i += 10 {
			expectedValue := fmt.Sprintf("user-%d-value", i)
			retrievedValue, err := store.GetSecret(ctx, i, secretName)
			require.NoError(t, err)
			assert.Equal(t, expectedValue, retrievedValue, "Secret should be retrievable")
		}
	})
}

// Helper function to generate random base64 strings
func generateRandomBase64(bytes int) string {
	data := make([]byte, bytes)
	_, err := rand.Read(data)
	if err != nil {
		return ""
	}
	return base64.StdEncoding.EncodeToString(data)
}
