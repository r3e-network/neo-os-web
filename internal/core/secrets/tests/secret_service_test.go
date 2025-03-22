package tests

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"service_layer/internal/config"
	"service_layer/internal/core/secrets"
	"service_layer/internal/models"
	"service_layer/internal/tee"
	"service_layer/pkg/logger"
)

// MockSecretRepository is a mock implementation of the SecretRepository interface
type MockSecretRepository struct {
	mock.Mock
}

func (m *MockSecretRepository) Create(secret *models.Secret) error {
	args := m.Called(secret)
	return args.Error(0)
}

func (m *MockSecretRepository) GetByID(id int) (*models.Secret, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Secret), args.Error(1)
}

func (m *MockSecretRepository) GetByUserIDAndName(userID int, name string) (*models.Secret, error) {
	args := m.Called(userID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Secret), args.Error(1)
}

func (m *MockSecretRepository) List(userID int) ([]*models.Secret, error) {
	args := m.Called(userID)
	return args.Get(0).([]*models.Secret), args.Error(1)
}

func (m *MockSecretRepository) Update(secret *models.Secret) error {
	args := m.Called(secret)
	return args.Error(0)
}

func (m *MockSecretRepository) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

// MockTEEManager is a mock implementation of the TEE Manager for secrets operations
type MockTEEManager struct {
	mock.Mock
}

func (m *MockTEEManager) StoreSecret(ctx context.Context, secret *models.Secret) error {
	args := m.Called(ctx, secret)
	return args.Error(0)
}

func (m *MockTEEManager) DeleteSecret(ctx context.Context, userID int, name string) error {
	args := m.Called(ctx, userID, name)
	return args.Error(0)
}

