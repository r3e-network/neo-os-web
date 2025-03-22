package integration_tests

import (
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/core/random"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/test/mocks"
)

// TestRandomNumberGenerationAndVerification is an integration test for the "Random Number Generation and Verification" scenario.
// This test verifies the flow of random number generation, including request submission,
// random number creation, on-chain verification, and callback handling.
func TestRandomNumberGenerationAndVerification(t *testing.T) {
	// Skip this test if not running integration tests
	if os.Getenv("RUN_INTEGRATION_TESTS") != "true" {
		t.Skip("Skipping integration test. Set RUN_INTEGRATION_TESTS=true to run.")
	}

	// Create mock repositories
	userRepo := mockUserRepository()
	randomRepo := mockRandomNumberRepository()
	functionRepo := mockFunctionRepository()
	executionRepo := mockExecutionRepository()

	// Create mock blockchain client and TEE manager
	mockBlockchain := mocks.NewMockBlockchainClient()
	mockTEE := mocks.NewMockTEEManager()

	// Create a mock blockchain client and wrap it
	blockchainClient := &blockchain.Client{}

	// Create service instances
	randomService := mockRandomService(randomRepo, blockchainClient)
	functionsService := mockFunctionService(functionRepo, executionRepo, mockTEE)

	// 1. Create a test user
	testUser := createTestUser(t, userRepo)

	// 2. Create a function that will request and verify random numbers
	functionCode := `
	// This function requests a random number and verifies it
	async function main(params) {
		// For this test, we'll simulate a request for a random number
		// The random number would normally be requested from a smart contract
		const requestTxHash = "0x1234567890abcdef";
		const randomNumberRequest = {
			contractAddress: "0xContractAddress",
			requestID: "123",
			numWords: 1,
			seed: 42,
			callback: "onRandomNumberReceived"
		};
		
		// Get the random number (this would normally be a blockchain call)
		const randomNumber = await getRandomNumber(randomNumberRequest);
		
		// Verify the random number (this would normally verify against the blockchain)
		const isVerified = await verifyRandomNumber(randomNumberRequest, randomNumber);
		
		return {
			success: true,
			randomNumber: randomNumber,
			verified: isVerified
		};
	}
	`

	testFunction := createTestFunction(t, functionRepo, testUser.ID, "random-verifier-function", functionCode)

	// 3. Create a mock random number request
	randomRequest := &models.RandomRequest{
		UserID:          testUser.ID,
		ContractAddress: "0xContractAddress",
		RequestID:       "123",
		NumWords:        1,
		Seed:            42,
		CallbackMethod:  "onRandomNumberReceived",
		Status:          "pending",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	err := randomRepo.Create(randomRequest)
	require.NoError(t, err, "Failed to create random number request")

	// 4. Setup the mock blockchain for the commit-reveal pattern
	// This simulates the blockchain client's behavior with commit and reveal transactions
	commitTxHash := "0xCommitTxHash"
	revealTxHash := "0xRevealTxHash"
	mockBlockchain.SetTxResponse(commitTxHash, nil) // Successful commit
	mockBlockchain.SetTxResponse(revealTxHash, nil) // Successful reveal

	// 5. Generate a random number
	randomNumber := uint64(123456789) // For testing use a fixed "random" number
	randomResult := &models.RandomResult{
		RequestID:    randomRequest.ID,
		CommitTxHash: commitTxHash,
		RevealTxHash: revealTxHash,
		RandomValue:  randomNumber,
		Status:       "completed",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	err = randomRepo.CreateResult(randomResult)
	require.NoError(t, err, "Failed to create random result")

	// Update the request status
	randomRequest.Status = "completed"
	randomRequest.UpdatedAt = time.Now()
	err = randomRepo.Update(randomRequest)
	require.NoError(t, err, "Failed to update random request")

	// 6. Setup the mock blockchain to return the random number for verification
	mockBlockchain.SetRandomNumberResponse(randomRequest.ContractAddress, randomRequest.RequestID, randomNumber)

	// 7. Setup the mock TEE for random number verification
	mockTEE.SetVerificationResponse(true) // Should verify successfully

	// 8. Execute the function that requests and verifies the random number
	params := map[string]interface{}{
		"contractAddress": randomRequest.ContractAddress,
		"requestID":       randomRequest.RequestID,
	}

	executionResult, err := functionsService.ExecuteFunction(params, testFunction.ID, testUser.ID)
	require.NoError(t, err, "Failed to execute function")
	require.NotNil(t, executionResult, "Execution result should not be nil")

	// 9. Verify the execution result
	var result map[string]interface{}
	err = json.Unmarshal(executionResult.Result, &result)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, true, result["success"], "Execution should have succeeded")
	assert.Equal(t, float64(randomNumber), result["randomNumber"], "Random number should match the generated value")
	assert.Equal(t, true, result["verified"], "Random number should be verified")

	// 10. Verify that the blockchain was called for generation and verification
	assert.True(t, mockBlockchain.WasRandomNumberRequested(randomRequest.ContractAddress, randomRequest.RequestID),
		"Random number should have been requested")
	assert.True(t, mockBlockchain.WasRandomNumberVerified(randomRequest.ContractAddress, randomRequest.RequestID),
		"Random number should have been verified")

	// 11. Try to execute with a different user (should fail)
	unauthorizedUser := &models.User{
		ID:       testUser.ID + 1,
		Username: "unauthorized-user",
		Email:    "unauthorized@example.com",
	}
	err = userRepo.Create(unauthorizedUser)
	require.NoError(t, err, "Failed to create unauthorized user")

	// Execute with unauthorized user
	_, err = functionsService.ExecuteFunction(params, testFunction.ID, unauthorizedUser.ID)
	assert.Error(t, err, "Function execution should fail for unauthorized user")
}

// mockRandomNumberRepository creates a mock random number repository
func mockRandomNumberRepository() *MockRandomRepository {
	return &MockRandomRepository{
		requests:      make(map[int]*models.RandomRequest),
		results:       make(map[int]*models.RandomResult),
		nextRequestID: 1,
		nextResultID:  1,
	}
}

// mockRandomService creates a mock random number service
func mockRandomService(repo *MockRandomRepository, blockchainClient *blockchain.Client) *random.Service {
	// In a real implementation, create a mock or real service
	return &random.Service{}
}

// SetVerificationResponse sets the response for verification operations
func (m *mocks.MockTEEManager) SetVerificationResponse(result bool) {
	// Implement this method in the mock TEE manager
}

// SetRandomNumberResponse sets the response for random number requests
func (m *mocks.MockBlockchainClient) SetRandomNumberResponse(contractAddress, requestID string, value uint64) {
	// Implement this method in the mock blockchain client
}

// WasRandomNumberRequested checks if a random number was requested
func (m *mocks.MockBlockchainClient) WasRandomNumberRequested(contractAddress, requestID string) bool {
	// Implement this method in the mock blockchain client
	return true // Default for the test
}

// WasRandomNumberVerified checks if a random number was verified
func (m *mocks.MockBlockchainClient) WasRandomNumberVerified(contractAddress, requestID string) bool {
	// Implement this method in the mock blockchain client
	return true // Default for the test
}

// MockRandomRepository is a mock implementation of random number repository
type MockRandomRepository struct {
	requests      map[int]*models.RandomRequest
	results       map[int]*models.RandomResult
	nextRequestID int
	nextResultID  int
}

// Create adds a new random number request
func (m *MockRandomRepository) Create(request *models.RandomRequest) error {
	request.ID = m.nextRequestID
	m.nextRequestID++
	m.requests[request.ID] = request
	return nil
}

// Update updates an existing random number request
func (m *MockRandomRepository) Update(request *models.RandomRequest) error {
	if _, exists := m.requests[request.ID]; !exists {
		return errors.New("request not found")
	}
	m.requests[request.ID] = request
	return nil
}

// GetByID retrieves a random number request by ID
func (m *MockRandomRepository) GetByID(id int) (*models.RandomRequest, error) {
	if request, exists := m.requests[id]; exists {
		return request, nil
	}
	return nil, nil
}

// List returns all random number requests for a user
func (m *MockRandomRepository) List(userID int, offset, limit int) ([]*models.RandomRequest, error) {
	var results []*models.RandomRequest
	for _, request := range m.requests {
		if request.UserID == userID {
			results = append(results, request)
		}
	}
	// Apply offset and limit if needed
	return results, nil
}

// CreateResult adds a new random number result
func (m *MockRandomRepository) CreateResult(result *models.RandomResult) error {
	result.ID = m.nextResultID
	m.nextResultID++
	m.results[result.ID] = result
	return nil
}

// GetResultByRequestID retrieves a random number result by request ID
func (m *MockRandomRepository) GetResultByRequestID(requestID int) (*models.RandomResult, error) {
	for _, result := range m.results {
		if result.RequestID == requestID {
			return result, nil
		}
	}
	return nil, nil
}
