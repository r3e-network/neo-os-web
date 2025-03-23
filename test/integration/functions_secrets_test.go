package integration_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/functions"
	"github.com/R3E-Network/service_layer/internal/core/secrets"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/repositories"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockSecretRepository is a mock implementation of models.SecretRepository
type MockSecretRepository struct {
	mock.Mock
}

func (m *MockSecretRepository) Create(secret *models.Secret) error {
	args := m.Called(secret)
	return args.Error(0)
}

func (m *MockSecretRepository) GetByID(userID, secretID int) (*models.Secret, error) {
	args := m.Called(userID, secretID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Secret), args.Error(1)
}

func (m *MockSecretRepository) GetByName(userID int, name string) (*models.Secret, error) {
	args := m.Called(userID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Secret), args.Error(1)
}

func (m *MockSecretRepository) Update(secret *models.Secret) error {
	args := m.Called(secret)
	return args.Error(0)
}

func (m *MockSecretRepository) Delete(userID, secretID int) error {
	args := m.Called(userID, secretID)
	return args.Error(0)
}

func (m *MockSecretRepository) List(userID int) ([]*models.Secret, error) {
	args := m.Called(userID)
	return args.Get(0).([]*models.Secret), args.Error(1)
}

// MockFunctionRepository is a mock implementation of models.FunctionRepository
type MockFunctionRepository struct {
	mock.Mock
}

func (m *MockFunctionRepository) Create(function *models.Function) error {
	args := m.Called(function)
	return args.Error(0)
}

func (m *MockFunctionRepository) GetByID(userID, functionID int) (*models.Function, error) {
	args := m.Called(userID, functionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Function), args.Error(1)
}

func (m *MockFunctionRepository) Update(function *models.Function) error {
	args := m.Called(function)
	return args.Error(0)
}

func (m *MockFunctionRepository) Delete(userID, functionID int) error {
	args := m.Called(userID, functionID)
	return args.Error(0)
}

func (m *MockFunctionRepository) List(userID int) ([]*models.Function, error) {
	args := m.Called(userID)
	return args.Get(0).([]*models.Function), args.Error(1)
}

// MockTEERuntime is a mock implementation of the TEE runtime
type MockTEERuntime struct {
	mock.Mock
}

func (m *MockTEERuntime) ExecuteFunction(ctx context.Context, code string, params map[string]interface{}, secrets map[string]string) (interface{}, error) {
	args := m.Called(ctx, code, params, secrets)
	return args.Get(0), args.Error(1)
}

// Setup functions with secrets integration test
func setupFunctionsSecretsTest() (*functions.Service, *secrets.Service, *MockFunctionRepository, *MockSecretRepository, *MockTEERuntime) {
	// Create logger
	log := logger.NewLogger("test", "debug")

	// Create config
	cfg := &config.Config{
		Security: config.SecurityConfig{
			EncryptionKey: "super-secure-encryption-key-at-least-32b",
			SecretsTTL:    3600,
		},
	}

	// Create mock repositories
	mockFunctionRepo := new(MockFunctionRepository)
	mockSecretRepo := new(MockSecretRepository)
	mockTeeRuntime := new(MockTEERuntime)

	// Create secrets service
	secretsService := secrets.NewService(cfg, log, mockSecretRepo)

	// Create functions service with dependency on secrets service
	functionsService := functions.NewService(
		cfg,
		log,
		mockFunctionRepo,
		mockTeeRuntime,
		secretsService,
	)

	return functionsService, secretsService, mockFunctionRepo, mockSecretRepo, mockTeeRuntime
}