// TestCreateSecret tests the CreateSecret method
func TestCreateSecret(t *testing.T) {
	// Test cases
	testCases := []struct {
		name           string
		userID         int
		secretName     string
		secretValue    string
		setupMocks     func(*MockSecretRepository, *MockTEEManager)
		expectedError  bool
		expectedSecret *models.SecretMetadata
	}{
		{
			name:        "Success",
			userID:      1,
			secretName:  "API_KEY",
			secretValue: "secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByUserIDAndName - should return nil for no existing secret
				repo.On("GetByUserIDAndName", 1, "API_KEY").Return(nil, nil)
				
				// Setup List - should return empty list to check secret count
				repo.On("List", 1).Return([]*models.Secret{}, nil)
				
				// Setup Create - should succeed
				repo.On("Create", mock.AnythingOfType("*models.Secret")).Run(func(args mock.Arguments) {
					secret := args.Get(0).(*models.Secret)
					secret.ID = 1 // Simulate ID assignment by database
				}).Return(nil)
				
				// Setup StoreSecret - should succeed
				teeManager.On("StoreSecret", mock.Anything, mock.AnythingOfType("*models.Secret")).Return(nil)
			},
			expectedError: false,
			expectedSecret: &models.SecretMetadata{
				ID:      1,
				UserID:  1,
				Name:    "API_KEY",
				Version: 1,
			},
		},
		{
			name:        "EmptyName",
			userID:      1,
			secretName:  "", // Empty name should fail validation
			secretValue: "secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// No mocks needed as it should fail validation
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "EmptyValue",
			userID:      1,
			secretName:  "API_KEY",
			secretValue: "", // Empty value should fail validation
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// No mocks needed as it should fail validation
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "DuplicateSecretName",
			userID:      1,
			secretName:  "EXISTING_KEY",
			secretValue: "secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByUserIDAndName - should return an existing secret
				existingSecret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "EXISTING_KEY",
					Value:   "existing-value",
					Version: 1,
				}
				repo.On("GetByUserIDAndName", 1, "EXISTING_KEY").Return(existingSecret, nil)
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "MaxSecretsReached",
			userID:      1,
			secretName:  "API_KEY",
			secretValue: "secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByUserIDAndName - should return nil for no existing secret
				repo.On("GetByUserIDAndName", 1, "API_KEY").Return(nil, nil)
				
				// Setup List - should return many secrets to trigger max secrets limit
				secrets := make([]*models.Secret, 10) // 10 existing secrets
				for i := 0; i < 10; i++ {
					secrets[i] = &models.Secret{
						ID:      i + 1,
						UserID:  1,
						Name:    fmt.Sprintf("SECRET_%d", i+1),
						Version: 1,
					}
				}
				repo.On("List", 1).Return(secrets, nil)
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "DatabaseCreateError",
			userID:      1,
			secretName:  "API_KEY",
			secretValue: "secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByUserIDAndName - should return nil for no existing secret
				repo.On("GetByUserIDAndName", 1, "API_KEY").Return(nil, nil)
				
				// Setup List - should return empty list to check secret count
				repo.On("List", 1).Return([]*models.Secret{}, nil)
				
				// Setup Create - should fail
				repo.On("Create", mock.AnythingOfType("*models.Secret")).Return(errors.New("database error"))
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "TEEStoreError",
			userID:      1,
			secretName:  "API_KEY",
			secretValue: "secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByUserIDAndName - should return nil for no existing secret
				repo.On("GetByUserIDAndName", 1, "API_KEY").Return(nil, nil)
				
				// Setup List - should return empty list to check secret count
				repo.On("List", 1).Return([]*models.Secret{}, nil)
				
				// Setup Create - should succeed
				repo.On("Create", mock.AnythingOfType("*models.Secret")).Run(func(args mock.Arguments) {
					secret := args.Get(0).(*models.Secret)
					secret.ID = 1 // Simulate ID assignment by database
				}).Return(nil)
				
				// Setup StoreSecret - should fail
				teeManager.On("StoreSecret", mock.Anything, mock.AnythingOfType("*models.Secret")).Return(errors.New("TEE storage error"))
				
				// Setup Delete - should be called to clean up database entry after TEE failure
				repo.On("Delete", 1).Return(nil)
			},
			expectedError:  true,
			expectedSecret: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockSecretRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Secrets: config.SecretsConfig{
						MaxSecretSize:     1000, // 1KB
						MaxSecretsPerUser: 10,   // 10 secrets per user
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockRepo, mockTEEManager)
			
			// Create secrets service with mocks
			service := secrets.NewService(cfg, log, mockRepo, mockTEEManager)
			
			// Call method
			secret, err := service.CreateSecret(context.Background(), tc.userID, tc.secretName, tc.secretValue)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, secret)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, secret)
				assert.Equal(t, tc.expectedSecret.ID, secret.ID)
				assert.Equal(t, tc.expectedSecret.UserID, secret.UserID)
				assert.Equal(t, tc.expectedSecret.Name, secret.Name)
				assert.Equal(t, tc.expectedSecret.Version, secret.Version)
			}
			
			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockTEEManager.AssertExpectations(t)
		})
	}
}

