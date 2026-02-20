// Package secrets provides TEE-aware secret management with AES-GCM encryption.
// Secrets are stored encrypted in Supabase and decrypted inside the enclave
// using a master key provisioned via MarbleRun.
package secrets

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/secrets/supabase"
)

// MasterKeyEnv is the environment variable (or MarbleRun secret name) that
// holds the 32-byte master encryption key used to wrap/unwrap user secrets.
const MasterKeyEnv = "SECRETS_MASTER_KEY"

// Provider is the interface consumed by services that need to read user
// secrets inside the TEE.
type Provider interface {
	// GetSecret retrieves and decrypts a user's secret by name.
	// Returns the plaintext string value or an error.
	GetSecret(ctx context.Context, userID, secretName string) (string, error)
}

// Manager handles encryption/decryption of secrets using AES-256-GCM.
type Manager struct {
	repo supabase.RepositoryInterface
	aead cipher.AEAD
}

// NewManager creates a Manager from a Supabase repository and a raw master key.
// The raw key is hashed with SHA-256 to guarantee a 32-byte AES-256 key.
func NewManager(repo supabase.RepositoryInterface, rawKey []byte) (*Manager, error) {
	if repo == nil {
		return nil, fmt.Errorf("secrets: repository cannot be nil")
	}
	if len(rawKey) == 0 {
		return nil, fmt.Errorf("secrets: master key cannot be empty")
	}

	key := sha256.Sum256(rawKey)
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("secrets: create cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("secrets: create GCM: %w", err)
	}

	return &Manager{repo: repo, aead: aead}, nil
}

// GetSecret retrieves and decrypts a secret for the given user.
func (m *Manager) GetSecret(ctx context.Context, userID, secretName string) (string, error) {
	secret, err := m.repo.GetSecretByName(ctx, userID, secretName)
	if err != nil {
		return "", fmt.Errorf("secrets: fetch %q: %w", secretName, err)
	}
	if secret == nil {
		return "", fmt.Errorf("secrets: %q not found", secretName)
	}
	plaintext, err := m.decrypt(secret.EncryptedValue)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// Encrypt encrypts plaintext using AES-256-GCM. The nonce is prepended to the
// ciphertext so that Decrypt can extract it.
func (m *Manager) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, m.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("secrets: generate nonce: %w", err)
	}
	return m.aead.Seal(nonce, nonce, plaintext, nil), nil
}

func (m *Manager) decrypt(ciphertext []byte) ([]byte, error) {
	nonceSize := m.aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("secrets: ciphertext too short")
	}
	nonce, ct := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := m.aead.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("secrets: decrypt: %w", err)
	}
	return plaintext, nil
}

// ServiceProvider wraps a Manager with a fixed service ID and enforces
// per-secret access policies before returning decrypted values.
type ServiceProvider struct {
	Manager   *Manager
	ServiceID string
}

// GetSecret checks that the calling service is allowed to access the secret,
// then decrypts and returns it.
func (sp ServiceProvider) GetSecret(ctx context.Context, userID, secretName string) (string, error) {
	if sp.Manager == nil {
		return "", fmt.Errorf("secrets: manager not initialized")
	}

	// Enforce policy: check if this service is allowed to read the secret.
	allowed, err := sp.Manager.repo.GetAllowedServices(ctx, userID, secretName)
	if err != nil {
		return "", fmt.Errorf("secrets: check policy for %q: %w", secretName, err)
	}

	authorized := false
	for _, svc := range allowed {
		if svc == sp.ServiceID {
			authorized = true
			break
		}
	}
	if !authorized {
		if auditErr := sp.Manager.repo.CreateAuditLog(ctx, &supabase.AuditLog{
			UserID:       userID,
			SecretName:   secretName,
			Action:       "read",
			ServiceID:    sp.ServiceID,
			Success:      false,
			ErrorMessage: "service not in allowlist",
		}); auditErr != nil {
			return "", fmt.Errorf("secrets: service %q not authorized for %q (audit log failed: %w)", sp.ServiceID, secretName, auditErr)
		}
		return "", fmt.Errorf("secrets: service %q not authorized for %q", sp.ServiceID, secretName)
	}

	plaintext, err := sp.Manager.GetSecret(ctx, userID, secretName)
	if err != nil {
		if auditErr := sp.Manager.repo.CreateAuditLog(ctx, &supabase.AuditLog{
			UserID:       userID,
			SecretName:   secretName,
			Action:       "read",
			ServiceID:    sp.ServiceID,
			Success:      false,
			ErrorMessage: err.Error(),
		}); auditErr != nil {
			return "", fmt.Errorf("%w (audit log failed: %v)", err, auditErr)
		}
		return "", err
	}

	if auditErr := sp.Manager.repo.CreateAuditLog(ctx, &supabase.AuditLog{
		UserID:     userID,
		SecretName: secretName,
		Action:     "read",
		ServiceID:  sp.ServiceID,
		Success:    true,
	}); auditErr != nil {
		return "", fmt.Errorf("secrets: audit log write failed: %w", auditErr)
	}

	return plaintext, nil
}
