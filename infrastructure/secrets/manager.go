package secrets

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strings"

	secretssupabase "github.com/R3E-Network/service_layer/infrastructure/secrets/supabase"
)

type Repository interface {
	GetSecretByName(ctx context.Context, userID, name string) (*secretssupabase.Secret, error)
	GetAllowedServices(ctx context.Context, userID, secretName string) ([]string, error)
	CreateAuditLog(ctx context.Context, log *secretssupabase.AuditLog) error
}

type Manager struct {
	repo Repository
	aead cipher.AEAD
}

func NewManager(repo Repository, rawKey []byte) (*Manager, error) {
	if repo == nil {
		return nil, fmt.Errorf("secrets: repository is required")
	}
	key, err := normalizeMasterKey(rawKey)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Manager{repo: repo, aead: aead}, nil
}

func (m *Manager) GetSecretForService(ctx context.Context, userID, name, serviceID string, strict bool) (string, error) {
	if userID == "" || name == "" {
		return "", fmt.Errorf("secrets: userID and name required")
	}
	if serviceID == "" {
		m.audit(ctx, userID, name, serviceID, false, ErrForbidden)
		return "", ErrForbidden
	}

	secret, err := m.repo.GetSecretByName(ctx, userID, name)
	if err != nil {
		m.audit(ctx, userID, name, serviceID, false, err)
		return "", err
	}
	if secret == nil {
		m.audit(ctx, userID, name, serviceID, false, ErrNotFound)
		return "", ErrNotFound
	}

	allowed, err := m.repo.GetAllowedServices(ctx, userID, name)
	if err != nil {
		m.audit(ctx, userID, name, serviceID, false, err)
		return "", err
	}
	if !serviceAllowed(serviceID, allowed) {
		if len(allowed) == 0 && !strict {
			// Non-strict mode allows secrets without explicit policies.
		} else {
			m.audit(ctx, userID, name, serviceID, false, ErrForbidden)
			return "", ErrForbidden
		}
	}

	plaintext, err := m.decryptSecretValue(secret.EncryptedValue)
	if err != nil {
		m.audit(ctx, userID, name, serviceID, false, err)
		return "", err
	}

	m.audit(ctx, userID, name, serviceID, true, nil)
	return plaintext, nil
}

func (m *Manager) audit(ctx context.Context, userID, name, serviceID string, success bool, err error) {
	if m.repo == nil {
		return
	}
	logEntry := &secretssupabase.AuditLog{
		UserID:       userID,
		SecretName:   name,
		Action:       "read",
		ServiceID:    serviceID,
		Success:      success,
		ErrorMessage: "",
	}
	if err != nil {
		logEntry.ErrorMessage = err.Error()
	}
	_ = m.repo.CreateAuditLog(ctx, logEntry)
}

func (m *Manager) encryptSecretValue(value string) ([]byte, error) {
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	ciphertext := m.aead.Seal(nil, nonce, []byte(value), nil)
	out := append(nonce, ciphertext...)
	return out, nil
}

func (m *Manager) decryptSecretValue(raw []byte) (string, error) {
	if len(raw) < 13 {
		return "", ErrInvalidCiphertext
	}
	nonce := raw[:12]
	ciphertext := raw[12:]
	plain, err := m.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidCiphertext, err)
	}
	return string(plain), nil
}

func normalizeMasterKey(raw []byte) ([]byte, error) {
	trimmed := strings.TrimSpace(string(raw))
	trimmed = strings.TrimPrefix(strings.TrimPrefix(trimmed, "0x"), "0X")
	if trimmed == "" {
		return nil, fmt.Errorf("secrets: %s is required", MasterKeyEnv)
	}
	if isHex(trimmed) {
		decoded, err := hex.DecodeString(trimmed)
		if err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}

	if len(trimmed) == 32 {
		if !isDevEnv() {
			return nil, fmt.Errorf("secrets: %s must be 32 bytes (or 64 hex chars)", MasterKeyEnv)
		}
		log.Printf("[SECURITY WARNING] Using plaintext %s in development mode.", MasterKeyEnv)
		return []byte(trimmed), nil
	}
	return nil, fmt.Errorf("secrets: %s must be 32 bytes (or 64 hex chars)", MasterKeyEnv)
}

func isHex(value string) bool {
	if value == "" {
		return false
	}
	for _, c := range value {
		switch {
		case c >= '0' && c <= '9':
		case c >= 'a' && c <= 'f':
		case c >= 'A' && c <= 'F':
		default:
			return false
		}
	}
	return true
}

func isDevEnv() bool {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("DENO_ENV")))
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("NODE_ENV")))
	}
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	}
	return env == "development" || env == "dev" || env == "local"
}

func serviceAllowed(serviceID string, allowed []string) bool {
	if serviceID == "" {
		return false
	}
	for _, svc := range allowed {
		if svc == serviceID {
			return true
		}
	}
	return false
}
