package tests

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	github.com/R3E-Network/service_layerinternal/config"
	github.com/R3E-Network/service_layerinternal/core/automation"
	github.com/R3E-Network/service_layerinternal/models"
	github.com/R3E-Network/service_layerpkg/logger"
)

// MockTriggerRepository is a mock implementation of the TriggerRepository interface
type MockTriggerRepository struct {
	mock.Mock
}

func (m *MockTriggerRepository) Create(trigger *models.Trigger) error {
	args := m.Called(trigger)
	return args.Error(0)
}

func (m *MockTriggerRepository) GetByID(id int) (*models.Trigger, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Trigger), args.Error(1)
}

func (m *MockTriggerRepository) GetByUserIDAndName(userID int, name string) (*models.Trigger, error) {
	args := m.Called(userID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Trigger), args.Error(1)
}

func (m *MockTriggerRepository) List(userID int, offset, limit int) ([]*models.Trigger, error) {
	args := m.Called(userID, offset, limit)
	return args.Get(0).([]*models.Trigger), args.Error(1)
}

func (m *MockTriggerRepository) ListActiveTriggers() ([]*models.Trigger, error) {
	args := m.Called()
	return args.Get(0).([]*models.Trigger), args.Error(1)
}

func (m *MockTriggerRepository) Update(trigger *models.Trigger) error {
	args := m.Called(trigger)
	return args.Error(0)
}

func (m *MockTriggerRepository) UpdateStatus(id int, status string) error {
	args := m.Called(id, status)
	return args.Error(0)
}

func (m *MockTriggerRepository) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockTriggerRepository) CreateEvent(event *models.TriggerEvent) error {
	args := m.Called(event)
	return args.Error(0)
}

func (m *MockTriggerRepository) GetEventByID(id int) (*models.TriggerEvent, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TriggerEvent), args.Error(1)
}

func (m *MockTriggerRepository) ListEventsByTriggerID(triggerID int, offset, limit int) ([]*models.TriggerEvent, error) {
	args := m.Called(triggerID, offset, limit)
	return args.Get(0).([]*models.TriggerEvent), args.Error(1)
}

// MockFunctionService is a mock implementation of the functions.Service
type MockFunctionService struct {
	mock.Mock
}

func (m *MockFunctionService) ExecuteFunction(ctx context.Context, functionID int, userID int, params map[string]interface{}, async bool) (*models.ExecutionResult, error) {
	args := m.Called(ctx, functionID, userID, params, async)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.ExecutionResult), args.Error(1)
}

// MockBlockchainClient is a mock implementation of the blockchain.Client
type MockBlockchainClient struct {
	mock.Mock
}

