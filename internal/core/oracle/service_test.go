package oracle

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock OracleRepository
type MockOracleRepository struct {
	mock.Mock
}

func (m *MockOracleRepository) CreateOracle(oracle *models.Oracle) (*models.Oracle, error) {
	args := m.Called(oracle)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockOracleRepository) UpdateOracle(oracle *models.Oracle) (*models.Oracle, error) {
	args := m.Called(oracle)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockOracleRepository) GetOracleByID(id int) (*models.Oracle, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockOracleRepository) GetOracleByName(name string) (*models.Oracle, error) {
	args := m.Called(name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockOracleRepository) ListOracles(userID int, offset, limit int) ([]*models.Oracle, error) {
	args := m.Called(userID, offset, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Oracle), args.Error(1)
}

func (m *MockOracleRepository) DeleteOracle(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockOracleRepository) CreateOracleRequest(request *models.OracleRequest) (*models.OracleRequest, error) {
	args := m.Called(request)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleRequest), args.Error(1)
}

func (m *MockOracleRepository) UpdateOracleRequest(request *models.OracleRequest) (*models.OracleRequest, error) {
	args := m.Called(request)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleRequest), args.Error(1)
}

func (m *MockOracleRepository) GetOracleRequestByID(id int) (*models.OracleRequest, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleRequest), args.Error(1)
}

func (m *MockOracleRepository) ListOracleRequests(oracleID int, offset, limit int) ([]*models.OracleRequest, error) {
	args := m.Called(oracleID, offset, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.OracleRequest), args.Error(1)
}

func (m *MockOracleRepository) ListPendingOracleRequests() ([]*models.OracleRequest, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.OracleRequest), args.Error(1)
}

