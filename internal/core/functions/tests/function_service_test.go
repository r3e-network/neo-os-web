package tests

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"service_layer/internal/config"
	"service_layer/internal/core/functions"
	"service_layer/internal/models"
	"service_layer/internal/tee"
	"service_layer/pkg/logger"
)

// MockFunctionRepository is a mock implementation of the FunctionRepository interface
type MockFunctionRepository struct {
	mock.Mock
}

func (m *MockFunctionRepository) Create(function *models.Function) error {
	args := m.Called(function)
	return args.Error(0)
}

func (m *MockFunctionRepository) GetByID(id int) (*models.Function, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Function), args.Error(1)
}

func (m *MockFunctionRepository) GetByUserIDAndName(userID int, name string) (*models.Function, error) {
	args := m.Called(userID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Function), args.Error(1)
}

func (m *MockFunctionRepository) List(userID int, offset, limit int) ([]*models.Function, error) {
	args := m.Called(userID, offset, limit)
	return args.Get(0).([]*models.Function), args.Error(1)
}

func (m *MockFunctionRepository) Update(function *models.Function) error {
	args := m.Called(function)
	return args.Error(0)
}

func (m *MockFunctionRepository) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockFunctionRepository) IncrementExecutionCount(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockFunctionRepository) UpdateLastExecution(id int, lastExecution time.Time) error {
	args := m.Called(id, lastExecution)
	return args.Error(0)
}

func (m *MockFunctionRepository) GetSecrets(functionID int) ([]string, error) {
	args := m.Called(functionID)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockFunctionRepository) SetSecrets(functionID int, secrets []string) error {
	args := m.Called(functionID, secrets)
	return args.Error(0)
}

// MockExecutionRepository is a mock implementation of the ExecutionRepository interface
type MockExecutionRepository struct {
	mock.Mock
}

func (m *MockExecutionRepository) Create(execution *models.Execution) error {
	args := m.Called(execution)
	return args.Error(0)
}

func (m *MockExecutionRepository) GetByID(id int) (*models.Execution, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Execution), args.Error(1)
}

func (m *MockExecutionRepository) ListByFunctionID(functionID int, offset, limit int) ([]*models.Execution, error) {
	args := m.Called(functionID, offset, limit)
	return args.Get(0).([]*models.Execution), args.Error(1)
}

func (m *MockExecutionRepository) Update(execution *models.Execution) error {
	args := m.Called(execution)
	return args.Error(0)
}

func (m *MockExecutionRepository) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockExecutionRepository) AddLog(log *models.ExecutionLog) error {
	args := m.Called(log)
	return args.Error(0)
}

func (m *MockExecutionRepository) GetLogs(executionID int, offset, limit int) ([]*models.ExecutionLog, error) {
	args := m.Called(executionID, offset, limit)
	return args.Get(0).([]*models.ExecutionLog), args.Error(1)
}

// MockTEEManager is a mock implementation of the TEE Manager
type MockTEEManager struct {
	mock.Mock
}

func (m *MockTEEManager) ExecuteFunction(ctx context.Context, function *models.Function, params interface{}, secrets []string) (*models.ExecutionResult, error) {
	args := m.Called(ctx, function, params, secrets)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.ExecutionResult), args.Error(1)
}

