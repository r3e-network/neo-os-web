package tee

import (
	"context"
	"fmt"
)

// MockSecretStore is a mock implementation of the SecretStore interface for testing
type MockSecretStore struct {
	secrets map[int]map[string]string
}

// NewMockSecretStore creates a new mock secret store for testing
func NewMockSecretStore() *MockSecretStore {
	return &MockSecretStore{
		secrets: make(map[int]map[string]string),
	}
}

// GetSecret retrieves a secret from the mock store
func (s *MockSecretStore) GetSecret(ctx context.Context, userID int, name string) (string, error) {
	if userSecrets, ok := s.secrets[userID]; ok {
		if secret, ok := userSecrets[name]; ok {
			return secret, nil
		}
	}
	return "", fmt.Errorf("secret not found: %s", name)
}

// AddSecret adds a secret to the mock store
func (s *MockSecretStore) AddSecret(userID int, name string, value string) {
	if _, ok := s.secrets[userID]; !ok {
		s.secrets[userID] = make(map[string]string)
	}
	s.secrets[userID][name] = value
}