func (m *MockOracleRepository) GetOracleStatistics() (map[string]interface{}, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

// Mock GasBankService
type MockGasBankService struct {
	mock.Mock
}

func (m *MockGasBankService) AllocateGas(userID int, operation string, estimatedGas int64) (int64, error) {
	args := m.Called(userID, operation, estimatedGas)
	return args.Get(0).(int64), args.Error(1)
}

// Mock BlockchainClient
type MockBlockchainClient struct {
	mock.Mock
}

func (m *MockBlockchainClient) GetBlockHeight() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

// Mock TEEManager
type MockTEEManager struct {
	mock.Mock
}

// Helper function to setup test service
func setupTestService() (*Service, *MockOracleRepository, *MockBlockchainClient, *MockGasBankService, *MockTEEManager) {
	cfg := &config.Config{
		Services: config.ServicesConfig{
			Oracle: config.OracleConfig{
				RequestTimeout: 30,
				NumWorkers:     1,
			},
		},
	}
	log := logger.NewNopLogger()
	mockRepo := new(MockOracleRepository)
	mockBlockchainClient := new(MockBlockchainClient)
	mockGasBankService := new(MockGasBankService)
	mockTEEManager := new(MockTEEManager)

	service := NewService(cfg, log, mockRepo, mockBlockchainClient, mockGasBankService, mockTEEManager)

	return service, mockRepo, mockBlockchainClient, mockGasBankService, mockTEEManager
}

// TestCreateOracle tests oracle creation
func TestCreateOracle(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByName", "test_oracle").Return(nil, errors.New("not found")).Once()

		headers := models.JsonMap{"Content-Type": "application/json"}
		authParams := models.JsonMap{"api_key": "12345"}

		expectedOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     headers,
			Body:        "",
			AuthType:    models.OracleAuthTypeAPIKey,
			AuthParams:  authParams,
			Path:        "$.data.price",
			Transform:   "",
			Schedule:    "0 */1 * * *",
			Active:      true,
			UserID:      2,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockRepo.On("CreateOracle", mock.AnythingOfType("*models.Oracle")).Return(expectedOracle, nil).Once()

		// Call service
		oracle, err := service.CreateOracle(
			ctx,
			"test_oracle",
			"Test oracle",
			models.OracleDataSourceTypeREST,
			"https://api.example.com/data",
			"GET",
			headers,
			"",
			models.OracleAuthTypeAPIKey,
			authParams,
			"$.data.price",
			"",
			"0 */1 * * *",
			2,
		)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedOracle, oracle)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NameAlreadyExists", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByName", "test_oracle").Return(existingOracle, nil).Once()

		// Call service
		oracle, err := service.CreateOracle(
			ctx,
			"test_oracle",
			"Test oracle",
			models.OracleDataSourceTypeREST,
			"https://api.example.com/data",
			"GET",
			models.JsonMap{},
			"",
			models.OracleAuthTypeNone,
			models.JsonMap{},
			"",
			"",
			"",
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "already exists")
		mockRepo.AssertExpectations(t)
	})

	t.Run("ValidationError", func(t *testing.T) {
		// Call service with missing name
		oracle, err := service.CreateOracle(
			ctx,
			"",
			"Test oracle",
			models.OracleDataSourceTypeREST,
			"https://api.example.com/data",
			"GET",
			models.JsonMap{},
			"",
			models.OracleAuthTypeNone,
			models.JsonMap{},
			"",
			"",
			"",
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "name is required")

		// No repository calls should be made
		mockRepo.AssertNotCalled(t, "GetOracleByName")
		mockRepo.AssertNotCalled(t, "CreateOracle")
	})

	t.Run("MissingURL", func(t *testing.T) {
		// Call service with missing URL
		oracle, err := service.CreateOracle(
			ctx,
			"test_oracle",
			"Test oracle",
			models.OracleDataSourceTypeREST,
			"",
			"GET",
			models.JsonMap{},
			"",
			models.OracleAuthTypeNone,
			models.JsonMap{},
			"",
			"",
			"",
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "URL is required")

		// No repository calls should be made
		mockRepo.AssertNotCalled(t, "GetOracleByName")
		mockRepo.AssertNotCalled(t, "CreateOracle")
	})

	t.Run("DefaultValues", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByName", "test_oracle").Return(nil, errors.New("not found")).Once()

		expectedOracle := &models.Oracle{
			ID:          2,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST, // Default
			URL:         "https://api.example.com/data",
			Method:      "GET", // Default
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone, // Default
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true, // Default
			UserID:      2,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		mockRepo.On("CreateOracle", mock.AnythingOfType("*models.Oracle")).Return(expectedOracle, nil).Once()

		// Call service with minimal required parameters to test defaults
		oracle, err := service.CreateOracle(
			ctx,
			"test_oracle",
			"Test oracle",
			"", // Empty to test default
			"https://api.example.com/data",
			"", // Empty to test default
			models.JsonMap{},
			"",
			"", // Empty to test default
			models.JsonMap{},
			"",
			"",
			"",
			2,
		)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedOracle, oracle)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByName", "test_oracle").Return(nil, errors.New("not found")).Once()
		mockRepo.On("CreateOracle", mock.AnythingOfType("*models.Oracle")).Return(nil, errors.New("database error")).Once()

		// Call service
		oracle, err := service.CreateOracle(
			ctx,
			"test_oracle",
			"Test oracle",
			models.OracleDataSourceTypeREST,
			"https://api.example.com/data",
			"GET",
			models.JsonMap{},
			"",
			models.OracleAuthTypeNone,
			models.JsonMap{},
			"",
			"",
			"",
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestUpdateOracle tests oracle update
func TestUpdateOracle(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(existingOracle, nil).Once()

		updatedHeaders := models.JsonMap{"Content-Type": "application/json"}
		updatedAuthParams := models.JsonMap{"api_key": "12345"}

		updatedOracle := &models.Oracle{
			ID:          1,
			Name:        "updated_oracle",
			Description: "Updated oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.updated.com/data",
			Method:      "POST",
			Headers:     updatedHeaders,
			Body:        "request body",
			AuthType:    models.OracleAuthTypeAPIKey,
			AuthParams:  updatedAuthParams,
			Path:        "$.data.price",
			Transform:   "x => x * 100",
			Schedule:    "0 */1 * * *",
			Active:      false,
			UserID:      2,
		}
		mockRepo.On("UpdateOracle", mock.AnythingOfType("*models.Oracle")).Return(updatedOracle, nil).Once()

		// Call service
		oracle, err := service.UpdateOracle(
			ctx,
			1,
			"updated_oracle",
			"Updated oracle",
			models.OracleDataSourceTypeREST,
			"https://api.updated.com/data",
			"POST",
			updatedHeaders,
			"request body",
			models.OracleAuthTypeAPIKey,
			updatedAuthParams,
			"$.data.price",
			"x => x * 100",
			"0 */1 * * *",
			false,
			2,
		)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, updatedOracle, oracle)
		mockRepo.AssertExpectations(t)
	})

	t.Run("OracleNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		oracle, err := service.UpdateOracle(
			ctx,
			999,
			"updated_oracle",
			"Updated oracle",
			models.OracleDataSourceTypeREST,
			"https://api.updated.com/data",
			"POST",
			models.JsonMap{},
			"request body",
			models.OracleAuthTypeAPIKey,
			models.JsonMap{},
			"$.data.price",
			"x => x * 100",
			"0 */1 * * *",
			false,
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "not found")
		mockRepo.AssertExpectations(t)
	})

	t.Run("ValidationError", func(t *testing.T) {
		// Call service with missing URL
		oracle, err := service.UpdateOracle(
			ctx,
			1,
			"updated_oracle",
			"Updated oracle",
			models.OracleDataSourceTypeREST,
			"", // Empty URL
			"POST",
			models.JsonMap{},
			"request body",
			models.OracleAuthTypeAPIKey,
			models.JsonMap{},
			"$.data.price",
			"x => x * 100",
			"0 */1 * * *",
			false,
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "URL is required")

		// No repository calls should be made
		mockRepo.AssertNotCalled(t, "GetOracleByID")
		mockRepo.AssertNotCalled(t, "UpdateOracle")
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(existingOracle, nil).Once()
		mockRepo.On("UpdateOracle", mock.AnythingOfType("*models.Oracle")).Return(nil, errors.New("database error")).Once()

		// Call service
		oracle, err := service.UpdateOracle(
			ctx,
			1,
			"updated_oracle",
			"Updated oracle",
			models.OracleDataSourceTypeREST,
			"https://api.updated.com/data",
			"POST",
			models.JsonMap{},
			"request body",
			models.OracleAuthTypeAPIKey,
			models.JsonMap{},
			"$.data.price",
			"x => x * 100",
			"0 */1 * * *",
			false,
			2,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})

	t.Run("UnauthorizedUser", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2, // Owned by user 2
		}
		mockRepo.On("GetOracleByID", 1).Return(existingOracle, nil).Once()

		// Call service with different user ID
		oracle, err := service.UpdateOracle(
			ctx,
			1,
			"updated_oracle",
			"Updated oracle",
			models.OracleDataSourceTypeREST,
			"https://api.updated.com/data",
			"POST",
			models.JsonMap{},
			"request body",
			models.OracleAuthTypeAPIKey,
			models.JsonMap{},
			"$.data.price",
			"x => x * 100",
			"0 */1 * * *",
			false,
			3, // Different user ID
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		assert.Contains(t, err.Error(), "unauthorized")
		mockRepo.AssertExpectations(t)
	})
}