// TestCreateFunction tests the CreateFunction method
func TestCreateFunction(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		userID        int
		functionName  string
		description   string
		sourceCode    string
		timeout       int
		memory        int
		secrets       []string
		setupMocks    func(*MockFunctionRepository, *MockExecutionRepository, *MockTEEManager)
		expectedError bool
	}{
		{
			name:        "Success",
			userID:      1,
			functionName: "test-function",
			description: "Test function description",
			sourceCode:  "function handler(event) { return { result: 'success' }; }",
			timeout:     5,
			memory:      128,
			secrets:     []string{"API_KEY"},
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByUserIDAndName - should return nil for no existing function
				fr.On("GetByUserIDAndName", 1, "test-function").Return(nil, nil)
				
				// Setup Create - should succeed
				fr.On("Create", mock.AnythingOfType("*models.Function")).Return(nil)
			},
			expectedError: false,
		},
		{
			name:        "DuplicateFunctionName",
			userID:      1,
			functionName: "existing-function",
			description: "Test function description",
			sourceCode:  "function handler(event) { return { result: 'success' }; }",
			timeout:     5,
			memory:      128,
			secrets:     []string{"API_KEY"},
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByUserIDAndName - should return an existing function
				existingFunction := &models.Function{
					ID:      1,
					UserID:  1,
					Name:    "existing-function",
					Status:  "active",
					Timeout: 5,
					Memory:  128,
				}
				fr.On("GetByUserIDAndName", 1, "existing-function").Return(existingFunction, nil)
			},
			expectedError: true,
		},
		{
			name:        "EmptySourceCode",
			userID:      1,
			functionName: "test-function",
			description: "Test function description",
			sourceCode:  "", // Empty source code should fail validation
			timeout:     5,
			memory:      128,
			secrets:     []string{"API_KEY"},
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// No mocks needed as it should fail validation
			},
			expectedError: true,
		},
		{
			name:        "RepositoryError",
			userID:      1,
			functionName: "test-function",
			description: "Test function description",
			sourceCode:  "function handler(event) { return { result: 'success' }; }",
			timeout:     5,
			memory:      128,
			secrets:     []string{"API_KEY"},
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByUserIDAndName - should return nil for no existing function
				fr.On("GetByUserIDAndName", 1, "test-function").Return(nil, nil)
				
				// Setup Create - should fail
				fr.On("Create", mock.AnythingOfType("*models.Function")).Return(errors.New("database error"))
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockFunctionRepo := new(MockFunctionRepository)
			mockExecutionRepo := new(MockExecutionRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Functions: config.FunctionsConfig{
						MaxSourceCodeSize: 1000000, // 1MB
					},
				},
				TEE: config.TEE{
					Runtime: config.Runtime{
						ExecutionTimeout: 10,
						JSMemoryLimit:    256,
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockFunctionRepo, mockExecutionRepo, mockTEEManager)
			
			// Create function service with mocks
			service := functions.NewService(cfg, log, mockFunctionRepo, mockExecutionRepo, mockTEEManager)
			
			// Call method
			function, err := service.CreateFunction(tc.userID, tc.functionName, tc.description, tc.sourceCode, tc.timeout, tc.memory, tc.secrets)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, function)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, function)
				assert.Equal(t, tc.userID, function.UserID)
				assert.Equal(t, tc.functionName, function.Name)
				assert.Equal(t, tc.description, function.Description)
				assert.Equal(t, tc.sourceCode, function.SourceCode)
				assert.Equal(t, tc.timeout, function.Timeout)
				assert.Equal(t, tc.memory, function.Memory)
				assert.Equal(t, tc.secrets, function.Secrets)
				assert.Equal(t, "active", function.Status)
			}
			
			// Verify mock expectations
			mockFunctionRepo.AssertExpectations(t)
			mockExecutionRepo.AssertExpectations(t)
			mockTEEManager.AssertExpectations(t)
		})
	}
}

