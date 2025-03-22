package integration_tests

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/secrets"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/R3E-Network/service_layer/test/mocks"
)

// TestSecureDataProcessingWithSecrets is an integration test for the "Secure Data Processing with Secrets" scenario.
// This test verifies that a function can securely access secrets, process data, and store results within the TEE.
func TestSecureDataProcessingWithSecrets(t *testing.T) {
	// Skip this test if not running integration tests
	if os.Getenv("RUN_INTEGRATION_TESTS") != "true" {
		t.Skip("Skipping integration test. Set RUN_INTEGRATION_TESTS=true to run.")
	}

	// Setup test environment
	log := logger.New("integration-test")

	// Create test configuration
	cfg := &config.Config{
		Features: config.Features{
			Functions: true,
			Secrets:   true,
		},
	}

	// Create mock repositories
	userRepo := mockUserRepository()
	functionRepo := mockFunctionRepository()
	executionRepo := mockExecutionRepository()
	secretRepo := mockSecretRepository()

	// Create mock TEE manager
	mockTEE := mocks.NewMockTEEManager()

	// Create service instances
	functionsService := mockFunctionService(functionRepo, executionRepo, mockTEE)
	secretsService := mockSecretsService(secretRepo, mockTEE)

	// 1. Create a test user
	testUser := createTestUser(t, userRepo)

	// 2. Store API credentials as secrets
	apiKeySecret := &models.Secret{
		UserID:      testUser.ID,
		Name:        "api-key",
		Description: "API key for external service",
		Type:        "api-key",
	}

	apiKeyValue := "12345abcdef-api-key"
	err := secretsService.CreateSecret(testUser.ID, apiKeySecret.Name, apiKeySecret.Description, apiKeySecret.Type, apiKeyValue)
	require.NoError(t, err, "Failed to create API key secret")

	apiSecretSecret := &models.Secret{
		UserID:      testUser.ID,
		Name:        "api-secret",
		Description: "API secret for external service",
		Type:        "api-secret",
	}

	apiSecretValue := "67890ghijkl-api-secret"
	err = secretsService.CreateSecret(testUser.ID, apiSecretSecret.Name, apiSecretSecret.Description, apiSecretSecret.Type, apiSecretValue)
	require.NoError(t, err, "Failed to create API secret secret")

	// 3. Create a function that accesses these secrets and processes data
	functionCode := `
	// This function retrieves and uses secrets to authenticate with an external API
	async function main(params) {
		// Get API credentials from secrets
		const apiKey = await getSecret("api-key");
		const apiSecret = await getSecret("api-secret");
		
		if (!apiKey || !apiSecret) {
			throw new Error("Failed to retrieve API credentials");
		}
		
		// In a real scenario, we would use the credentials to call an external API
		// For this test, we'll simulate a successful API call with mock data
		const mockApiResponse = {
			data: [
				{ id: 1, value: 42 },
				{ id: 2, value: 84 },
				{ id: 3, value: 126 }
			]
		};
		
		// Process the data securely within the TEE
		const processedData = mockApiResponse.data.map(item => ({
			id: item.id,
			normalizedValue: item.value / 42
		}));
		
		// Return results
		return {
			success: true,
			secretsAccessed: ["api-key", "api-secret"],
			processedData: processedData
		};
	}
	`

	testFunction := createTestFunction(t, functionRepo, testUser.ID, "secure-data-processor", functionCode)

	// 4. Setup the mock TEE to return the secrets when requested
	mockTEE.SetSecretValue(testUser.ID, "api-key", apiKeyValue)
	mockTEE.SetSecretValue(testUser.ID, "api-secret", apiSecretValue)

	// 5. Execute the function
	params := map[string]interface{}{
		"userID": testUser.ID,
	}

	executionResult, err := functionsService.ExecuteFunction(params, testFunction.ID, testUser.ID, false)
	require.NoError(t, err, "Failed to execute function")
	require.NotNil(t, executionResult, "Execution result should not be nil")

	// 6. Verify the function had access to the secrets
	secretOperations := mockTEE.GetSecretOperations(testUser.ID, "api-key")
	assert.Contains(t, secretOperations, "get", "The api-key secret should have been accessed")

	secretOperations = mockTEE.GetSecretOperations(testUser.ID, "api-secret")
	assert.Contains(t, secretOperations, "get", "The api-secret secret should have been accessed")

	// 7. Verify the execution result contains the processed data
	var result map[string]interface{}
	err = json.Unmarshal(executionResult.Result, &result)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, true, result["success"], "Execution should have succeeded")
	assert.Contains(t, result, "secretsAccessed", "Result should contain secretsAccessed field")
	assert.Contains(t, result, "processedData", "Result should contain processedData field")

	// 8. Verify the secrets were accessed securely
	secretsAccessed, ok := result["secretsAccessed"].([]interface{})
	require.True(t, ok, "secretsAccessed should be an array")
	assert.Contains(t, secretsAccessed, "api-key", "api-key should be in accessed secrets")
	assert.Contains(t, secretsAccessed, "api-secret", "api-secret should be in accessed secrets")

	// 9. Verify the data was processed correctly
	processedData, ok := result["processedData"].([]interface{})
	require.True(t, ok, "processedData should be an array")
	require.Len(t, processedData, 3, "processedData should contain 3 items")

	// Check the first item
	firstItem, ok := processedData[0].(map[string]interface{})
	require.True(t, ok, "First item should be an object")
	assert.Equal(t, float64(1), firstItem["id"], "First item should have id 1")
	assert.Equal(t, float64(1), firstItem["normalizedValue"], "First item should have normalizedValue 1")

	// 10. Try to execute the function with a different user (should fail to access secrets)
	unauthorizedUser := &models.User{
		ID:       testUser.ID + 1,
		Username: "unauthorized-user",
		Email:    "unauthorized@example.com",
	}
	err = userRepo.Create(unauthorizedUser)
	require.NoError(t, err, "Failed to create unauthorized user")

	// Execute with unauthorized user
	_, err = functionsService.ExecuteFunction(params, testFunction.ID, unauthorizedUser.ID, false)
	assert.Error(t, err, "Function execution should fail for unauthorized user")
}