// TestGetOracle tests retrieving an oracle by ID
func TestGetOracle(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(expectedOracle, nil).Once()

		// Call service
		oracle, err := service.GetOracle(ctx, 1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedOracle, oracle)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		oracle, err := service.GetOracle(ctx, 999)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetOracleByName tests retrieving an oracle by name
func TestGetOracleByName(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByName", "test_oracle").Return(expectedOracle, nil).Once()

		// Call service
		oracle, err := service.GetOracleByName(ctx, "test_oracle")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedOracle, oracle)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByName", "nonexistent").Return(nil, errors.New("not found")).Once()

		// Call service
		oracle, err := service.GetOracleByName(ctx, "nonexistent")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracle)
		mockRepo.AssertExpectations(t)
	})
}

// TestListOracles tests listing oracles for a user
func TestListOracles(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedOracles := []*models.Oracle{
			{
				ID:          1,
				Name:        "oracle1",
				Description: "Oracle 1",
				Type:        models.OracleDataSourceTypeREST,
				URL:         "https://api.example.com/data1",
				Method:      "GET",
				Headers:     models.JsonMap{},
				Body:        "",
				AuthType:    models.OracleAuthTypeNone,
				AuthParams:  models.JsonMap{},
				Path:        "",
				Transform:   "",
				Schedule:    "",
				Active:      true,
				UserID:      2,
			},
			{
				ID:          2,
				Name:        "oracle2",
				Description: "Oracle 2",
				Type:        models.OracleDataSourceTypeREST,
				URL:         "https://api.example.com/data2",
				Method:      "GET",
				Headers:     models.JsonMap{},
				Body:        "",
				AuthType:    models.OracleAuthTypeNone,
				AuthParams:  models.JsonMap{},
				Path:        "",
				Transform:   "",
				Schedule:    "",
				Active:      true,
				UserID:      2,
			},
		}
		mockRepo.On("ListOracles", 2, 0, 10).Return(expectedOracles, nil).Once()

		// Call service
		oracles, err := service.ListOracles(ctx, 2, 0, 10)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedOracles, oracles)
		mockRepo.AssertExpectations(t)
	})

	t.Run("EmptyList", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListOracles", 3, 0, 10).Return([]*models.Oracle{}, nil).Once()

		// Call service
		oracles, err := service.ListOracles(ctx, 3, 0, 10)

		// Assertions
		require.NoError(t, err)
		assert.Empty(t, oracles)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListOracles", 2, 0, 10).Return(nil, errors.New("database error")).Once()

		// Call service
		oracles, err := service.ListOracles(ctx, 2, 0, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, oracles)
		mockRepo.AssertExpectations(t)
	})
}