// TestCreateTrigger tests the CreateTrigger method
func TestCreateTrigger(t *testing.T) {
	// Create test cron trigger config
	cronConfig := models.CronTriggerConfig{
		Schedule: "0 * * * * *", // Every minute
		Timezone: "UTC",
	}
	cronConfigJSON, _ := json.Marshal(cronConfig)

	// Create test price trigger config
	priceConfig := models.PriceTriggerConfig{
		AssetPair: "NEO/GAS",
		Condition: "above",
		Threshold: 10.5,
		Duration:  60, // 60 seconds
	}
	priceConfigJSON, _ := json.Marshal(priceConfig)

	// Test cases
	testCases := []struct {
		name          string
		userID        int
		functionID    int
		triggerName   string
		description   string
		triggerType   models.TriggerType
		triggerConfig json.RawMessage
		setupMocks    func(*MockTriggerRepository, *MockFunctionService, *MockBlockchainClient)
		expectedError bool
	}{
		{
			name:          "Success-Cron",
			userID:        1,
			functionID:    1,
			triggerName:   "test-cron-trigger",
			description:   "Test cron trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetByUserIDAndName - should return nil for no existing trigger
				repo.On("GetByUserIDAndName", 1, "test-cron-trigger").Return(nil, nil)

				// Setup Create - should succeed
				repo.On("Create", mock.AnythingOfType("*models.Trigger")).Run(func(args mock.Arguments) {
					trigger := args.Get(0).(*models.Trigger)
					trigger.ID = 1 // Simulate ID assignment by database
				}).Return(nil)
			},
			expectedError: false,
		},
		{
			name:          "Success-Price",
			userID:        1,
			functionID:    1,
			triggerName:   "test-price-trigger",
			description:   "Test price trigger",
			triggerType:   models.TriggerTypePrice,
			triggerConfig: priceConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetByUserIDAndName - should return nil for no existing trigger
				repo.On("GetByUserIDAndName", 1, "test-price-trigger").Return(nil, nil)

				// Setup Create - should succeed
				repo.On("Create", mock.AnythingOfType("*models.Trigger")).Run(func(args mock.Arguments) {
					trigger := args.Get(0).(*models.Trigger)
					trigger.ID = 1 // Simulate ID assignment by database
				}).Return(nil)
			},
			expectedError: false,
		},
		{
			name:          "InvalidTriggerConfig",
			userID:        1,
			functionID:    1,
			triggerName:   "test-invalid-trigger",
			description:   "Test invalid trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: json.RawMessage(`{"invalid": "config"}`), // Invalid config
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// No mocks needed as it should fail validation
			},
			expectedError: true,
		},
		{
			name:          "DuplicateTriggerName",
			userID:        1,
			functionID:    1,
			triggerName:   "existing-trigger",
			description:   "Test duplicate trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetByUserIDAndName - should return an existing trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "existing-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByUserIDAndName", 1, "existing-trigger").Return(existingTrigger, nil)
			},
			expectedError: true,
		},
		{
			name:          "RepositoryError",
			userID:        1,
			functionID:    1,
			triggerName:   "test-trigger",
			description:   "Test repository error",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetByUserIDAndName - should return nil for no existing trigger
				repo.On("GetByUserIDAndName", 1, "test-trigger").Return(nil, nil)

				// Setup Create - should fail
				repo.On("Create", mock.AnythingOfType("*models.Trigger")).Return(errors.New("database error"))
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTriggerRepository)
			mockFunctionService := new(MockFunctionService)
			mockBlockchainClient := new(MockBlockchainClient)

			// Create a minimal config for testing
			cfg := &config.Config{
				Features: config.Features{
					Automation: true,
				},
			}

			// Create a logger
			log := logger.NewLogger("test")

			// Setup mocks
			tc.setupMocks(mockRepo, mockFunctionService, mockBlockchainClient)

			// Create automation service with mocks
			service := automation.NewService(cfg, log, mockRepo, mockFunctionService, mockBlockchainClient)

			// Call method
			trigger, err := service.CreateTrigger(
				tc.userID,
				tc.functionID,
				tc.triggerName,
				tc.description,
				tc.triggerType,
				tc.triggerConfig,
			)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, trigger)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, trigger)
				assert.Equal(t, tc.userID, trigger.UserID)
				assert.Equal(t, tc.functionID, trigger.FunctionID)
				assert.Equal(t, tc.triggerName, trigger.Name)
				assert.Equal(t, tc.description, trigger.Description)
				assert.Equal(t, tc.triggerType, trigger.TriggerType)
				assert.Equal(t, tc.triggerConfig, trigger.TriggerConfig)
				assert.Equal(t, "active", trigger.Status)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockFunctionService.AssertExpectations(t)
			mockBlockchainClient.AssertExpectations(t)
		})
	}
}

