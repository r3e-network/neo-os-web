package integration_tests

import (
	"encoding/json"
	"errors"
	"os"
	"testing"

	"github.com/R3E-Network/service_layer/internal/core/oracle"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/test/mocks"
)

// TestCrossServiceErrorHandling is an integration test for the "Cross-Service Error Handling" scenario.
// This test verifies that errors are properly propagated and handled between services.
func TestCrossServiceErrorHandling(t *testing.T) {
	// Skip this test if not running integration tests
	if os.Getenv("RUN_INTEGRATION_TESTS") != "true" {
		t.Skip("Skipping integration test. Set RUN_INTEGRATION_TESTS=true to run.")
	}

	// Create mock repositories
	userRepo := mockUserRepository()
	functionRepo := mockFunctionRepository()
	executionRepo := mockExecutionRepository()
	oracleRepo := mockOracleRepository()
	randomRepo := mockRandomNumberRepository()

	// Create mock TEE manager and blockchain client
	mockTEE := mocks.NewMockTEEManager()
	mockBlockchain := mocks.NewMockBlockchainClient()

	// Create service instances
	functionsService := mockFunctionService(functionRepo, executionRepo, mockTEE)
	oracleService := mockOracleService(oracleRepo, mockBlockchain)
	randomService := mockRandomService(randomRepo, mockBlockchain)

	// 1. Create a test user
	testUser := createTestUser(t, userRepo)

	// 2. Test case: Function execution with Oracle service error
	// 2.1 Create a function that depends on Oracle data
	oracleErrorFunctionCode := `
	// This function tries to fetch data from an Oracle that will fail
	async function main(params) {
		try {
			// Attempt to get data from a non-existent Oracle data source
			const oracleData = await fetchOracleData("non-existent-source");
			
			// We shouldn't get here
			return {
				success: true,
				data: oracleData
			};
		} catch (error) {
			// We should catch the error here
			return {
				success: false,
				error: error.message,
				errorSource: "oracle"
			};
		}
	}
	`

	oracleErrorFunction := createTestFunction(t, functionRepo, testUser.ID, "oracle-error-function", oracleErrorFunctionCode)

	// 2.2 Configure the TEE mock to throw an error for the non-existent Oracle data source
	mockTEE.SetOracleErrorResponse("non-existent-source", errors.New("oracle data source not found"))

	// 2.3 Execute the function and check if it properly handles the Oracle error
	oracleErrorParams := map[string]interface{}{}
	oracleErrorExecution, err := functionsService.ExecuteFunction(oracleErrorParams, oracleErrorFunction.ID, testUser.ID)
	require.NoError(t, err, "Function should execute but with Oracle error inside")
	require.NotNil(t, oracleErrorExecution, "Execution result should not be nil")

	// 2.4 Verify the error is properly caught and reported
	var oracleErrorResult map[string]interface{}
	err = json.Unmarshal(oracleErrorExecution.Result, &oracleErrorResult)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, false, oracleErrorResult["success"], "Execution should report failure")
	assert.Contains(t, oracleErrorResult["error"], "oracle data source not found", "Error message should be included")
	assert.Equal(t, "oracle", oracleErrorResult["errorSource"], "Error source should be identified")

	// 3. Test case: Function execution with Random service error
	// 3.1 Create a function that depends on Random Number service
	randomErrorFunctionCode := `
	// This function tries to get a random number that will fail
	async function main(params) {
		try {
			// Attempt to get a random number that will fail
			const randomRequest = {
				contractAddress: "0xFailingContract",
				requestID: "fail123",
				numWords: 1,
				seed: 42,
				callback: "onRandomNumberReceived"
			};
			
			const randomNumber = await getRandomNumber(randomRequest);
			
			// We shouldn't get here
			return {
				success: true,
				randomNumber: randomNumber
			};
		} catch (error) {
			// We should catch the error here
			return {
				success: false,
				error: error.message,
				errorSource: "random"
			};
		}
	}
	`

	randomErrorFunction := createTestFunction(t, functionRepo, testUser.ID, "random-error-function", randomErrorFunctionCode)

	// 3.2 Configure the blockchain mock to throw an error for the random number
	mockBlockchain.SetRandomNumberError("0xFailingContract", "fail123", errors.New("random number generation failed"))

	// 3.3 Execute the function and check if it properly handles the Random service error
	randomErrorParams := map[string]interface{}{}
	randomErrorExecution, err := functionsService.ExecuteFunction(randomErrorParams, randomErrorFunction.ID, testUser.ID)
	require.NoError(t, err, "Function should execute but with Random service error inside")
	require.NotNil(t, randomErrorExecution, "Execution result should not be nil")

	// 3.4 Verify the error is properly caught and reported
	var randomErrorResult map[string]interface{}
	err = json.Unmarshal(randomErrorExecution.Result, &randomErrorResult)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, false, randomErrorResult["success"], "Execution should report failure")
	assert.Contains(t, randomErrorResult["error"], "random number generation failed", "Error message should be included")
	assert.Equal(t, "random", randomErrorResult["errorSource"], "Error source should be identified")

	// 4. Test case: Authentication/Authorization error
	// 4.1 Try to execute a function with a non-existent user
	nonExistentUserID := testUser.ID + 100 // A user ID that doesn't exist
	_, err = functionsService.ExecuteFunction(oracleErrorParams, oracleErrorFunction.ID, nonExistentUserID)
	assert.Error(t, err, "Function execution should fail with non-existent user")
	assert.Contains(t, err.Error(), "user not found", "Error should mention user not found")

	// 4.2 Try to execute a function with a user that doesn't own it
	unauthorizedUser := &models.User{
		ID:       testUser.ID + 1,
		Username: "unauthorized-user",
		Email:    "unauthorized@example.com",
	}
	err = userRepo.Create(unauthorizedUser)
	require.NoError(t, err, "Failed to create unauthorized user")

	_, err = functionsService.ExecuteFunction(oracleErrorParams, oracleErrorFunction.ID, unauthorizedUser.ID)
	assert.Error(t, err, "Function execution should fail with unauthorized user")
	assert.Contains(t, err.Error(), "not authorized", "Error should mention not authorized")

	// 5. Test case: Transaction error propagation
	// 5.1 Create a function that tries to call a blockchain contract that will fail
	txErrorFunctionCode := `
	// This function tries to call a blockchain contract that will fail
	async function main(params) {
		try {
			// Attempt to update a contract that will fail
			const txHash = await updateOnChain("FailingContract", "updateData", ["test"]);
			
			// We shouldn't get here
			return {
				success: true,
				txHash: txHash
			};
		} catch (error) {
			// We should catch the error here
			return {
				success: false,
				error: error.message,
				errorSource: "blockchain"
			};
		}
	}
	`

	txErrorFunction := createTestFunction(t, functionRepo, testUser.ID, "tx-error-function", txErrorFunctionCode)

	// 5.2 Configure the blockchain mock to throw an error for the contract call
	mockBlockchain.SetContractMethodError("FailingContract", "updateData", errors.New("contract execution failed"))

	// 5.3 Execute the function and check if it properly handles the blockchain error
	txErrorParams := map[string]interface{}{}
	txErrorExecution, err := functionsService.ExecuteFunction(txErrorParams, txErrorFunction.ID, testUser.ID)
	require.NoError(t, err, "Function should execute but with blockchain error inside")
	require.NotNil(t, txErrorExecution, "Execution result should not be nil")

	// 5.4 Verify the error is properly caught and reported
	var txErrorResult map[string]interface{}
	err = json.Unmarshal(txErrorExecution.Result, &txErrorResult)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, false, txErrorResult["success"], "Execution should report failure")
	assert.Contains(t, txErrorResult["error"], "contract execution failed", "Error message should be included")
	assert.Equal(t, "blockchain", txErrorResult["errorSource"], "Error source should be identified")

	// 6. Test case: System-level error handling
	// 6.1 Create a function that will cause a system-level error (timeout)
	timeoutFunctionCode := `
	// This function will timeout
	async function main(params) {
		try {
			// Attempt an operation that will timeout
			await new Promise((resolve, reject) => {
				setTimeout(() => {
					resolve("This should timeout before resolving");
				}, 10000); // 10 seconds, which is longer than the timeout limit
			});
			
			// We shouldn't get here
			return {
				success: true
			};
		} catch (error) {
			// In this case, the timeout error might be caught by the runtime
			// before this catch block, resulting in a different error in the execution result
			return {
				success: false,
				error: error.message,
				errorSource: "timeout"
			};
		}
	}
	`

	timeoutFunction := createTestFunction(t, functionRepo, testUser.ID, "timeout-function", timeoutFunctionCode)

	// 6.2 Configure the TEE mock to simulate a timeout
	mockTEE.SetTimeoutSimulation(true)

	// 6.3 Execute the function and check for timeout error
	timeoutParams := map[string]interface{}{}
	_, err = functionsService.ExecuteFunction(timeoutParams, timeoutFunction.ID, testUser.ID)
	assert.Error(t, err, "Function execution should fail with timeout")
	assert.Contains(t, err.Error(), "execution timeout", "Error should mention execution timeout")

	// 7. Verify error logging
	// After these test cases, we should verify that errors were properly logged
	logs := executionRepo.GetErrorLogs()
	assert.NotEmpty(t, logs, "Error logs should not be empty")

	foundOracleError := false
	foundRandomError := false
	foundTxError := false
	foundTimeoutError := false

	for _, log := range logs {
		if log.FunctionID == oracleErrorFunction.ID && log.ErrorType == "oracle" {
			foundOracleError = true
		}
		if log.FunctionID == randomErrorFunction.ID && log.ErrorType == "random" {
			foundRandomError = true
		}
		if log.FunctionID == txErrorFunction.ID && log.ErrorType == "blockchain" {
			foundTxError = true
		}
		if log.FunctionID == timeoutFunction.ID && log.ErrorType == "system" {
			foundTimeoutError = true
		}
	}

	assert.True(t, foundOracleError, "Oracle error should be logged")
	assert.True(t, foundRandomError, "Random service error should be logged")
	assert.True(t, foundTxError, "Transaction error should be logged")
	assert.True(t, foundTimeoutError, "Timeout error should be logged")
}