// TestDeleteOracle tests oracle deletion
func TestDeleteOracle(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(existingOracle, nil).Once()
		mockRepo.On("DeleteOracle", 1).Return(nil).Once()

		// Call service
		err := service.DeleteOracle(ctx, 1, 2)

		// Assertions
		require.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("OracleNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		err := service.DeleteOracle(ctx, 999, 2)

		// Assertions
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
		mockRepo.AssertExpectations(t)
	})

	t.Run("UnauthorizedUser", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2, // Owned by user 2
		}
		mockRepo.On("GetOracleByID", 1).Return(existingOracle, nil).Once()

		// Call service with different user ID
		err := service.DeleteOracle(ctx, 1, 3) // Different user ID

		// Assertions
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unauthorized")
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		existingOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{},
			Body:        "",
			AuthType:    models.OracleAuthTypeNone,
			AuthParams:  models.JsonMap{},
			Path:        "",
			Transform:   "",
			Schedule:    "",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(existingOracle, nil).Once()
		mockRepo.On("DeleteOracle", 1).Return(errors.New("database error")).Once()

		// Call service
		err := service.DeleteOracle(ctx, 1, 2)

		// Assertions
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestCreateOracleRequest tests oracle request creation
func TestCreateOracleRequest(t *testing.T) {
	service, mockRepo, mockBlockchainClient, mockGasBankService, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mocks
		oracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{"Content-Type": "application/json"},
			Body:        "",
			AuthType:    models.OracleAuthTypeAPIKey,
			AuthParams:  models.JsonMap{"api_key": "12345"},
			Path:        "$.data.price",
			Transform:   "",
			Schedule:    "0 */1 * * *",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(oracle, nil).Once()
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()
		mockGasBankService.On("AllocateGas", 2, "oracle_request", int64(500000)).Return(int64(500000), nil).Once()

		params := map[string]interface{}{
			"symbol": "BTC",
		}

		expectedRequest := &models.OracleRequest{
			ID:              1,
			OracleID:        1,
			UserID:          2,
			Status:          models.OracleRequestStatusPending,
			URL:             "https://api.example.com/data",
			Method:          "GET",
			Headers:         models.JsonMap{"Content-Type": "application/json"},
			Body:            "",
			AuthType:        models.OracleAuthTypeAPIKey,
			AuthParams:      models.JsonMap{"api_key": "12345"},
			Path:            "$.data.price",
			Transform:       "",
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			GasFee:          0.1,
			BlockHeight:     100,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		mockRepo.On("CreateOracleRequest", mock.AnythingOfType("*models.OracleRequest")).Return(expectedRequest, nil).Once()

		// Call service
		request, err := service.CreateOracleRequest(
			ctx,
			1,
			2,
			params,
			"0x1234",
			"callback",
			0.1,
		)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockRepo.AssertExpectations(t)
		mockBlockchainClient.AssertExpectations(t)
		mockGasBankService.AssertExpectations(t)
	})

	t.Run("OracleNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		params := map[string]interface{}{
			"symbol": "BTC",
		}
		request, err := service.CreateOracleRequest(
			ctx,
			999,
			2,
			params,
			"0x1234",
			"callback",
			0.1,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		assert.Contains(t, err.Error(), "not found")
		mockRepo.AssertExpectations(t)
	})

	t.Run("InactiveOracle", func(t *testing.T) {
		// Setup mocks
		inactiveOracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{"Content-Type": "application/json"},
			Body:        "",
			AuthType:    models.OracleAuthTypeAPIKey,
			AuthParams:  models.JsonMap{"api_key": "12345"},
			Path:        "$.data.price",
			Transform:   "",
			Schedule:    "0 */1 * * *",
			Active:      false, // Inactive oracle
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(inactiveOracle, nil).Once()

		// Call service
		params := map[string]interface{}{
			"symbol": "BTC",
		}
		request, err := service.CreateOracleRequest(
			ctx,
			1,
			2,
			params,
			"0x1234",
			"callback",
			0.1,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		assert.Contains(t, err.Error(), "inactive")
		mockRepo.AssertExpectations(t)
	})

	t.Run("GasAllocationFailure", func(t *testing.T) {
		// Setup mocks
		oracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{"Content-Type": "application/json"},
			Body:        "",
			AuthType:    models.OracleAuthTypeAPIKey,
			AuthParams:  models.JsonMap{"api_key": "12345"},
			Path:        "$.data.price",
			Transform:   "",
			Schedule:    "0 */1 * * *",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(oracle, nil).Once()
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()
		mockGasBankService.On("AllocateGas", 2, "oracle_request", int64(500000)).Return(int64(0), errors.New("insufficient gas")).Once()

		// Call service
		params := map[string]interface{}{
			"symbol": "BTC",
		}
		request, err := service.CreateOracleRequest(
			ctx,
			1,
			2,
			params,
			"0x1234",
			"callback",
			0.1,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		assert.Contains(t, err.Error(), "insufficient gas")
		mockRepo.AssertExpectations(t)
		mockBlockchainClient.AssertExpectations(t)
		mockGasBankService.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mocks
		oracle := &models.Oracle{
			ID:          1,
			Name:        "test_oracle",
			Description: "Test oracle",
			Type:        models.OracleDataSourceTypeREST,
			URL:         "https://api.example.com/data",
			Method:      "GET",
			Headers:     models.JsonMap{"Content-Type": "application/json"},
			Body:        "",
			AuthType:    models.OracleAuthTypeAPIKey,
			AuthParams:  models.JsonMap{"api_key": "12345"},
			Path:        "$.data.price",
			Transform:   "",
			Schedule:    "0 */1 * * *",
			Active:      true,
			UserID:      2,
		}
		mockRepo.On("GetOracleByID", 1).Return(oracle, nil).Once()
		mockBlockchainClient.On("GetBlockHeight").Return(int64(100), nil).Once()
		mockGasBankService.On("AllocateGas", 2, "oracle_request", int64(500000)).Return(int64(500000), nil).Once()
		mockRepo.On("CreateOracleRequest", mock.AnythingOfType("*models.OracleRequest")).Return(nil, errors.New("database error")).Once()

		// Call service
		params := map[string]interface{}{
			"symbol": "BTC",
		}
		request, err := service.CreateOracleRequest(
			ctx,
			1,
			2,
			params,
			"0x1234",
			"callback",
			0.1,
		)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
		mockBlockchainClient.AssertExpectations(t)
		mockGasBankService.AssertExpectations(t)
	})
}

// TestGetOracleRequest tests retrieving an oracle request by ID
func TestGetOracleRequest(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedRequest := &models.OracleRequest{
			ID:              1,
			OracleID:        1,
			UserID:          2,
			Status:          models.OracleRequestStatusPending,
			URL:             "https://api.example.com/data",
			Method:          "GET",
			Headers:         models.JsonMap{"Content-Type": "application/json"},
			Body:            "",
			AuthType:        models.OracleAuthTypeAPIKey,
			AuthParams:      models.JsonMap{"api_key": "12345"},
			Path:            "$.data.price",
			Transform:       "",
			CallbackAddress: "0x1234",
			CallbackMethod:  "callback",
			GasFee:          0.1,
			BlockHeight:     100,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		mockRepo.On("GetOracleRequestByID", 1).Return(expectedRequest, nil).Once()

		// Call service
		request, err := service.GetOracleRequest(ctx, 1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequest, request)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleRequestByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		request, err := service.GetOracleRequest(ctx, 999)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, request)
		mockRepo.AssertExpectations(t)
	})
}