// TestUpdateSecret tests the UpdateSecret method
func TestUpdateSecret(t *testing.T) {
	// Test cases
	testCases := []struct {
		name           string
		secretID       int
		userID         int
		secretValue    string
		setupMocks     func(*MockSecretRepository, *MockTEEManager)
		expectedError  bool
		expectedSecret *models.SecretMetadata
	}{
		{
			name:        "Success",
			secretID:    1,
			userID:      1,
			secretValue: "new-secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:        1,
					UserID:    1,
					Name:      "API_KEY",
					Value:     "old-secret-value",
					Version:   1,
					CreatedAt: time.Now().Add(-24 * time.Hour),
					UpdatedAt: time.Now().Add(-24 * time.Hour),
				}
				repo.On("GetByID", 1).Return(secret, nil)
				
				// Setup Update - should succeed
				repo.On("Update", mock.AnythingOfType("*models.Secret")).Run(func(args mock.Arguments) {
					secret := args.Get(0).(*models.Secret)
					secret.Version = 2 // Simulate version increment by database
				}).Return(nil)
				
				// Setup StoreSecret - should succeed
				teeManager.On("StoreSecret", mock.Anything, mock.AnythingOfType("*models.Secret")).Return(nil)
			},
			expectedError: false,
			expectedSecret: &models.SecretMetadata{
				ID:      1,
				UserID:  1,
				Name:    "API_KEY",
				Version: 2,
			},
		},
		{
			name:        "SecretNotFound",
			secretID:    999,
			userID:      1,
			secretValue: "new-secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return nil for non-existent secret
				repo.On("GetByID", 999).Return(nil, nil)
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "NotAuthorized",
			secretID:    1,
			userID:      2, // Different user ID
			secretValue: "new-secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a secret owned by user 1, not user 2
				secret := &models.Secret{
					ID:      1,
					UserID:  1, // Owned by user 1
					Name:    "API_KEY",
					Value:   "old-secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "EmptyValue",
			secretID:    1,
			userID:      1,
			secretValue: "", // Empty value should fail validation
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "API_KEY",
					Value:   "old-secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "DatabaseUpdateError",
			secretID:    1,
			userID:      1,
			secretValue: "new-secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "API_KEY",
					Value:   "old-secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
				
				// Setup Update - should fail
				repo.On("Update", mock.AnythingOfType("*models.Secret")).Return(errors.New("database error"))
			},
			expectedError:  true,
			expectedSecret: nil,
		},
		{
			name:        "TEEStoreError",
			secretID:    1,
			userID:      1,
			secretValue: "new-secret-value-123",
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "API_KEY",
					Value:   "old-secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
				
				// Setup Update - should succeed
				repo.On("Update", mock.AnythingOfType("*models.Secret")).Run(func(args mock.Arguments) {
					secret := args.Get(0).(*models.Secret)
					secret.Version = 2 // Simulate version increment by database
				}).Return(nil)
				
				// Setup StoreSecret - should fail
				teeManager.On("StoreSecret", mock.Anything, mock.AnythingOfType("*models.Secret")).Return(errors.New("TEE storage error"))
			},
			expectedError:  true,
			expectedSecret: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockSecretRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Secrets: config.SecretsConfig{
						MaxSecretSize:     1000, // 1KB
						MaxSecretsPerUser: 10,   // 10 secrets per user
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockRepo, mockTEEManager)
			
			// Create secrets service with mocks
			service := secrets.NewService(cfg, log, mockRepo, mockTEEManager)
			
			// Call method
			secret, err := service.UpdateSecret(context.Background(), tc.secretID, tc.userID, tc.secretValue)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, secret)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, secret)
				assert.Equal(t, tc.expectedSecret.ID, secret.ID)
				assert.Equal(t, tc.expectedSecret.UserID, secret.UserID)
				assert.Equal(t, tc.expectedSecret.Name, secret.Name)
				assert.Equal(t, tc.expectedSecret.Version, secret.Version)
			}
			
			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockTEEManager.AssertExpectations(t)
		})
	}
}