// TestExecuteFunction tests the ExecuteFunction method
func TestExecuteFunction(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		userID        int
		functionID    int
		params        map[string]interface{}
		async         bool
		setupMocks    func(*MockFunctionRepository, *MockExecutionRepository, *MockTEEManager)
		expectedError bool
		expectedAsync bool
	}{
		{
			name:       "SuccessSync",
			userID:     1,
			functionID: 1,
			params:     map[string]interface{}{"key": "value"},
			async:      false,
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByID - should return a valid function
				function := &models.Function{
					ID:         1,
					UserID:     1,
					Name:       "test-function",
					SourceCode: "function handler(event) { return event; }",
					Status:     "active",
					Timeout:    5,
					Memory:     128,
					Secrets:    []string{"API_KEY"},
				}
				fr.On("GetByID", 1).Return(function, nil)
				
				// Setup execution creation
				er.On("Create", mock.AnythingOfType("*models.Execution")).Return(nil)
				
				// Setup execution updates
				fr.On("IncrementExecutionCount", 1).Return(nil)
				fr.On("UpdateLastExecution", 1, mock.AnythingOfType("time.Time")).Return(nil)
				
				// Setup TEE execution
				result := &models.ExecutionResult{
					ExecutionID: "1",
					FunctionID:  1,
					Status:      "success",
					Result:      json.RawMessage(`{"key":"value"}`),
					Logs:        []string{"Executing function", "Function completed"},
				}
				tm.On("ExecuteFunction", mock.Anything, function, mock.AnythingOfType("map[string]interface {}"), []string{"API_KEY"}).Return(result, nil)
				
				// Setup execution record update
				er.On("Update", mock.AnythingOfType("*models.Execution")).Return(nil)
			},
			expectedError: false,
			expectedAsync: false,
		},
		{
			name:       "SuccessAsync",
			userID:     1,
			functionID: 1,
			params:     map[string]interface{}{"key": "value"},
			async:      true,
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByID - should return a valid function
				function := &models.Function{
					ID:         1,
					UserID:     1,
					Name:       "test-function",
					SourceCode: "function handler(event) { return event; }",
					Status:     "active",
					Timeout:    5,
					Memory:     128,
					Secrets:    []string{"API_KEY"},
				}
				fr.On("GetByID", 1).Return(function, nil)
				
				// Setup execution creation
				er.On("Create", mock.AnythingOfType("*models.Execution")).Return(nil)
				
				// We don't need to set up the rest of the mocks because the function will be executed asynchronously
				// and we're not waiting for it to complete in this test
			},
			expectedError: false,
			expectedAsync: true,
		},
		{
			name:       "FunctionNotFound",
			userID:     1,
			functionID: 999, // Non-existent function ID
			params:     map[string]interface{}{"key": "value"},
			async:      false,
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByID - should return nil for non-existent function
				fr.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
			expectedAsync: false,
		},
		{
			name:       "ExecutionCreationError",
			userID:     1,
			functionID: 1,
			params:     map[string]interface{}{"key": "value"},
			async:      false,
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByID - should return a valid function
				function := &models.Function{
					ID:         1,
					UserID:     1,
					Name:       "test-function",
					SourceCode: "function handler(event) { return event; }",
					Status:     "active",
					Timeout:    5,
					Memory:     128,
					Secrets:    []string{"API_KEY"},
				}
				fr.On("GetByID", 1).Return(function, nil)
				
				// Setup execution creation - should fail
				er.On("Create", mock.AnythingOfType("*models.Execution")).Return(errors.New("database error"))
			},
			expectedError: true,
			expectedAsync: false,
		},
		{
			name:       "TEEExecutionError",
			userID:     1,
			functionID: 1,
			params:     map[string]interface{}{"key": "value"},
			async:      false,
			setupMocks: func(fr *MockFunctionRepository, er *MockExecutionRepository, tm *MockTEEManager) {
				// Setup GetByID - should return a valid function
				function := &models.Function{
					ID:         1,
					UserID:     1,
					Name:       "test-function",
					SourceCode: "function handler(event) { return event; }",
					Status:     "active",
					Timeout:    5,
					Memory:     128,
					Secrets:    []string{"API_KEY"},
				}
				fr.On("GetByID", 1).Return(function, nil)
				
				// Setup execution creation
				er.On("Create", mock.AnythingOfType("*models.Execution")).Return(nil)
				
				// Setup execution updates
				fr.On("IncrementExecutionCount", 1).Return(nil)
				fr.On("UpdateLastExecution", 1, mock.AnythingOfType("time.Time")).Return(nil)
				
				// Setup TEE execution - should fail
				tm.On("ExecuteFunction", mock.Anything, function, mock.AnythingOfType("map[string]interface {}"), []string{"API_KEY"}).Return(nil, errors.New("execution error"))
				
				// Setup execution record update
				er.On("Update", mock.AnythingOfType("*models.Execution")).Return(nil)
			},
			expectedError: false, // The execution error is recorded in the execution record but not returned
			expectedAsync: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockFunctionRepo := new(MockFunctionRepository)
			mockExecutionRepo := new(MockExecutionRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Functions: config.FunctionsConfig{
						MaxSourceCodeSize: 1000000, // 1MB
					},
				},
				TEE: config.TEE{
					Runtime: config.Runtime{
						ExecutionTimeout: 10,
						JSMemoryLimit:    256,
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockFunctionRepo, mockExecutionRepo, mockTEEManager)
			
			// Create function service with mocks
			service := functions.NewService(cfg, log, mockFunctionRepo, mockExecutionRepo, mockTEEManager)
			
			// Call method
			result, err := service.ExecuteFunction(context.Background(), tc.functionID, tc.userID, tc.params, tc.async)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tc.functionID, result.FunctionID)
				
				// For async executions, only check that status is "running"
				if tc.expectedAsync {
					assert.Equal(t, "running", result.Status)
				}
			}
			
			// Verify mock expectations
			mockFunctionRepo.AssertExpectations(t)
			mockExecutionRepo.AssertExpectations(t)
			mockTEEManager.AssertExpectations(t)
		})
	}
}