// TestUpdateTrigger tests the UpdateTrigger method
func TestUpdateTrigger(t *testing.T) {
	// Create test cron trigger config
	cronConfig := models.CronTriggerConfig{
		Schedule: "0 * * * * *", // Every minute
		Timezone: "UTC",
	}
	cronConfigJSON, _ := json.Marshal(cronConfig)

	// Create test price trigger config
	priceConfig := models.PriceTriggerConfig{
		AssetPair: "NEO/GAS",
		Condition: "above",
		Threshold: 15.0, // Updated threshold
		Duration:  60,   // 60 seconds
	}
	priceConfigJSON, _ := json.Marshal(priceConfig)

	// Test cases
	testCases := []struct {
		name          string
		triggerID     int
		userID        int
		functionID    int
		triggerName   string
		description   string
		triggerType   models.TriggerType
		triggerConfig json.RawMessage
		setupMocks    func(*MockTriggerRepository, *MockFunctionService, *MockBlockchainClient)
		expectedError bool
	}{
		{
			name:          "Success",
			triggerID:     1,
			userID:        1,
			functionID:    2, // Updated function ID
			triggerName:   "updated-trigger",
			description:   "Updated trigger description",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1, // Original function ID
					Name:        "test-trigger",
					Description: "Original description",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
					CreatedAt:   time.Now().Add(-24 * time.Hour),
					UpdatedAt:   time.Now().Add(-24 * time.Hour),
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)

				// Setup GetByUserIDAndName for name check - should return nil for no existing trigger with new name
				repo.On("GetByUserIDAndName", 1, "updated-trigger").Return(nil, nil)

				// Setup unscheduleTrigger by simulating a call to repo.UpdateStatus
				repo.On("UpdateStatus", 1, "inactive").Return(nil)

				// Setup Update - should succeed
				repo.On("Update", mock.AnythingOfType("*models.Trigger")).Return(nil)
			},
			expectedError: false,
		},
		{
			name:          "TriggerNotFound",
			triggerID:     999, // Non-existent trigger ID
			userID:        1,
			functionID:    1,
			triggerName:   "test-trigger",
			description:   "Test trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return nil for non-existent trigger
				repo.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
		},
		{
			name:          "NotAuthorized",
			triggerID:     1,
			userID:        2, // Different user ID
			functionID:    1,
			triggerName:   "test-trigger",
			description:   "Test trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a trigger owned by user 1, not user 2
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1, // Owned by user 1
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)
			},
			expectedError: true,
		},
		{
			name:          "InvalidTriggerConfig",
			triggerID:     1,
			userID:        1,
			functionID:    1,
			triggerName:   "test-trigger",
			description:   "Test trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: json.RawMessage(`{"invalid": "config"}`), // Invalid config
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)

				// No need to setup more mocks as it should fail validation
			},
			expectedError: true,
		},
		{
			name:          "DuplicateTriggerName",
			triggerID:     1,
			userID:        1,
			functionID:    1,
			triggerName:   "existing-trigger", // Different name that already exists
			description:   "Test trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "test-trigger", // Original name
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)

				// Setup GetByUserIDAndName for the new name check - should find an existing trigger
				anotherTrigger := &models.Trigger{
					ID:     2, // Different ID
					UserID: 1,
					Name:   "existing-trigger",
				}
				repo.On("GetByUserIDAndName", 1, "existing-trigger").Return(anotherTrigger, nil)
			},
			expectedError: true,
		},
		{
			name:          "RepositoryUpdateError",
			triggerID:     1,
			userID:        1,
			functionID:    1,
			triggerName:   "test-trigger",
			description:   "Test trigger",
			triggerType:   models.TriggerTypeCron,
			triggerConfig: cronConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)

				// Setup unscheduleTrigger by simulating a call to repo.UpdateStatus
				repo.On("UpdateStatus", 1, "inactive").Return(nil)

				// Setup Update - should fail
				repo.On("Update", mock.AnythingOfType("*models.Trigger")).Return(errors.New("database error"))
			},
			expectedError: true,
		},
		{
			name:          "SuccessPriceUpdate",
			triggerID:     2,
			userID:        1,
			functionID:    2,
			triggerName:   "updated-price-trigger",
			description:   "Updated price trigger description",
			triggerType:   models.TriggerTypePrice,
			triggerConfig: priceConfigJSON,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          2,
					UserID:      1,
					FunctionID:  1,
					Name:        "price-trigger",
					Description: "Original price trigger",
					TriggerType: models.TriggerTypePrice,
					Status:      "active",
					CreatedAt:   time.Now().Add(-24 * time.Hour),
					UpdatedAt:   time.Now().Add(-24 * time.Hour),
				}
				repo.On("GetByID", 2).Return(existingTrigger, nil)

				// Setup GetByUserIDAndName for name check - should return nil for no existing trigger with new name
				repo.On("GetByUserIDAndName", 1, "updated-price-trigger").Return(nil, nil)

				// Setup unscheduleTrigger by simulating a call to repo.UpdateStatus
				repo.On("UpdateStatus", 2, "inactive").Return(nil)

				// Setup Update - should succeed
				repo.On("Update", mock.AnythingOfType("*models.Trigger")).Return(nil)
			},
			expectedError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTriggerRepository)
			mockFunctionService := new(MockFunctionService)
			mockBlockchainClient := new(MockBlockchainClient)

			// Create a minimal config for testing
			cfg := &config.Config{
				Features: config.Features{
					Automation: true,
				},
			}

			// Create a logger
			log := logger.NewLogger("test")

			// Setup mocks
			tc.setupMocks(mockRepo, mockFunctionService, mockBlockchainClient)

			// Create automation service with mocks
			service := automation.NewService(cfg, log, mockRepo, mockFunctionService, mockBlockchainClient)

			// Call method
			trigger, err := service.UpdateTrigger(
				tc.triggerID,
				tc.userID,
				tc.functionID,
				tc.triggerName,
				tc.description,
				tc.triggerType,
				tc.triggerConfig,
			)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, trigger)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, trigger)
				assert.Equal(t, tc.triggerID, trigger.ID)
				assert.Equal(t, tc.userID, trigger.UserID)
				assert.Equal(t, tc.functionID, trigger.FunctionID)
				assert.Equal(t, tc.triggerName, trigger.Name)
				assert.Equal(t, tc.description, trigger.Description)
				assert.Equal(t, tc.triggerType, trigger.TriggerType)
				assert.Equal(t, tc.triggerConfig, trigger.TriggerConfig)
				assert.Equal(t, "active", trigger.Status)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockFunctionService.AssertExpectations(t)
			mockBlockchainClient.AssertExpectations(t)
		})
	}
}

