package oracle

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/core/oracle"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockCoreOracleService is a mock implementation of the core Oracle service
type MockCoreOracleService struct {
	mock.Mock
}

func (m *MockCoreOracleService) CreateDataSource(name string, url string, method string, headers string,
	contractScript string, dataPath string, transformScript string, updateInterval int) (*models.OracleDataSource, error) {
	args := m.Called(name, url, method, headers, contractScript, dataPath, transformScript, updateInterval)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleDataSource), args.Error(1)
}

func (m *MockCoreOracleService) GetDataSource(id string) (*models.OracleDataSource, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleDataSource), args.Error(1)
}

func (m *MockCoreOracleService) UpdateDataSource(id string, url string, method string, headers string,
	contractScript string, dataPath string, transformScript string, updateInterval int, active bool) (*models.OracleDataSource, error) {
	args := m.Called(id, url, method, headers, contractScript, dataPath, transformScript, updateInterval, active)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleDataSource), args.Error(1)
}

func (m *MockCoreOracleService) DeleteDataSource(id string) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockCoreOracleService) ListDataSources() ([]*models.OracleDataSource, error) {
	args := m.Called()
	return args.Get(0).([]*models.OracleDataSource), args.Error(1)
}

func (m *MockCoreOracleService) TriggerUpdate(dataSourceID string) error {
	args := m.Called(dataSourceID)
	return args.Error(0)
}

func (m *MockCoreOracleService) GetLatestData(dataSourceID string) (string, error) {
	args := m.Called(dataSourceID)
	return args.String(0), args.Error(1)
}

func (m *MockCoreOracleService) GetDataHistory(dataSourceID string, limit int) ([]*models.OracleUpdate, error) {
	args := m.Called(dataSourceID, limit)
	return args.Get(0).([]*models.OracleUpdate), args.Error(1)
}

func (m *MockCoreOracleService) CreateRequest(userID int, oracleID int, callbackAddress string, callbackMethod string) (*models.OracleRequest, error) {
	args := m.Called(userID, oracleID, callbackAddress, callbackMethod)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleRequest), args.Error(1)
}

func (m *MockCoreOracleService) GetRequest(id int) (*models.OracleRequest, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.OracleRequest), args.Error(1)
}

func (m *MockCoreOracleService) CancelRequest(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockCoreOracleService) ListRequests(userID int, offset int, limit int) ([]*models.OracleRequest, error) {
	args := m.Called(userID, offset, limit)
	return args.Get(0).([]*models.OracleRequest), args.Error(1)
}

func (m *MockCoreOracleService) CreateOracle(name string, description string, oracleType models.OracleDataSourceType,
	url string, method string, headers models.JsonMap, body string, authType models.OracleAuthType,
	authParams models.JsonMap, path string, transform string, schedule string, userID int) (*models.Oracle, error) {
	args := m.Called(name, description, oracleType, url, method, headers, body, authType, authParams, path, transform, schedule, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockCoreOracleService) UpdateOracle(id int, name string, description string, active bool) (*models.Oracle, error) {
	args := m.Called(id, name, description, active)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockCoreOracleService) GetOracle(id int) (*models.Oracle, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Oracle), args.Error(1)
}

func (m *MockCoreOracleService) ListOracles(userID int, offset int, limit int) ([]*models.Oracle, error) {
	args := m.Called(userID, offset, limit)
	return args.Get(0).([]*models.Oracle), args.Error(1)
}

func (m *MockCoreOracleService) DeleteOracle(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockCoreOracleService) Start() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockCoreOracleService) Stop() {
	m.Called()
}

// Test helper functions
func setupWrapperTest(t *testing.T) (*Wrapper, *MockCoreOracleService) {
	mockCoreService := new(MockCoreOracleService)
	wrapper := NewWrapper(mockCoreService)
	return wrapper, mockCoreService
}

// Test cases
func TestWrapperCreateDataSource(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup test parameters
	name := "Weather API"
	url := "https://api.example.com/weather"
	method := "GET"
	headers := "{\"Content-Type\": \"application/json\"}"
	contractScript := "function process(data) { return data.temperature; }"
	dataPath := "$.main.temp"
	transformScript := "function transform(data) { return data * 9/5 + 32; }"
	updateInterval := 300

	// Setup expected result
	expectedDataSource := &models.OracleDataSource{
		ID:              "ds123",
		Name:            name,
		URL:             url,
		Method:          method,
		Headers:         headers,
		ContractScript:  contractScript,
		DataPath:        dataPath,
		TransformScript: transformScript,
		UpdateInterval:  updateInterval,
		Active:          true,
	}

	// Setup mock expectations
	mockCoreService.On("CreateDataSource",
		name, url, method, headers, contractScript, dataPath, transformScript, updateInterval,
	).Return(expectedDataSource, nil)

	// Call the wrapper method
	result, err := wrapper.CreateDataSource(ctx, name, url, method, headers, contractScript, dataPath, transformScript, updateInterval)

	// Assert expectations
	assert.NoError(t, err)
	assert.Equal(t, expectedDataSource, result)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperGetLatestData(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup test parameters
	dataSourceID := "ds123"
	expectedData := "{\"temperature\": 72.5, \"humidity\": 45.0}"

	// Setup mock expectations
	mockCoreService.On("GetLatestData", dataSourceID).Return(expectedData, nil)

	// Call the wrapper method
	data, err := wrapper.GetLatestData(ctx, dataSourceID)

	// Assert expectations
	assert.NoError(t, err)
	assert.Equal(t, expectedData, data)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperCreateOracle(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup test parameters
	name := "Weather Oracle"
	description := "Provides real-time weather data"
	oracleType := models.OracleDataSourceTypeREST
	url := "https://api.example.com/weather"
	method := "GET"
	headers := models.JsonMap{"Content-Type": "application/json"}
	body := ""
	authType := models.OracleAuthTypeAPIKey
	authParams := models.JsonMap{"key": "api-key-123"}
	path := "$.main"
	transform := "function transform(data) { return data; }"
	schedule := "*/15 * * * *"
	userID := 1

	// Setup expected result
	expectedOracle := &models.Oracle{
		ID:          1,
		Name:        name,
		Description: description,
		UserID:      userID,
		Active:      true,
	}

	// Setup mock expectations
	mockCoreService.On("CreateOracle",
		name, description, oracleType, url, method, headers, body, authType,
		authParams, path, transform, schedule, userID,
	).Return(expectedOracle, nil)

	// Call the wrapper method
	result, err := wrapper.CreateOracle(ctx, name, description, oracleType, url, method, headers, body, authType,
		authParams, path, transform, schedule, userID)

	// Assert expectations
	assert.NoError(t, err)
	assert.Equal(t, expectedOracle, result)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperTriggerUpdate(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup test parameters
	dataSourceID := "ds123"

	// Setup mock expectations
	mockCoreService.On("TriggerUpdate", dataSourceID).Return(nil)

	// Call the wrapper method
	err := wrapper.TriggerUpdate(ctx, dataSourceID)

	// Assert expectations
	assert.NoError(t, err)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperStartAndStop(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup mock expectations
	mockCoreService.On("Start").Return(nil)
	mockCoreService.On("Stop").Return()

	// Call the wrapper methods
	err := wrapper.Start(ctx)
	assert.NoError(t, err)

	err = wrapper.Stop(ctx)
	assert.NoError(t, err)

	// Assert expectations
	mockCoreService.AssertExpectations(t)
}