// Mock function for secrets service
func mockSecretsService(repo models.SecretRepository, teeManager *mocks.MockTEEManager) *secrets.Service {
	// In a real implementation, create a mock or real service
	return &secrets.MockService{
		Repo:       repo,
		TeeManager: teeManager,
	}
}

// MockSecretRepository is a mock implementation of the secret repository
type MockSecretRepository struct {
	secrets map[int]map[string]*models.Secret
	nextID  int
}

// Create adds a new secret to the repository
func (m *MockSecretRepository) Create(secret *models.Secret) error {
	secret.ID = m.nextID
	m.nextID++

	if _, exists := m.secrets[secret.UserID]; !exists {
		m.secrets[secret.UserID] = make(map[string]*models.Secret)
	}

	m.secrets[secret.UserID][secret.Name] = secret
	return nil
}

// GetByID retrieves a secret by ID
func (m *MockSecretRepository) GetByID(id int) (*models.Secret, error) {
	for _, userSecrets := range m.secrets {
		for _, secret := range userSecrets {
			if secret.ID == id {
				return secret, nil
			}
		}
	}
	return nil, nil
}

// GetByUserIDAndName retrieves a secret by user ID and name
func (m *MockSecretRepository) GetByUserIDAndName(userID int, name string) (*models.Secret, error) {
	if userSecrets, exists := m.secrets[userID]; exists {
		if secret, exists := userSecrets[name]; exists {
			return secret, nil
		}
	}
	return nil, nil
}

// List returns all secrets for a user
func (m *MockSecretRepository) List(userID int, offset, limit int) ([]*models.Secret, error) {
	var results []*models.Secret

	if userSecrets, exists := m.secrets[userID]; exists {
		for _, secret := range userSecrets {
			results = append(results, secret)
		}
	}

	// Apply offset and limit if needed
	return results, nil
}

// Update updates an existing secret
func (m *MockSecretRepository) Update(secret *models.Secret) error {
	if _, exists := m.secrets[secret.UserID]; !exists {
		return nil
	}

	if _, exists := m.secrets[secret.UserID][secret.Name]; !exists {
		return nil
	}

	m.secrets[secret.UserID][secret.Name] = secret
	return nil
}

// Delete removes a secret
func (m *MockSecretRepository) Delete(id int) error {
	for userID, userSecrets := range m.secrets {
		for name, secret := range userSecrets {
			if secret.ID == id {
				delete(m.secrets[userID], name)
				return nil
			}
		}
	}
	return nil
}

// mockSecretRepository creates a mock secret repository
func mockSecretRepository() models.SecretRepository {
	return &MockSecretRepository{
		secrets: make(map[int]map[string]*models.Secret),
		nextID:  1,
	}
}

// MockService is a mock implementation of the secrets service
type MockService struct {
	Repo       models.SecretRepository
	TeeManager *mocks.MockTEEManager
}

// CreateSecret creates a new secret and stores it securely
func (s *MockService) CreateSecret(userID int, name, description, secretType, value string) error {
	secret := &models.Secret{
		UserID:      userID,
		Name:        name,
		Description: description,
		Type:        secretType,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := s.Repo.Create(secret)
	if err != nil {
		return err
	}

	// Store in the mock TEE
	err = s.TeeManager.StoreSecret(userID, name, value)
	if err != nil {
		return err
	}

	return nil
}

// GetSecret retrieves a secret by ID
func (s *secrets.MockService) GetSecret(userID, secretID int) (*models.Secret, error) {
	return s.Repo.GetByID(secretID)
}

// GetSecretByName retrieves a secret by name
func (s *secrets.MockService) GetSecretByName(userID int, name string) (*models.Secret, error) {
	return s.Repo.GetByUserIDAndName(userID, name)
}

// ListSecrets returns all secrets for a user
func (s *secrets.MockService) ListSecrets(userID, page, limit int) ([]*models.Secret, error) {
	offset := (page - 1) * limit
	return s.Repo.List(userID, offset, limit)
}

// UpdateSecret updates a secret
func (s *secrets.MockService) UpdateSecret(userID, secretID int, name, description, secretType, value string) error {
	secret, err := s.Repo.GetByID(secretID)
	if err != nil || secret == nil {
		return err
	}

	secret.Name = name
	secret.Description = description
	secret.Type = secretType
	secret.UpdatedAt = time.Now()

	err = s.Repo.Update(secret)
	if err != nil {
		return err
	}

	// Update in the mock TEE
	if value != "" {
		err = s.TeeManager.StoreSecret(userID, name, value)
		if err != nil {
			return err
		}
	}

	return nil
}

// DeleteSecret deletes a secret
func (s *secrets.MockService) DeleteSecret(userID, secretID int) error {
	secret, err := s.Repo.GetByID(secretID)
	if err != nil || secret == nil {
		return err
	}

	err = s.Repo.Delete(secretID)
	if err != nil {
		return err
	}

	// Delete from the mock TEE
	err = s.TeeManager.DeleteSecret(userID, secret.Name)
	if err != nil {
		return err
	}

	return nil
}