// TestDeleteTrigger tests the DeleteTrigger method
func TestDeleteTrigger(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		triggerID     int
		userID        int
		setupMocks    func(*MockTriggerRepository, *MockFunctionService, *MockBlockchainClient)
		expectedError bool
	}{
		{
			name:      "Success",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)

				// Setup unscheduleTrigger by simulating a call to repo.UpdateStatus
				repo.On("UpdateStatus", 1, "inactive").Return(nil)

				// Setup Delete - should succeed
				repo.On("Delete", 1).Return(nil)
			},
			expectedError: false,
		},
		{
			name:      "TriggerNotFound",
			triggerID: 999, // Non-existent trigger ID
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return nil for non-existent trigger
				repo.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
		},
		{
			name:      "NotAuthorized",
			triggerID: 1,
			userID:    2, // Different user ID
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a trigger owned by user 1, not user 2
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1, // Owned by user 1
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)
			},
			expectedError: true,
		},
		{
			name:      "DatabaseError",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)

				// Setup unscheduleTrigger by simulating a call to repo.UpdateStatus
				repo.On("UpdateStatus", 1, "inactive").Return(nil)

				// Setup Delete - should fail
				repo.On("Delete", 1).Return(errors.New("database error"))
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTriggerRepository)
			mockFunctionService := new(MockFunctionService)
			mockBlockchainClient := new(MockBlockchainClient)

			// Create a minimal config for testing
			cfg := &config.Config{
				Features: config.Features{
					Automation: true,
				},
			}

			// Create a logger
			log := logger.NewLogger("test")

			// Setup mocks
			tc.setupMocks(mockRepo, mockFunctionService, mockBlockchainClient)

			// Create automation service with mocks
			service := automation.NewService(cfg, log, mockRepo, mockFunctionService, mockBlockchainClient)

			// Call method
			err := service.DeleteTrigger(tc.triggerID, tc.userID)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockFunctionService.AssertExpectations(t)
			mockBlockchainClient.AssertExpectations(t)
		})
	}
}

// TestGetTrigger tests the GetTrigger method
func TestGetTrigger(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		triggerID     int
		userID        int
		setupMocks    func(*MockTriggerRepository, *MockFunctionService, *MockBlockchainClient)
		expectedError bool
	}{
		{
			name:      "Success",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)
			},
			expectedError: false,
		},
		{
			name:      "TriggerNotFound",
			triggerID: 999, // Non-existent trigger ID
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return nil for non-existent trigger
				repo.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
		},
		{
			name:      "NotAuthorized",
			triggerID: 1,
			userID:    2, // Different user ID
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a trigger owned by user 1, not user 2
				existingTrigger := &models.Trigger{
					ID:          1,
					UserID:      1, // Owned by user 1
					FunctionID:  1,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(existingTrigger, nil)
			},
			expectedError: true,
		},
		{
			name:      "DatabaseError",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return an error
				repo.On("GetByID", 1).Return(nil, errors.New("database error"))
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTriggerRepository)
			mockFunctionService := new(MockFunctionService)
			mockBlockchainClient := new(MockBlockchainClient)

			// Create a minimal config for testing
			cfg := &config.Config{
				Features: config.Features{
					Automation: true,
				},
			}

			// Create a logger
			log := logger.NewLogger("test")

			// Setup mocks
			tc.setupMocks(mockRepo, mockFunctionService, mockBlockchainClient)

			// Create automation service with mocks
			service := automation.NewService(cfg, log, mockRepo, mockFunctionService, mockBlockchainClient)

			// Call method
			trigger, err := service.GetTrigger(tc.triggerID, tc.userID)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, trigger)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, trigger)
				assert.Equal(t, tc.triggerID, trigger.ID)
				assert.Equal(t, tc.userID, trigger.UserID)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockFunctionService.AssertExpectations(t)
			mockBlockchainClient.AssertExpectations(t)
		})
	}
}

