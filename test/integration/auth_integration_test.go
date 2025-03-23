package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/api"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/auth"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock repositories and services
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(user *models.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserRepository) GetByID(id int) (*models.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByUsername(username string) (*models.User, error) {
	args := m.Called(username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(email string) (*models.User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByAPIKey(apiKey string) (*models.User, error) {
	args := m.Called(apiKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Update(user *models.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockUserRepository) List(offset, limit int) ([]*models.User, error) {
	args := m.Called(offset, limit)
	return args.Get(0).([]*models.User), args.Error(1)
}

type MockFunctionService struct {
	mock.Mock
}

func (m *MockFunctionService) CreateFunction(userID int, function *models.Function) error {
	args := m.Called(userID, function)
	return args.Error(0)
}

func (m *MockFunctionService) GetFunction(userID, functionID int) (*models.Function, error) {
	args := m.Called(userID, functionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Function), args.Error(1)
}

func (m *MockFunctionService) UpdateFunction(userID int, function *models.Function) error {
	args := m.Called(userID, function)
	return args.Error(0)
}

func (m *MockFunctionService) DeleteFunction(userID, functionID int) error {
	args := m.Called(userID, functionID)
	return args.Error(0)
}

func (m *MockFunctionService) ListFunctions(userID int) ([]*models.Function, error) {
	args := m.Called(userID)
	return args.Get(0).([]*models.Function), args.Error(1)
}

func (m *MockFunctionService) ExecuteFunction(userID, functionID int, params map[string]interface{}) (interface{}, error) {
	args := m.Called(userID, functionID, params)
	return args.Get(0), args.Error(1)
}

// Setup test server with authentication middleware
func setupTestServer() (*httptest.Server, *auth.Service, *MockUserRepository, *MockFunctionService) {
	// Create logger
	log := logger.NewLogger("test", "debug")

	// Create config
	cfg := &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:         "super-secure-jwt-secret-that-is-at-least-32-bytes-long",
			TokenExpiry:       3600,
			RefreshTokenExpiry: 86400,
		},
	}

	// Create mock repositories and services
	mockUserRepo := new(MockUserRepository)
	mockFunctionService := new(MockFunctionService)

	// Create auth service
	authService := auth.NewService(cfg, log, mockUserRepo)

	// Setup Gin router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Create API server with mock dependencies
	server := &api.Server{
		Config:          cfg,
		Logger:          log,
		Router:          router,
		UserRepository:  mockUserRepo,
		AuthService:     authService,
		FunctionService: mockFunctionService,
	}

	// Configure routes with JWT middleware
	router.POST("/auth/login", server.loginHandler)
	
	// Protected routes
	protected := router.Group("/")
	protected.Use(server.authMiddleware())
	{
		// Functions API (as an example of a protected service)
		functions := protected.Group("/functions")
		{
			functions.GET("", server.listFunctionsHandler)
			functions.POST("", server.createFunctionHandler)
			functions.GET("/:id", server.getFunctionHandler)
			functions.PUT("/:id", server.updateFunctionHandler)
			functions.DELETE("/:id", server.deleteFunctionHandler)
			functions.POST("/:id/execute", server.executeFunctionHandler)
		}
	}

	// Create test server
	testServer := httptest.NewServer(router)

	return testServer, authService, mockUserRepo, mockFunctionService
}

// Helper to create a test user
func createTestUser() *models.User {
	user := &models.User{
		ID:        1,
		Username:  "testuser",
		Email:     "test@example.com",
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	// Set a known password for testing
	_ = user.SetPassword("password123")
	
	return user
}

// Helper to get a JWT token for testing
func getJWTToken(t *testing.T, server *httptest.Server, username, password string) string {
	// Login request
	loginReq := api.LoginRequest{
		UsernameOrEmail: username,
		Password:        password,
	}
	reqBody, err := json.Marshal(loginReq)
	require.NoError(t, err)

	// Make login request
	resp, err := http.Post(fmt.Sprintf("%s/auth/login", server.URL), "application/json", bytes.NewBuffer(reqBody))
	require.NoError(t, err)
	defer resp.Body.Close()

	// Parse response
	var loginResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&loginResp)
	require.NoError(t, err)

	// Extract token
	data := loginResp["data"].(map[string]interface{})
	token := data["access_token"].(string)
	return token
}

// Test JWT authentication across protected services
func TestJWTAuthenticationAcrossServices(t *testing.T) {
	// Setup
	server, _, mockUserRepo, mockFunctionService := setupTestServer()
	defer server.Close()

	// Create test user
	testUser := createTestUser()
	mockUserRepo.On("GetByUsername", "testuser").Return(testUser, nil)
	mockUserRepo.On("GetByEmail", "test@example.com").Return(testUser, nil)
	mockUserRepo.On("GetByID", 1).Return(testUser, nil)

	// Setup function service mocks
	mockFunctions := []*models.Function{
		{ID: 1, UserID: 1, Name: "TestFunction1"},
		{ID: 2, UserID: 1, Name: "TestFunction2"},
	}
	mockFunctionService.On("ListFunctions", 1).Return(mockFunctions, nil)

	// Get JWT token
	token := getJWTToken(t, server, "testuser", "password123")
	require.NotEmpty(t, token)

	// Test accessing protected service with valid token
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/functions", server.URL), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Verify successful response
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Protected endpoint should accept valid token")

	var listResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&listResp)
	require.NoError(t, err)
	assert.True(t, listResp["success"].(bool), "Response should indicate success")

	// Test accessing protected service without token
	req, _ = http.NewRequest("GET", fmt.Sprintf("%s/functions", server.URL), nil)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Verify unauthorized response
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Protected endpoint should reject request without token")

	// Test accessing protected service with invalid token
	req, _ = http.NewRequest("GET", fmt.Sprintf("%s/functions", server.URL), nil)
	req.Header.Set("Authorization", "Bearer invalid.token.here")
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Verify unauthorized response
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Protected endpoint should reject invalid token")

	// Test accessing protected service with expired token
	expiredClaims := &auth.Claims{
		UserID:   1,
		Username: "testuser",
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(-time.Hour).Unix(), // Expired 1 hour ago
			IssuedAt:  time.Now().Add(-2 * time.Hour).Unix(),
			Issuer:    "service_layer",
		},
	}
	expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
	expiredTokenString, _ := expiredToken.SignedString([]byte("super-secure-jwt-secret-that-is-at-least-32-bytes-long"))

	req, _ = http.NewRequest("GET", fmt.Sprintf("%s/functions", server.URL), nil)
	req.Header.Set("Authorization", "Bearer "+expiredTokenString)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Verify unauthorized response
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Protected endpoint should reject expired token")

	// Test with malformed Authorization header
	req, _ = http.NewRequest("GET", fmt.Sprintf("%s/functions", server.URL), nil)
	req.Header.Set("Authorization", "NotBearer "+token)
	resp, err = client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Verify unauthorized response
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Protected endpoint should reject malformed Authorization header")
}

// Test different services with the same JWT token
func TestJWTConsistencyAcrossServices(t *testing.T) {
	// Setup 
	server, _, mockUserRepo, mockFunctionService := setupTestServer()
	defer server.Close()

	// Create test user
	testUser := createTestUser()
	mockUserRepo.On("GetByUsername", "testuser").Return(testUser, nil)
	mockUserRepo.On("GetByEmail", "test@example.com").Return(testUser, nil)
	mockUserRepo.On("GetByID", 1).Return(testUser, nil)

	// Setup function service mocks
	mockFunction := &models.Function{ID: 1, UserID: 1, Name: "TestFunction1"}
	mockFunctions := []*models.Function{mockFunction}
	
	mockFunctionService.On("ListFunctions", 1).Return(mockFunctions, nil)
	mockFunctionService.On("GetFunction", 1, 1).Return(mockFunction, nil)
	mockFunctionService.On("ExecuteFunction", 1, 1, mock.Anything).Return("function result", nil)

	// Get JWT token
	token := getJWTToken(t, server, "testuser", "password123")
	require.NotEmpty(t, token)

	// Create HTTP client
	client := &http.Client{}

	// Test list functions endpoint
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/functions", server.URL), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// Test get function endpoint
	req, _ = http.NewRequest("GET", fmt.Sprintf("%s/functions/1", server.URL), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err = client.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// Test execute function endpoint
	executeReq := map[string]interface{}{
		"params": map[string]interface{}{
			"input": "test",
		},
	}
	reqBody, _ := json.Marshal(executeReq)
	req, _ = http.NewRequest("POST", fmt.Sprintf("%s/functions/1/execute", server.URL), bytes.NewBuffer(reqBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()

	// Verify all mocks were called - this ensures JWT authentication worked consistently across all endpoints
	mockUserRepo.AssertExpectations(t)
	mockFunctionService.AssertExpectations(t)
}