// SetOracleErrorResponse sets the error response for an oracle data source
func (m *mocks.MockTEEManager) SetOracleErrorResponse(dataSourceName string, err error) {
	// Implement this method in the mock TEE manager
}

// SetTimeoutSimulation sets the TEE to simulate a timeout
func (m *mocks.MockTEEManager) SetTimeoutSimulation(enable bool) {
	// Implement this method in the mock TEE manager
}

// SetRandomNumberError sets an error for random number requests
func (m *mocks.MockBlockchainClient) SetRandomNumberError(contractAddress, requestID string, err error) {
	// Implement this method in the mock blockchain client
}

// SetContractMethodError sets an error for contract method calls
func (m *mocks.MockBlockchainClient) SetContractMethodError(contractAddress, method string, err error) {
	// Implement this method in the mock blockchain client
}

// mockOracleRepository creates a mock oracle repository
func mockOracleRepository() *MockOracleRepository {
	return &MockOracleRepository{
		dataSources: make(map[int]*models.DataSource),
		nextID:      1,
	}
}

// mockOracleService creates a mock oracle service
func mockOracleService(repo *MockOracleRepository, blockchainClient *mocks.MockBlockchainClient) *oracle.Service {
	// In a real implementation, create a mock or real service
	return &oracle.Service{}
}

// MockOracleRepository is a mock implementation of oracle repository
type MockOracleRepository struct {
	dataSources map[int]*models.DataSource
	nextID      int
}

// CreateDataSource adds a new data source
func (m *MockOracleRepository) CreateDataSource(dataSource *models.DataSource) error {
	dataSource.ID = m.nextID
	m.nextID++
	m.dataSources[dataSource.ID] = dataSource
	return nil
}

// GetDataSourceByID retrieves a data source by ID
func (m *MockOracleRepository) GetDataSourceByID(id int) (*models.DataSource, error) {
	if dataSource, exists := m.dataSources[id]; exists {
		return dataSource, nil
	}
	return nil, nil
}

// GetDataSourceByName retrieves a data source by name
func (m *MockOracleRepository) GetDataSourceByName(name string) (*models.DataSource, error) {
	for _, dataSource := range m.dataSources {
		if dataSource.Name == name {
			return dataSource, nil
		}
	}
	return nil, nil
}

// List returns all data sources
func (m *MockOracleRepository) List(offset, limit int) ([]*models.DataSource, error) {
	var results []*models.DataSource
	for _, dataSource := range m.dataSources {
		results = append(results, dataSource)
	}
	// Apply offset and limit if needed
	return results, nil
}