// TestListTriggers tests the ListTriggers method
func TestListTriggers(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		userID        int
		page          int
		limit         int
		setupMocks    func(*MockTriggerRepository, int, int, int)
		expectedError bool
		expectedCount int
	}{
		{
			name:   "Success",
			userID: 1,
			page:   1,
			limit:  10,
			setupMocks: func(repo *MockTriggerRepository, userID, offset, limit int) {
				// Setup List - should return a list of triggers
				triggers := []*models.Trigger{
					{
						ID:          1,
						UserID:      userID,
						Name:        "trigger-1",
						TriggerType: models.TriggerTypeCron,
						Status:      "active",
					},
					{
						ID:          2,
						UserID:      userID,
						Name:        "trigger-2",
						TriggerType: models.TriggerTypePrice,
						Status:      "active",
					},
				}
				repo.On("List", userID, offset, limit).Return(triggers, nil)
			},
			expectedError: false,
			expectedCount: 2,
		},
		{
			name:   "EmptyList",
			userID: 1,
			page:   1,
			limit:  10,
			setupMocks: func(repo *MockTriggerRepository, userID, offset, limit int) {
				// Setup List - should return an empty list
				triggers := []*models.Trigger{}
				repo.On("List", userID, offset, limit).Return(triggers, nil)
			},
			expectedError: false,
			expectedCount: 0,
		},
		{
			name:   "DatabaseError",
			userID: 1,
			page:   1,
			limit:  10,
			setupMocks: func(repo *MockTriggerRepository, userID, offset, limit int) {
				// Setup List - should return an error
				repo.On("List", userID, offset, limit).Return([]*models.Trigger{}, errors.New("database error"))
			},
			expectedError: true,
			expectedCount: 0,
		},
		{
			name:   "Pagination",
			userID: 1,
			page:   2, // Second page
			limit:  5, // 5 items per page
			setupMocks: func(repo *MockTriggerRepository, userID, offset, limit int) {
				// Setup List - should return a list of triggers with offset 5
				triggers := []*models.Trigger{
					{
						ID:          6,
						UserID:      userID,
						Name:        "trigger-6",
						TriggerType: models.TriggerTypeCron,
						Status:      "active",
					},
					{
						ID:          7,
						UserID:      userID,
						Name:        "trigger-7",
						TriggerType: models.TriggerTypePrice,
						Status:      "active",
					},
				}
				repo.On("List", userID, offset, limit).Return(triggers, nil)
			},
			expectedError: false,
			expectedCount: 2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTriggerRepository)
			mockFunctionService := new(MockFunctionService)
			mockBlockchainClient := new(MockBlockchainClient)

			// Create a minimal config for testing
			cfg := &config.Config{
				Features: config.Features{
					Automation: true,
				},
			}

			// Create a logger
			log := logger.NewLogger("test")

			// Calculate offset
			offset := (tc.page - 1) * tc.limit

			// Setup mocks
			tc.setupMocks(mockRepo, tc.userID, offset, tc.limit)

			// Create automation service with mocks
			service := automation.NewService(cfg, log, mockRepo, mockFunctionService, mockBlockchainClient)

			// Call method
			triggers, err := service.ListTriggers(tc.userID, tc.page, tc.limit)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, triggers)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedCount, len(triggers))

				// If list is not empty, check that all triggers belong to the user
				if len(triggers) > 0 {
					for _, trigger := range triggers {
						assert.Equal(t, tc.userID, trigger.UserID)
					}
				}
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockFunctionService.AssertExpectations(t)
			mockBlockchainClient.AssertExpectations(t)
		})
	}
}

