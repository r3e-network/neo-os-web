// Package secrets provides encrypted secret storage for per-user service secrets.
package secrets

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
)

// MasterKeyEnv is the environment variable holding the master encryption key.
const MasterKeyEnv = "SECRETS_MASTER_KEY"

// Provider retrieves decrypted secrets for a given user.
type Provider interface {
	GetSecret(ctx context.Context, userID, secretName string) (string, error)
}

// Repository is the storage backend for encrypted secret records.
type Repository interface {
	GetEncryptedSecret(ctx context.Context, userID, serviceID, secretName string) (ciphertext []byte, err error)
}

// Manager encrypts/decrypts secrets using AES-256-GCM with a master key.
type Manager struct {
	repo Repository
	aead cipher.AEAD
}

// NewManager creates a Manager from a repository and raw master key material.
func NewManager(repo Repository, rawKey []byte) (*Manager, error) {
	key := sha256.Sum256(rawKey)
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("secrets: new cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("secrets: new gcm: %w", err)
	}
	return &Manager{repo: repo, aead: aead}, nil
}

// GetSecret retrieves and decrypts a secret for the given user and service.
func (m *Manager) GetSecret(ctx context.Context, userID, serviceID, secretName string) (string, error) {
	ct, err := m.repo.GetEncryptedSecret(ctx, userID, serviceID, secretName)
	if err != nil {
		return "", err
	}
	plain, err := m.decrypt(ct)
	if err != nil {
		return "", fmt.Errorf("secrets: decrypt %q: %w", secretName, err)
	}
	return string(plain), nil
}

// Encrypt encrypts plaintext and returns base64-encoded ciphertext.
func (m *Manager) Encrypt(plaintext []byte) (string, error) {
	nonce := make([]byte, m.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := m.aead.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

func (m *Manager) decrypt(ciphertext []byte) ([]byte, error) {
	// Try base64 decode first
	raw, err := base64.StdEncoding.DecodeString(string(ciphertext))
	if err != nil {
		raw = ciphertext // assume raw bytes
	}
	ns := m.aead.NonceSize()
	if len(raw) < ns {
		return nil, fmt.Errorf("ciphertext too short")
	}
	return m.aead.Open(nil, raw[:ns], raw[ns:], nil)
}

// ServiceProvider wraps a Manager with a fixed service ID, implementing Provider.
type ServiceProvider struct {
	Manager   *Manager
	ServiceID string
}

// GetSecret implements Provider.
func (sp ServiceProvider) GetSecret(ctx context.Context, userID, secretName string) (string, error) {
	return sp.Manager.GetSecret(ctx, userID, sp.ServiceID, secretName)
}
