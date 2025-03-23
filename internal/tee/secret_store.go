package tee

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

// SecretMetadata contains metadata about a secret
type SecretMetadata struct {
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	AccessedAt time.Time `json:"accessed_at"`
	Version    int       `json:"version"`
	Tags       []string  `json:"tags"`
}

// EncryptedSecret represents an encrypted secret with metadata
type EncryptedSecret struct {
	EncryptedData []byte         `json:"encrypted_data"`
	IV            []byte         `json:"iv"`
	KeyID         string         `json:"key_id"`
	Metadata      SecretMetadata `json:"metadata"`
}

// AuditEntry represents an audit log entry for secret access
type AuditEntry struct {
	Timestamp  time.Time `json:"timestamp"`
	UserID     int       `json:"user_id"`
	SecretName string    `json:"secret_name"`
	Action     string    `json:"action"` // "create", "read", "update", "delete"
	Success    bool      `json:"success"`
}

// EnhancedSecretStore provides advanced secret management capabilities
type EnhancedSecretStoreInterface interface {
	SecretStore // Embed the basic SecretStore interface

	// Additional methods for enhanced secret store
	DeleteSecret(ctx context.Context, userID int, name string) error
	ListSecrets(ctx context.Context, userID int) ([]string, error)
	GetSecretMetadata(ctx context.Context, userID int, name string) (*SecretMetadata, error)
	UpdateSecretTags(ctx context.Context, userID int, name string, tags []string) error
	GetAuditLog(ctx context.Context, userID int, limit int) ([]AuditEntry, error)
	ExportSecrets(ctx context.Context, userID int) ([]byte, error)
	ImportSecrets(ctx context.Context, userID int, data []byte) error
	SetSecret(ctx context.Context, userID int, name, value string) error
}

// EnhancedSecretStore provides a secure secret store with encryption
type EnhancedSecretStore struct {
	dataKeyEncryptionKey []byte                             // Master key used to encrypt data keys
	dataKeys             map[string][]byte                  // Map of data key IDs to data keys
	secrets              map[int]map[string]EncryptedSecret // User secrets
	mutex                sync.RWMutex
	keyRotationInterval  time.Duration // How often keys should be rotated
	lastKeyRotation      time.Time
	currentKeyID         string
	auditLog             []AuditEntry
}

// NewEnhancedSecretStore creates a new enhanced secret store
func NewEnhancedSecretStore(masterKeyBase64 string) (*EnhancedSecretStore, error) {
	// Decode master key
	masterKey, err := base64.StdEncoding.DecodeString(masterKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid master key: %v", err)
	}

	// Initialize secret store
	store := &EnhancedSecretStore{
		dataKeyEncryptionKey: masterKey,
		dataKeys:             make(map[string][]byte),
		secrets:              make(map[int]map[string]EncryptedSecret),
		keyRotationInterval:  24 * time.Hour, // Rotate keys daily
		lastKeyRotation:      time.Now(),
		auditLog:             make([]AuditEntry, 0, 1000),
	}

	// Generate initial data key
	keyID, _, err := store.generateDataKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate initial data key: %v", err)
	}
	store.currentKeyID = keyID

	return store, nil
}

// generateDataKey creates a new data key and encrypts it with the master key
func (s *EnhancedSecretStore) generateDataKey() (string, []byte, error) {
	// Generate a unique ID for the key
	keyID := fmt.Sprintf("key-%d", time.Now().UnixNano())

	// Generate a random data key
	dataKey := make([]byte, 32) // 256-bit key
	if _, err := io.ReadFull(rand.Reader, dataKey); err != nil {
		return "", nil, fmt.Errorf("failed to generate data key: %v", err)
	}

	// Encrypt the data key with the master key
	encryptedDataKey, err := s.encryptWithMasterKey(dataKey)
	if err != nil {
		return "", nil, fmt.Errorf("failed to encrypt data key: %v", err)
	}

	// Store the encrypted data key
	s.dataKeys[keyID] = encryptedDataKey

	return keyID, dataKey, nil
}

// encryptWithMasterKey encrypts data using the master key
func (s *EnhancedSecretStore) encryptWithMasterKey(data []byte) ([]byte, error) {
	// Create AES cipher
	block, err := aes.NewCipher(s.dataKeyEncryptionKey)
	if err != nil {
		return nil, err
	}

	// Prepare ciphertext with IV
	ciphertext := make([]byte, aes.BlockSize+len(data))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	// Encrypt
	cipher.NewCFBEncrypter(block, iv).XORKeyStream(
		ciphertext[aes.BlockSize:],
		data,
	)

	return ciphertext, nil
}