// TestExecuteTrigger tests the ExecuteTrigger method
func TestExecuteTrigger(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		triggerID     int
		userID        int
		setupMocks    func(*MockTriggerRepository, *MockFunctionService, *MockBlockchainClient)
		expectedError bool
	}{
		{
			name:      "Success",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				trigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  2,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(trigger, nil)

				// Setup CreateEvent
				repo.On("CreateEvent", mock.AnythingOfType("*models.TriggerEvent")).Run(func(args mock.Arguments) {
					event := args.Get(0).(*models.TriggerEvent)
					event.ID = 1 // Simulate ID assignment by database
				}).Return(nil)

				// Setup ExecuteFunction
				executionResult := &models.ExecutionResult{
					ExecutionID: "1",
					FunctionID:  2,
					Status:      "success",
					StartTime:   time.Now(),
					EndTime:     time.Now(),
					Result:      json.RawMessage(`{"status":"success"}`),
				}
				fs.On("ExecuteFunction", mock.Anything, 2, 1, mock.AnythingOfType("map[string]interface {}"), false).Return(executionResult, nil)

				// Setup UpdateEvent
				repo.On("CreateEvent", mock.AnythingOfType("*models.TriggerEvent")).Return(nil)
			},
			expectedError: false,
		},
		{
			name:      "TriggerNotFound",
			triggerID: 999, // Non-existent trigger ID
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return nil for non-existent trigger
				repo.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
		},
		{
			name:      "NotAuthorized",
			triggerID: 1,
			userID:    2, // Different user ID
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a trigger owned by user 1, not user 2
				trigger := &models.Trigger{
					ID:          1,
					UserID:      1, // Owned by user 1
					FunctionID:  2,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(trigger, nil)
			},
			expectedError: true,
		},
		{
			name:      "EventCreationError",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				trigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  2,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(trigger, nil)

				// Setup CreateEvent - should fail
				repo.On("CreateEvent", mock.AnythingOfType("*models.TriggerEvent")).Return(errors.New("database error"))
			},
			expectedError: true,
		},
		{
			name:      "FunctionExecutionError",
			triggerID: 1,
			userID:    1,
			setupMocks: func(repo *MockTriggerRepository, fs *MockFunctionService, bc *MockBlockchainClient) {
				// Setup GetTrigger - should return a valid trigger
				trigger := &models.Trigger{
					ID:          1,
					UserID:      1,
					FunctionID:  2,
					Name:        "test-trigger",
					TriggerType: models.TriggerTypeCron,
					Status:      "active",
				}
				repo.On("GetByID", 1).Return(trigger, nil)

				// Setup CreateEvent
				repo.On("CreateEvent", mock.AnythingOfType("*models.TriggerEvent")).Run(func(args mock.Arguments) {
					event := args.Get(0).(*models.TriggerEvent)
					event.ID = 1 // Simulate ID assignment by database
				}).Return(nil)

				// Setup ExecuteFunction - should fail
				fs.On("ExecuteFunction", mock.Anything, 2, 1, mock.AnythingOfType("map[string]interface {}"), false).Return(nil, errors.New("execution error"))

				// Setup UpdateEvent - for error status
				repo.On("CreateEvent", mock.AnythingOfType("*models.TriggerEvent")).Return(nil)
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockTriggerRepository)
			mockFunctionService := new(MockFunctionService)
			mockBlockchainClient := new(MockBlockchainClient)

			// Create a minimal config for testing
			cfg := &config.Config{
				Features: config.Features{
					Automation: true,
				},
			}

			// Create a logger
			log := logger.NewLogger("test")

			// Setup mocks
			tc.setupMocks(mockRepo, mockFunctionService, mockBlockchainClient)

			// Create automation service with mocks
			service := automation.NewService(cfg, log, mockRepo, mockFunctionService, mockBlockchainClient)

			// Call method
			event, err := service.ExecuteTrigger(context.Background(), tc.triggerID, tc.userID)

			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, event)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, event)
				assert.Equal(t, tc.triggerID, event.TriggerID)
				assert.Equal(t, "success", event.Status)
			}

			// Verify mock expectations
			mockRepo.AssertExpectations(t)
			mockFunctionService.AssertExpectations(t)
			mockBlockchainClient.AssertExpectations(t)
		})
	}
}