// Create test secrets
func createTestSecrets() []*models.Secret {
	return []*models.Secret{
		{
			ID:        1,
			UserID:    1,
			Name:      "api_key",
			Value:     "test-api-key-value",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        2,
			UserID:    1,
			Name:      "database_password",
			Value:     "test-db-password",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}
}

// Create test function
func createTestFunction() *models.Function {
	return &models.Function{
		ID:         1,
		UserID:     1,
		Name:       "TestFunction",
		SourceCode: `
			function main(params) {
				// Access secrets
				const apiKey = secrets.api_key;
				const dbPassword = secrets.database_password;
				
				// Return secret values for testing
				return {
					apiKeyAccessed: apiKey !== undefined,
					apiKeyValue: apiKey,
					dbPasswordAccessed: dbPassword !== undefined,
					dbPasswordValue: dbPassword
				};
			}
		`,
		SecretsAccess: []string{"api_key", "database_password"},
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

// Test function execution with secrets
func TestFunctionExecutionWithSecrets(t *testing.T) {
	// Setup
	functionsService, _, mockFunctionRepo, mockSecretRepo, mockTeeRuntime := setupFunctionsSecretsTest()

	// Create test data
	testFunction := createTestFunction()
	testSecrets := createTestSecrets()

	// Setup repository mocks
	mockFunctionRepo.On("GetByID", 1, 1).Return(testFunction, nil)
	
	mockSecretRepo.On("GetByName", 1, "api_key").Return(testSecrets[0], nil)
	mockSecretRepo.On("GetByName", 1, "database_password").Return(testSecrets[1], nil)

	// Setup TEE runtime mock with expected secrets
	expectedSecretMap := map[string]string{
		"api_key":           "test-api-key-value",
		"database_password": "test-db-password",
	}
	
	// Mock the execution result
	executeResult := map[string]interface{}{
		"apiKeyAccessed":    true,
		"apiKeyValue":       "test-api-key-value",
		"dbPasswordAccessed": true,
		"dbPasswordValue":    "test-db-password",
	}
	
	mockTeeRuntime.On(
		"ExecuteFunction",
		mock.Anything,  // context
		testFunction.SourceCode,
		mock.Anything,  // params
		expectedSecretMap,
	).Return(executeResult, nil)

	// Execute function with test parameters
	testParams := map[string]interface{}{
		"input": "test-value",
	}
	
	result, err := functionsService.ExecuteFunction(1, 1, testParams)
	require.NoError(t, err)
	
	// Verify result
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok, "Result should be a map")
	
	assert.True(t, resultMap["apiKeyAccessed"].(bool), "API key should be accessed")
	assert.Equal(t, "test-api-key-value", resultMap["apiKeyValue"], "API key value should match")
	assert.True(t, resultMap["dbPasswordAccessed"].(bool), "Database password should be accessed")
	assert.Equal(t, "test-db-password", resultMap["dbPasswordValue"], "Database password value should match")
	
	// Verify all mocks were called
	mockFunctionRepo.AssertExpectations(t)
	mockSecretRepo.AssertExpectations(t)
	mockTeeRuntime.AssertExpectations(t)
}

// Test function execution with unauthorized secret access
func TestFunctionExecutionWithUnauthorizedSecretAccess(t *testing.T) {
	// Setup
	functionsService, _, mockFunctionRepo, mockSecretRepo, mockTeeRuntime := setupFunctionsSecretsTest()

	// Create test function with unauthorized secret access
	testFunction := createTestFunction()
	testFunction.SecretsAccess = []string{"api_key"} // Only authorized for api_key
	
	// Setup repository mocks
	mockFunctionRepo.On("GetByID", 1, 1).Return(testFunction, nil)
	mockSecretRepo.On("GetByName", 1, "api_key").Return(createTestSecrets()[0], nil)
	
	// Setup TEE runtime mock with expected secrets (only api_key, not database_password)
	expectedSecretMap := map[string]string{
		"api_key": "test-api-key-value",
	}
	
	// Mock the execution result
	executeResult := map[string]interface{}{
		"apiKeyAccessed":    true,
		"apiKeyValue":       "test-api-key-value",
		"dbPasswordAccessed": false,
		"dbPasswordValue":    "",
	}
	
	mockTeeRuntime.On(
		"ExecuteFunction",
		mock.Anything,  // context
		testFunction.SourceCode,
		mock.Anything,  // params
		expectedSecretMap,
	).Return(executeResult, nil)

	// Execute function
	testParams := map[string]interface{}{
		"input": "test-value",
	}
	
	result, err := functionsService.ExecuteFunction(1, 1, testParams)
	require.NoError(t, err)
	
	// Verify result
	resultMap, ok := result.(map[string]interface{})
	require.True(t, ok, "Result should be a map")
	
	assert.True(t, resultMap["apiKeyAccessed"].(bool), "API key should be accessed")
	assert.Equal(t, "test-api-key-value", resultMap["apiKeyValue"], "API key value should match")
	assert.False(t, resultMap["dbPasswordAccessed"].(bool), "Database password should not be accessed")
	assert.Equal(t, "", resultMap["dbPasswordValue"], "Database password value should be empty")
	
	// Verify unauthorized secret was not accessed
	mockSecretRepo.AssertNotCalled(t, "GetByName", 1, "database_password")
	
	// Verify all other mocks were called
	mockFunctionRepo.AssertExpectations(t)
	mockSecretRepo.AssertExpectations(t)
	mockTeeRuntime.AssertExpectations(t)
}

// Test secret isolation between functions
func TestSecretIsolationBetweenFunctions(t *testing.T) {
	// Setup
	functionsService, _, mockFunctionRepo, mockSecretRepo, mockTeeRuntime := setupFunctionsSecretsTest()

	// Create two test functions with different secret access
	function1 := createTestFunction()
	function1.ID = 1
	function1.SecretsAccess = []string{"api_key"}
	
	function2 := createTestFunction()
	function2.ID = 2
	function2.SecretsAccess = []string{"database_password"}
	
	// Setup repository mocks
	mockFunctionRepo.On("GetByID", 1, 1).Return(function1, nil)
	mockFunctionRepo.On("GetByID", 1, 2).Return(function2, nil)
	
	mockSecretRepo.On("GetByName", 1, "api_key").Return(createTestSecrets()[0], nil)
	mockSecretRepo.On("GetByName", 1, "database_password").Return(createTestSecrets()[1], nil)
	
	// Setup TEE runtime mocks with different expected secrets for each function
	expectedSecretMap1 := map[string]string{
		"api_key": "test-api-key-value",
	}
	
	expectedSecretMap2 := map[string]string{
		"database_password": "test-db-password",
	}
	
	// Mock execution results
	executeResult1 := map[string]interface{}{
		"apiKeyAccessed":    true,
		"apiKeyValue":       "test-api-key-value",
		"dbPasswordAccessed": false,
		"dbPasswordValue":    "",
	}
	
	executeResult2 := map[string]interface{}{
		"apiKeyAccessed":    false,
		"apiKeyValue":       "",
		"dbPasswordAccessed": true,
		"dbPasswordValue":    "test-db-password",
	}
	
	mockTeeRuntime.On(
		"ExecuteFunction",
		mock.Anything,
		function1.SourceCode,
		mock.Anything,
		expectedSecretMap1,
	).Return(executeResult1, nil)
	
	mockTeeRuntime.On(
		"ExecuteFunction",
		mock.Anything,
		function2.SourceCode,
		mock.Anything,
		expectedSecretMap2,
	).Return(executeResult2, nil)

	// Execute function 1
	testParams := map[string]interface{}{
		"input": "test-value",
	}
	
	result1, err := functionsService.ExecuteFunction(1, 1, testParams)
	require.NoError(t, err)
	
	// Verify function 1 result
	resultMap1, ok := result1.(map[string]interface{})
	require.True(t, ok)
	
	assert.True(t, resultMap1["apiKeyAccessed"].(bool), "Function 1 should access api_key")
	assert.False(t, resultMap1["dbPasswordAccessed"].(bool), "Function 1 should not access database_password")
	
	// Execute function 2
	result2, err := functionsService.ExecuteFunction(1, 2, testParams)
	require.NoError(t, err)
	
	// Verify function 2 result
	resultMap2, ok := result2.(map[string]interface{})
	require.True(t, ok)
	
	assert.False(t, resultMap2["apiKeyAccessed"].(bool), "Function 2 should not access api_key")
	assert.True(t, resultMap2["dbPasswordAccessed"].(bool), "Function 2 should access database_password")
	
	// Verify all mocks were called with the expected arguments
	mockFunctionRepo.AssertExpectations(t)
	mockSecretRepo.AssertExpectations(t)
	mockTeeRuntime.AssertExpectations(t)
}