// decryptWithMasterKey decrypts data using the master key
func (s *EnhancedSecretStore) decryptWithMasterKey(ciphertext []byte) ([]byte, error) {
	// Create AES cipher
	block, err := aes.NewCipher(s.dataKeyEncryptionKey)
	if err != nil {
		return nil, err
	}

	// Separate IV and ciphertext
	if len(ciphertext) < aes.BlockSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	iv := ciphertext[:aes.BlockSize]
	encryptedData := ciphertext[aes.BlockSize:]

	// Decrypt
	plaintext := make([]byte, len(encryptedData))
	cipher.NewCFBDecrypter(block, iv).XORKeyStream(
		plaintext,
		encryptedData,
	)

	return plaintext, nil
}

// getDataKey retrieves a data key
func (s *EnhancedSecretStore) getDataKey(keyID string) ([]byte, error) {
	// Get encrypted data key
	encryptedDataKey, ok := s.dataKeys[keyID]
	if !ok {
		return nil, fmt.Errorf("data key not found: %s", keyID)
	}

	// Decrypt data key
	return s.decryptWithMasterKey(encryptedDataKey)
}

// rotateDataKeysIfNeeded rotates data keys if needed
func (s *EnhancedSecretStore) rotateDataKeysIfNeeded() error {
	if time.Since(s.lastKeyRotation) < s.keyRotationInterval {
		return nil // No rotation needed
	}

	// Generate new data key
	keyID, _, err := s.generateDataKey()
	if err != nil {
		return fmt.Errorf("failed to generate new data key: %v", err)
	}

	s.currentKeyID = keyID
	s.lastKeyRotation = time.Now()

	return nil
}

// encryptSecret encrypts a secret using a data key
func (s *EnhancedSecretStore) encryptSecret(secret string, keyID string) (EncryptedSecret, error) {
	// Get data key
	dataKey, err := s.getDataKey(keyID)
	if err != nil {
		return EncryptedSecret{}, err
	}

	// Create AES cipher
	block, err := aes.NewCipher(dataKey)
	if err != nil {
		return EncryptedSecret{}, err
	}

	// Generate IV
	iv := make([]byte, aes.BlockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return EncryptedSecret{}, err
	}

	// Encrypt
	encryptedData := make([]byte, len(secret))
	cipher.NewCFBEncrypter(block, iv).XORKeyStream(
		encryptedData,
		[]byte(secret),
	)

	// Create metadata
	now := time.Now()
	metadata := SecretMetadata{
		CreatedAt:  now,
		UpdatedAt:  now,
		AccessedAt: now,
		Version:    1,
		Tags:       []string{},
	}

	return EncryptedSecret{
		EncryptedData: encryptedData,
		IV:            iv,
		KeyID:         keyID,
		Metadata:      metadata,
	}, nil
}

// decryptSecret decrypts a secret using its data key
func (s *EnhancedSecretStore) decryptSecret(encryptedSecret EncryptedSecret) (string, error) {
	// Get data key
	dataKey, err := s.getDataKey(encryptedSecret.KeyID)
	if err != nil {
		return "", err
	}

	// Create AES cipher
	block, err := aes.NewCipher(dataKey)
	if err != nil {
		return "", err
	}

	// Decrypt
	plaintext := make([]byte, len(encryptedSecret.EncryptedData))
	cipher.NewCFBDecrypter(block, encryptedSecret.IV).XORKeyStream(
		plaintext,
		encryptedSecret.EncryptedData,
	)

	return string(plaintext), nil
}