// TestGetFunction tests the GetFunction method
func TestGetFunction(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		functionID    int
		userID        int
		setupMocks    func(*MockFunctionRepository)
		expectedError bool
	}{
		{
			name:       "Success",
			functionID: 1,
			userID:     1,
			setupMocks: func(fr *MockFunctionRepository) {
				// Setup GetByID - should return a valid function
				function := &models.Function{
					ID:         1,
					UserID:     1,
					Name:       "test-function",
					SourceCode: "function handler(event) { return event; }",
					Status:     "active",
					Timeout:    5,
					Memory:     128,
				}
				fr.On("GetByID", 1).Return(function, nil)
			},
			expectedError: false,
		},
		{
			name:       "FunctionNotFound",
			functionID: 999, // Non-existent function ID
			userID:     1,
			setupMocks: func(fr *MockFunctionRepository) {
				// Setup GetByID - should return nil for non-existent function
				fr.On("GetByID", 999).Return(nil, nil)
			},
			expectedError: true,
		},
		{
			name:       "NotAuthorized",
			functionID: 1,
			userID:     2, // Different user ID
			setupMocks: func(fr *MockFunctionRepository) {
				// Setup GetByID - should return a function owned by user 1, not user 2
				function := &models.Function{
					ID:         1,
					UserID:     1, // Owned by user 1
					Name:       "test-function",
					SourceCode: "function handler(event) { return event; }",
					Status:     "active",
					Timeout:    5,
					Memory:     128,
				}
				fr.On("GetByID", 1).Return(function, nil)
			},
			expectedError: true,
		},
		{
			name:       "DatabaseError",
			functionID: 1,
			userID:     1,
			setupMocks: func(fr *MockFunctionRepository) {
				// Setup GetByID - should return an error
				fr.On("GetByID", 1).Return(nil, errors.New("database error"))
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockFunctionRepo := new(MockFunctionRepository)
			mockExecutionRepo := new(MockExecutionRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Functions: config.FunctionsConfig{
						MaxSourceCodeSize: 1000000, // 1MB
					},
				},
				TEE: config.TEE{
					Runtime: config.Runtime{
						ExecutionTimeout: 10,
						JSMemoryLimit:    256,
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Setup mocks
			tc.setupMocks(mockFunctionRepo)
			
			// Create function service with mocks
			service := functions.NewService(cfg, log, mockFunctionRepo, mockExecutionRepo, mockTEEManager)
			
			// Call method
			function, err := service.GetFunction(tc.functionID, tc.userID)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, function)
				assert.Equal(t, tc.functionID, function.ID)
				assert.Equal(t, tc.userID, function.UserID)
			}
			
			// Verify mock expectations
			mockFunctionRepo.AssertExpectations(t)
		})
	}
}

// TestListFunctions tests the ListFunctions method
func TestListFunctions(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		userID        int
		page          int
		limit         int
		setupMocks    func(*MockFunctionRepository, int, int, int)
		expectedError bool
		expectedCount int
	}{
		{
			name:   "Success",
			userID: 1,
			page:   1,
			limit:  10,
			setupMocks: func(fr *MockFunctionRepository, userID, offset, limit int) {
				// Setup List - should return a list of functions
				functions := []*models.Function{
					{
						ID:     1,
						UserID: userID,
						Name:   "function-1",
						Status: "active",
					},
					{
						ID:     2,
						UserID: userID,
						Name:   "function-2",
						Status: "active",
					},
				}
				fr.On("List", userID, offset, limit).Return(functions, nil)
			},
			expectedError: false,
			expectedCount: 2,
		},
		{
			name:   "EmptyList",
			userID: 1,
			page:   1,
			limit:  10,
			setupMocks: func(fr *MockFunctionRepository, userID, offset, limit int) {
				// Setup List - should return an empty list
				functions := []*models.Function{}
				fr.On("List", userID, offset, limit).Return(functions, nil)
			},
			expectedError: false,
			expectedCount: 0,
		},
		{
			name:   "DatabaseError",
			userID: 1,
			page:   1,
			limit:  10,
			setupMocks: func(fr *MockFunctionRepository, userID, offset, limit int) {
				// Setup List - should return an error
				fr.On("List", userID, offset, limit).Return([]*models.Function{}, errors.New("database error"))
			},
			expectedError: true,
			expectedCount: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockFunctionRepo := new(MockFunctionRepository)
			mockExecutionRepo := new(MockExecutionRepository)
			mockTEEManager := new(MockTEEManager)
			
			// Create a minimal config for testing
			cfg := &config.Config{
				Services: config.Services{
					Functions: config.FunctionsConfig{
						MaxSourceCodeSize: 1000000, // 1MB
					},
				},
				TEE: config.TEE{
					Runtime: config.Runtime{
						ExecutionTimeout: 10,
						JSMemoryLimit:    256,
					},
				},
			}
			
			// Create a logger
			log := logger.NewLogger("test")
			
			// Calculate offset
			offset := (tc.page - 1) * tc.limit
			
			// Setup mocks
			tc.setupMocks(mockFunctionRepo, tc.userID, offset, tc.limit)
			
			// Create function service with mocks
			service := functions.NewService(cfg, log, mockFunctionRepo, mockExecutionRepo, mockTEEManager)
			
			// Call method
			functions, err := service.ListFunctions(tc.userID, tc.page, tc.limit)
			
			// Check results
			if tc.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedCount, len(functions))
			}
			
			// Verify mock expectations
			mockFunctionRepo.AssertExpectations(t)
		})
	}
} 