// TestListOracleRequests tests listing oracle requests
func TestListOracleRequests(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedRequests := []*models.OracleRequest{
			{
				ID:              1,
				OracleID:        1,
				UserID:          2,
				Status:          models.OracleRequestStatusPending,
				URL:             "https://api.example.com/data",
				Method:          "GET",
				Headers:         models.JsonMap{"Content-Type": "application/json"},
				Body:            "",
				AuthType:        models.OracleAuthTypeAPIKey,
				AuthParams:      models.JsonMap{"api_key": "12345"},
				Path:            "$.data.price",
				Transform:       "",
				CallbackAddress: "0x1234",
				CallbackMethod:  "callback",
				GasFee:          0.1,
				BlockHeight:     100,
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			},
			{
				ID:              2,
				OracleID:        1,
				UserID:          2,
				Status:          models.OracleRequestStatusCompleted,
				URL:             "https://api.example.com/data",
				Method:          "GET",
				Headers:         models.JsonMap{"Content-Type": "application/json"},
				Body:            "",
				AuthType:        models.OracleAuthTypeAPIKey,
				AuthParams:      models.JsonMap{"api_key": "12345"},
				Path:            "$.data.price",
				Transform:       "",
				CallbackAddress: "0x1234",
				CallbackMethod:  "callback",
				GasFee:          0.1,
				BlockHeight:     100,
				Result:          models.JsonMap{"price": 50000.0},
				RawResult:       `{"price": 50000.0}`,
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
				CompletedAt:     time.Now(),
			},
		}
		mockRepo.On("ListOracleRequests", 1, 0, 10).Return(expectedRequests, nil).Once()

		// Call service
		requests, err := service.ListOracleRequests(ctx, 1, 0, 10)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedRequests, requests)
		mockRepo.AssertExpectations(t)
	})

	t.Run("EmptyList", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListOracleRequests", 999, 0, 10).Return([]*models.OracleRequest{}, nil).Once()

		// Call service
		requests, err := service.ListOracleRequests(ctx, 999, 0, 10)

		// Assertions
		require.NoError(t, err)
		assert.Empty(t, requests)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListOracleRequests", 1, 0, 10).Return(nil, errors.New("database error")).Once()

		// Call service
		requests, err := service.ListOracleRequests(ctx, 1, 0, 10)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, requests)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetOracleStatistics tests retrieving oracle statistics
func TestGetOracleStatistics(t *testing.T) {
	service, mockRepo, _, _, _ := setupTestService()
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedStats := map[string]interface{}{
			"total_requests":        100,
			"pending_requests":      10,
			"completed_requests":    85,
			"failed_requests":       5,
			"average_response_time": 2.5,
		}
		mockRepo.On("GetOracleStatistics").Return(expectedStats, nil).Once()

		// Call service
		stats, err := service.GetOracleStatistics(ctx)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedStats, stats)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetOracleStatistics").Return(nil, errors.New("database error")).Once()

		// Call service
		stats, err := service.GetOracleStatistics(ctx)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, stats)
		mockRepo.AssertExpectations(t)
	})
}
