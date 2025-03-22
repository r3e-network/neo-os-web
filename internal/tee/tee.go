package tee

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Provider defines the interface for TEE providers
type Provider interface {
	// Initialize initializes the TEE provider
	Initialize() error

	// ExecuteFunction executes a JavaScript function in the TEE
	ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, secrets map[string]string) (*models.ExecutionResult, error)

	// StoreSecret securely stores a secret in the TEE
	StoreSecret(ctx context.Context, secret *models.Secret) error

	// GetSecret retrieves a secret from the TEE
	GetSecret(ctx context.Context, userID int, secretName string) (string, error)

	// DeleteSecret deletes a secret from the TEE
	DeleteSecret(ctx context.Context, userID int, secretName string) error

	// GetAttestation gets an attestation report from the TEE
	GetAttestation(ctx context.Context) ([]byte, error)

	// Close closes the TEE provider
	Close() error
}

// Manager manages the TEE environment
type Manager struct {
	config   *config.TEEConfig
	logger   *logger.Logger
	provider Provider
}

// New creates a new TEE manager
func New(cfg *config.TEEConfig, log *logger.Logger) (*Manager, error) {
	// Create TEE manager
	manager := &Manager{
		config: cfg,
		logger: log,
	}

	// Create TEE provider based on configuration
	var provider Provider
	var err error

	switch cfg.Provider {
	case "azure":
		provider, err = newAzureProvider(cfg.Azure, log)
	default:
		return nil, fmt.Errorf("unsupported TEE provider: %s", cfg.Provider)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create TEE provider: %w", err)
	}

	manager.provider = provider

	// Initialize the provider
	if err := provider.Initialize(); err != nil {
		return nil, fmt.Errorf("failed to initialize TEE provider: %w", err)
	}

	return manager, nil
}

// ExecuteFunction executes a JavaScript function in the TEE
func (m *Manager) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, secretNames []string) (*models.ExecutionResult, error) {
	// TODO: Implement secret retrieval logic
	// This would retrieve the actual secret values based on the names
	secrets := make(map[string]string)

	// Execute the function
	result, err := m.provider.ExecuteFunction(ctx, function, params, secrets)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// StoreSecret securely stores a secret in the TEE
func (m *Manager) StoreSecret(ctx context.Context, secret *models.Secret) error {
	return m.provider.StoreSecret(ctx, secret)
}

// GetSecret retrieves a secret from the TEE
func (m *Manager) GetSecret(ctx context.Context, userID int, secretName string) (string, error) {
	return m.provider.GetSecret(ctx, userID, secretName)
}

// DeleteSecret deletes a secret from the TEE
func (m *Manager) DeleteSecret(ctx context.Context, userID int, secretName string) error {
	return m.provider.DeleteSecret(ctx, userID, secretName)
}

// GetAttestation gets an attestation report from the TEE
func (m *Manager) GetAttestation(ctx context.Context) ([]byte, error) {
	return m.provider.GetAttestation(ctx)
}

// Close closes the TEE manager
func (m *Manager) Close() error {
	if m.provider != nil {
		return m.provider.Close()
	}
	return nil
}