// TestDeleteSecret tests the DeleteSecret method
func TestDeleteSecret(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		secretID      int
		userID        int
		setupMocks    func(*MockSecretRepository, *MockTEEManager)
		expectedError bool
	}{
		{
			name:     "Success",
			secretID: 1,
			userID:   1,
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "API_KEY",
					Value:   "secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
				
				// Setup Delete - should succeed
				repo.On("Delete", 1).Return(nil)
				
				// Setup DeleteSecret - should succeed (but even if it fails, the operation continues)
				teeManager.On("DeleteSecret", mock.Anything, 1, "API_KEY").Return(nil)
			},
			expectedError: false,
		},
		{
			name:     "SecretNotFound",
			secretID: 999,
			userID:   1,
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return nil for non-existent secret
				repo.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
		},
		{
			name:     "NotAuthorized",
			secretID: 1,
			userID:   2, // Different user ID
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a secret owned by user 1, not user 2
				secret := &models.Secret{
					ID:      1,
					UserID:  1, // Owned by user 1
					Name:    "API_KEY",
					Value:   "secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
			},
			expectedError: true,
		},
		{
			name:     "DatabaseDeleteError",
			secretID: 1,
			userID:   1,
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "API_KEY",
					Value:   "secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
				
				// Setup Delete - should fail
				repo.On("Delete", 1).Return(errors.New("database error"))
			},
			expectedError: true,
		},
		{
			name:     "TEEDeleteErrorButContinue",
			secretID: 1,
			userID:   1,
			setupMocks: func(repo *MockSecretRepository, teeManager *MockTEEManager) {
				// Setup GetByID - should return a valid secret
				secret := &models.Secret{
					ID:      1,
					UserID:  1,
					Name:    "API_KEY",
					Value:   "secret-value",
					Version: 1,
				}
				repo.On("GetByID", 1).Return(secret, nil)
				
				// Setup Delete - should succeed
				repo.On("Delete", 1).Return(nil)
				
				// Setup DeleteSecret - should fail but operation continues
				teeManager.On("DeleteSecret", mock.Anything, 1, "API_KEY").Return(errors.New("TEE deletion error"))
			},
			expectedError: false, // Still success because TEE errors are logged but don't fail the operation
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockSecretRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Secrets: config.SecretsConfig{
						MaxSecretSize:     1000, // 1KB
						MaxSecretsPerUser: 10,   // 10 secrets per user
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockRepo, mockTEEManager)
			
			// Create secrets service with mocks
			service := secrets.NewService(cfg, log, mockRepo, mockTEEManager)
			
			// Call method
			err := service.DeleteSecret(context.Background(), tc.secretID, tc.userID)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			
			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockTEEManager.AssertExpectations(t)
		})
	}
}

// TestListSecrets tests the ListSecrets method
func TestListSecrets(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		userID        int
		setupMocks    func(*MockSecretRepository)
		expectedError bool
		expectedCount int
	}{
		{
			name:   "Success",
			userID: 1,
			setupMocks: func(repo *MockSecretRepository) {
				// Setup List - should return a list of secrets
				secrets := []*models.Secret{
					{
						ID:      1,
						UserID:  1,
						Name:    "API_KEY",
						Value:   "api-key-value",
						Version: 1,
					},
					{
						ID:      2,
						UserID:  1,
						Name:    "DATABASE_URL",
						Value:   "db-url-value",
						Version: 1,
					},
				}
				repo.On("List", 1).Return(secrets, nil)
			},
			expectedError: false,
			expectedCount: 2,
		},
		{
			name:   "EmptyList",
			userID: 1,
			setupMocks: func(repo *MockSecretRepository) {
				// Setup List - should return an empty list
				repo.On("List", 1).Return([]*models.Secret{}, nil)
			},
			expectedError: false,
			expectedCount: 0,
		},
		{
			name:   "DatabaseError",
			userID: 1,
			setupMocks: func(repo *MockSecretRepository) {
				// Setup List - should return an error
				repo.On("List", 1).Return([]*models.Secret{}, errors.New("database error"))
			},
			expectedError: true,
			expectedCount: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockSecretRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Secrets: config.SecretsConfig{
						MaxSecretSize:     1000, // 1KB
						MaxSecretsPerUser: 10,   // 10 secrets per user
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockRepo)
			
			// Create secrets service with mocks
			service := secrets.NewService(cfg, log, mockRepo, mockTEEManager)
			
			// Call method
			secrets, err := service.ListSecrets(tc.userID)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, secrets)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedCount, len(secrets))
				// Verify that no Values are included (security check)
				for _, secret := range secrets {
					assert.NotContains(t, secret, "Value")
				}
			}
			
			// Verify mock expectations
			mockRepo.AssertExpectations(t)
		})
	}
} 