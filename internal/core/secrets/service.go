package secrets

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/internal/tee"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Service handles secret management
type Service struct {
	config          *config.Config
	logger          *logger.Logger
	secretRepository models.SecretRepository
	teeManager      *tee.Manager
}

// NewService creates a new secrets service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	secretRepository models.SecretRepository,
	teeManager *tee.Manager,
) *Service {
	return &Service{
		config:          cfg,
		logger:          log,
		secretRepository: secretRepository,
		teeManager:      teeManager,
	}
}

// CreateSecret creates a new secret
func (s *Service) CreateSecret(ctx context.Context, userID int, name, value string) (*models.SecretMetadata, error) {
	// Validate input
	if err := s.validateSecret(name, value); err != nil {
		return nil, err
	}

	// Check if secret already exists
	existingSecret, err := s.secretRepository.GetByUserIDAndName(userID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing secret: %w", err)
	}
	if existingSecret != nil {
		return nil, errors.New("secret with this name already exists")
	}

	// Count existing secrets
	secrets, err := s.secretRepository.List(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to count existing secrets: %w", err)
	}
	if len(secrets) >= s.config.Services.Secrets.MaxSecretsPerUser {
		return nil, fmt.Errorf("maximum of %d secrets reached", s.config.Services.Secrets.MaxSecretsPerUser)
	}

	// Create secret
	now := time.Now()
	secret := &models.Secret{
		UserID:    userID,
		Name:      name,
		Value:     value,
		Version:   1,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Store in database
	err = s.secretRepository.Create(secret)
	if err != nil {
		return nil, fmt.Errorf("failed to create secret: %w", err)
	}

	// Store in TEE
	err = s.teeManager.StoreSecret(ctx, secret)
	if err != nil {
		// Attempt to delete the secret from the database
		deleteErr := s.secretRepository.Delete(secret.ID)
		if deleteErr != nil {
			s.logger.Errorf("Failed to delete secret from database after TEE storage failure: %v", deleteErr)
		}
		return nil, fmt.Errorf("failed to store secret in TEE: %w", err)
	}

	return secret.ToMetadata(), nil
}

// UpdateSecret updates an existing secret
func (s *Service) UpdateSecret(ctx context.Context, id, userID int, value string) (*models.SecretMetadata, error) {
	// Get existing secret
	secret, err := s.GetSecret(id, userID)
	if err != nil {
		return nil, err
	}
	if secret == nil {
		return nil, errors.New("secret not found")
	}

	// Validate input
	if err := s.validateSecret(secret.Name, value); err != nil {
		return nil, err
	}

	// Update secret
	secret.Value = value
	secret.UpdatedAt = time.Now()

	// Update in database
	err = s.secretRepository.Update(secret)
	if err != nil {
		return nil, fmt.Errorf("failed to update secret: %w", err)
	}

	// Update in TEE
	err = s.teeManager.StoreSecret(ctx, secret)
	if err != nil {
		return nil, fmt.Errorf("failed to update secret in TEE: %w", err)
	}

	return secret.ToMetadata(), nil
}

// DeleteSecret deletes a secret
func (s *Service) DeleteSecret(ctx context.Context, id, userID int) error {
	// Get existing secret
	secret, err := s.GetSecret(id, userID)
	if err != nil {
		return err
	}
	if secret == nil {
		return errors.New("secret not found")
	}

	// Delete from database
	err = s.secretRepository.Delete(id)
	if err != nil {
		return fmt.Errorf("failed to delete secret: %w", err)
	}

	// Delete from TEE
	err = s.teeManager.DeleteSecret(ctx, userID, secret.Name)
	if err != nil {
		s.logger.Errorf("Failed to delete secret from TEE: %v", err)
		// Continue even if TEE deletion fails
	}

	return nil
}

// GetSecret gets a secret by ID
func (s *Service) GetSecret(id, userID int) (*models.Secret, error) {
	// Get secret from database
	secret, err := s.secretRepository.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}
	if secret == nil {
		return nil, nil
	}

	// Check ownership
	if secret.UserID != userID {
		return nil, errors.New("secret not found")
	}

	return secret, nil
}

// GetSecretByName gets a secret by name
func (s *Service) GetSecretByName(userID int, name string) (*models.Secret, error) {
	// Get secret from database
	secret, err := s.secretRepository.GetByUserIDAndName(userID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}
	if secret == nil {
		return nil, nil
	}

	return secret, nil
}

// ListSecrets lists secrets for a user
func (s *Service) ListSecrets(userID int) ([]*models.SecretMetadata, error) {
	// Get secrets from database
	secrets, err := s.secretRepository.List(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets: %w", err)
	}

	// Convert to metadata
	metadataList := make([]*models.SecretMetadata, len(secrets))
	for i, secret := range secrets {
		metadataList[i] = secret.ToMetadata()
	}

	return metadataList, nil
}

// validateSecret validates secret input
func (s *Service) validateSecret(name, value string) error {
	if name == "" {
		return errors.New("secret name is required")
	}

	if value == "" {
		return errors.New("secret value is required")
	}

	if len(value) > s.config.Services.Secrets.MaxSecretSize {
		return fmt.Errorf("secret value exceeds maximum size of %d bytes", s.config.Services.Secrets.MaxSecretSize)
	}

	return nil
}