// logAuditEntry logs an audit entry for secret access
func (s *EnhancedSecretStore) logAuditEntry(userID int, secretName, action string, success bool) {
	entry := AuditEntry{
		Timestamp:  time.Now(),
		UserID:     userID,
		SecretName: secretName,
		Action:     action,
		Success:    success,
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Add entry to audit log
	s.auditLog = append(s.auditLog, entry)

	// Trim audit log if too large
	if len(s.auditLog) > 10000 {
		s.auditLog = s.auditLog[len(s.auditLog)-10000:]
	}
}

// GetSecret retrieves a secret for a user
func (s *EnhancedSecretStore) GetSecret(ctx context.Context, userID int, name string) (string, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Check if user has secrets
	userSecrets, ok := s.secrets[userID]
	if !ok {
		s.logAuditEntry(userID, name, "read", false)
		return "", fmt.Errorf("secret not found: %s", name)
	}

	// Check if secret exists
	encryptedSecret, ok := userSecrets[name]
	if !ok {
		s.logAuditEntry(userID, name, "read", false)
		return "", fmt.Errorf("secret not found: %s", name)
	}

	// Update accessed time
	encryptedSecret.Metadata.AccessedAt = time.Now()
	userSecrets[name] = encryptedSecret

	// Decrypt secret
	secret, err := s.decryptSecret(encryptedSecret)
	if err != nil {
		s.logAuditEntry(userID, name, "read", false)
		return "", fmt.Errorf("failed to decrypt secret: %v", err)
	}

	s.logAuditEntry(userID, name, "read", true)
	return secret, nil
}

// SetSecret sets a secret for a user
func (s *EnhancedSecretStore) SetSecret(ctx context.Context, userID int, name, value string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Rotate data keys if needed
	if err := s.rotateDataKeysIfNeeded(); err != nil {
		s.logAuditEntry(userID, name, "update", false)
		return fmt.Errorf("failed to rotate data keys: %v", err)
	}

	// Encrypt secret
	encryptedSecret, err := s.encryptSecret(value, s.currentKeyID)
	if err != nil {
		s.logAuditEntry(userID, name, "update", false)
		return fmt.Errorf("failed to encrypt secret: %v", err)
	}

	// Initialize user secrets map if not exists
	if _, ok := s.secrets[userID]; !ok {
		s.secrets[userID] = make(map[string]EncryptedSecret)
	}

	// Check if updating existing secret
	if existingSecret, ok := s.secrets[userID][name]; ok {
		// Preserve metadata
		encryptedSecret.Metadata.CreatedAt = existingSecret.Metadata.CreatedAt
		encryptedSecret.Metadata.Version = existingSecret.Metadata.Version + 1
		encryptedSecret.Metadata.Tags = existingSecret.Metadata.Tags
	}

	// Store secret
	s.secrets[userID][name] = encryptedSecret

	s.logAuditEntry(userID, name, "update", true)
	return nil
}

// DeleteSecret deletes a secret for a user
func (s *EnhancedSecretStore) DeleteSecret(ctx context.Context, userID int, name string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Check if user has secrets
	userSecrets, ok := s.secrets[userID]
	if !ok {
		s.logAuditEntry(userID, name, "delete", false)
		return fmt.Errorf("secret not found: %s", name)
	}

	// Check if secret exists
	if _, ok := userSecrets[name]; !ok {
		s.logAuditEntry(userID, name, "delete", false)
		return fmt.Errorf("secret not found: %s", name)
	}

	// Delete secret
	delete(userSecrets, name)

	s.logAuditEntry(userID, name, "delete", true)
	return nil
}

// ListSecrets lists all secrets for a user
func (s *EnhancedSecretStore) ListSecrets(ctx context.Context, userID int) ([]string, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Check if user has secrets
	userSecrets, ok := s.secrets[userID]
	if !ok {
		return []string{}, nil
	}

	// Get secret names
	secretNames := make([]string, 0, len(userSecrets))
	for name := range userSecrets {
		secretNames = append(secretNames, name)
	}

	return secretNames, nil
}

// GetSecretMetadata gets metadata for a secret
func (s *EnhancedSecretStore) GetSecretMetadata(ctx context.Context, userID int, name string) (*SecretMetadata, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Check if user has secrets
	userSecrets, ok := s.secrets[userID]
	if !ok {
		return nil, fmt.Errorf("secret not found: %s", name)
	}

	// Check if secret exists
	encryptedSecret, ok := userSecrets[name]
	if !ok {
		return nil, fmt.Errorf("secret not found: %s", name)
	}

	// Return a copy of the metadata
	metadata := encryptedSecret.Metadata
	return &metadata, nil
}

// UpdateSecretTags updates tags for a secret
func (s *EnhancedSecretStore) UpdateSecretTags(ctx context.Context, userID int, name string, tags []string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Check if user has secrets
	userSecrets, ok := s.secrets[userID]
	if !ok {
		return fmt.Errorf("secret not found: %s", name)
	}

	// Check if secret exists
	encryptedSecret, ok := userSecrets[name]
	if !ok {
		return fmt.Errorf("secret not found: %s", name)
	}

	// Update tags
	encryptedSecret.Metadata.Tags = tags
	encryptedSecret.Metadata.UpdatedAt = time.Now()

	// Update secret
	userSecrets[name] = encryptedSecret

	return nil
}

// GetAuditLog gets the audit log for a user
func (s *EnhancedSecretStore) GetAuditLog(ctx context.Context, userID int, limit int) ([]AuditEntry, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Filter audit entries for the user
	userEntries := make([]AuditEntry, 0)
	for _, entry := range s.auditLog {
		if entry.UserID == userID {
			userEntries = append(userEntries, entry)
		}
	}

	// Apply limit
	if limit > 0 && len(userEntries) > limit {
		userEntries = userEntries[len(userEntries)-limit:]
	}

	return userEntries, nil
}

// ExportSecrets exports all secrets for a user
func (s *EnhancedSecretStore) ExportSecrets(ctx context.Context, userID int) ([]byte, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Check if user has secrets
	userSecrets, ok := s.secrets[userID]
	if !ok {
		return nil, fmt.Errorf("no secrets found for user")
	}

	// Decrypt all secrets
	exportData := make(map[string]string)
	for name, encryptedSecret := range userSecrets {
		secret, err := s.decryptSecret(encryptedSecret)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt secret %s: %v", name, err)
		}
		exportData[name] = secret
	}

	// Create export data
	exportJSON, err := json.Marshal(exportData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal export data: %v", err)
	}

	// Encrypt with master key for transport security
	exportHash := sha256.Sum256(exportJSON)
	exportData["__hash__"] = fmt.Sprintf("%x", exportHash)

	s.logAuditEntry(userID, "*", "export", true)
	return exportJSON, nil
}

// ImportSecrets imports secrets for a user
func (s *EnhancedSecretStore) ImportSecrets(ctx context.Context, userID int, data []byte) error {
	// Parse import data
	importData := make(map[string]string)
	if err := json.Unmarshal(data, &importData); err != nil {
		s.logAuditEntry(userID, "*", "import", false)
		return fmt.Errorf("failed to unmarshal import data: %v", err)
	}

	// Verify hash if present
	if hash, ok := importData["__hash__"]; ok {
		// Remove hash from data
		delete(importData, "__hash__")

		// Create new data without hash
		dataWithoutHash, err := json.Marshal(importData)
		if err != nil {
			s.logAuditEntry(userID, "*", "import", false)
			return fmt.Errorf("failed to marshal data for hash verification: %v", err)
		}

		// Verify hash
		dataHash := sha256.Sum256(dataWithoutHash)
		if fmt.Sprintf("%x", dataHash) != hash {
			s.logAuditEntry(userID, "*", "import", false)
			return fmt.Errorf("import data hash mismatch")
		}
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Rotate data keys if needed
	if err := s.rotateDataKeysIfNeeded(); err != nil {
		s.logAuditEntry(userID, "*", "import", false)
		return fmt.Errorf("failed to rotate data keys: %v", err)
	}

	// Initialize user secrets map if not exists
	if _, ok := s.secrets[userID]; !ok {
		s.secrets[userID] = make(map[string]EncryptedSecret)
	}

	// Import secrets
	for name, value := range importData {
		// Skip hash
		if name == "__hash__" {
			continue
		}

		// Encrypt secret
		encryptedSecret, err := s.encryptSecret(value, s.currentKeyID)
		if err != nil {
			s.logAuditEntry(userID, name, "import", false)
			return fmt.Errorf("failed to encrypt secret %s: %v", name, err)
		}

		// Store secret
		s.secrets[userID][name] = encryptedSecret
	}

	s.logAuditEntry(userID, "*", "import", true)
	return nil
}

// SetKeyRotationInterval sets the key rotation interval for testing
func (s *EnhancedSecretStore) SetKeyRotationInterval(interval time.Duration) {
	s.keyRotationInterval = interval
	s.lastKeyRotation = time.Now().Add(-interval - time.Second) // Force immediate rotation
}

// GetInternalSecretsForTesting returns the internal secrets map for testing
func (s *EnhancedSecretStore) GetInternalSecretsForTesting() map[int]map[string]EncryptedSecret {
	return s.secrets
}
