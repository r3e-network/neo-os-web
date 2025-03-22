package integration_tests

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/automation"
	"github.com/R3E-Network/service_layer/internal/core/functions"
	"github.com/R3E-Network/service_layer/internal/core/gasbank"
	"github.com/R3E-Network/service_layer/internal/core/oracle"
	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/repository"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/R3E-Network/service_layer/test/mocks"
)

// TestAutomatedOracleFunction is an integration test for the "Automated Oracle Data Function" scenario.
// This test verifies that a function can be triggered on a schedule, retrieve data from an oracle,
// and update data on the blockchain.
func TestAutomatedOracleFunction(t *testing.T) {
	// Skip this test if not running integration tests
	if os.Getenv("RUN_INTEGRATION_TESTS") != "true" {
		t.Skip("Skipping integration test. Set RUN_INTEGRATION_TESTS=true to run.")
	}

	// Setup test environment
	log := logger.New("integration-test")

	// Load test configuration
	cfg := &config.Config{
		Features: config.Features{
			Automation: true,
		},
	}

	// Configure test database
	db, teardown := setupTestDatabase(t)
	defer teardown()

	// Create repository instances
	userRepo := repository.NewUserRepository(db)
	functionRepo := repository.NewFunctionRepository(db)
	executionRepo := repository.NewExecutionRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	oracleRepo := repository.NewOracleRepository(db)

	// Create mock blockchain client and TEE manager
	mockBlockchain := mocks.NewMockBlockchainClient()
	mockTEE := mocks.NewMockTEEManager()

	// Create blockchain and TEE interfaces that match the required types
	blockchainClient := &blockchain.Client{}
	teeManager := &tee.Manager{}

	// Create mock gas bank service
	mockGasBank := &gasbank.Service{}

	// Create service instances
	functionService := functions.NewService(cfg, log, functionRepo, executionRepo, teeManager)
	oracleService := oracle.NewService(cfg, log, oracleRepo, blockchainClient, mockGasBank, teeManager)
	automationService := automation.NewService(cfg, log, triggerRepo, functionService, blockchainClient)

	// Start the automation service
	err := automationService.Start()
	require.NoError(t, err, "Failed to start automation service")
	defer automationService.Stop()

	// 1. Create a test user
	testUser := &models.User{
		Username:  "test-user",
		Email:     "test@example.com",
		HashedPwd: "secure-password-hash", // Using HashedPwd instead of Password
	}
	err = userRepo.Create(testUser)
	require.NoError(t, err, "Failed to create test user")

	// 2. Create a test oracle data source
	oracleSource := &models.DataSource{
		UserID:          testUser.ID,
		Name:            "test-price-source",
		Description:     "Test price data source",
		URL:             "https://api.example.com/prices",
		Method:          "GET",
		Headers:         json.RawMessage(`{"Content-Type": "application/json"}`),
		ResponsePath:    "$.price",
		UpdateFrequency: 60, // 60 seconds
		Active:          true,
	}
	err = oracleRepo.CreateDataSource(oracleSource)
	require.NoError(t, err, "Failed to create oracle source")

	// 3. Create a test function that uses the oracle
	functionCode := `
	// This function gets price data from an oracle and updates it on-chain
	async function main(params) {
		// Get price data from oracle
		const oracleData = await fetchOracleData("test-price-source");
		if (!oracleData) {
			throw new Error("Failed to fetch oracle data");
		}
		
		// Update the data on-chain (mock implementation for test)
		const txHash = await updateOnChain("PriceContract", "updatePrice", [oracleData.price]);
		
		return {
			success: true,
			price: oracleData.price,
			txHash: txHash
		};
	}
	`

	testFunction := &models.Function{
		UserID:      testUser.ID,
		Name:        "price-update-function",
		Description: "Function to update price data on-chain",
		Source:      functionCode, // Using Source instead of Code
		Version:     1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	err = functionRepo.Create(testFunction)
	require.NoError(t, err, "Failed to create test function")

	// 4. Set up a mock response for the oracle
	mockOracleResponse := map[string]interface{}{
		"price": 42.5,
	}
	mockTEE.SetOracleResponse("test-price-source", mockOracleResponse)

	// 5. Set up a mock blockchain response for the on-chain update
	mockTxHash := "0x123456789abcdef"
	mockBlockchain.SetTxResponse(mockTxHash, nil) // nil means success

	// 6. Create a cron trigger to execute the function
	// We use a schedule that will fire quickly for the test
	cronConfig := models.CronTriggerConfig{
		Schedule: "*/1 * * * * *", // Every second
		Timezone: "UTC",
	}
	cronConfigJSON, _ := json.Marshal(cronConfig)

	_, err = automationService.CreateTrigger(
		testUser.ID,
		testFunction.ID,
		"price-update-trigger",
		"Trigger to update price data",
		models.TriggerTypeCron,
		cronConfigJSON,
	)
	require.NoError(t, err, "Failed to create trigger")

	// 7. Wait for the trigger to execute
	time.Sleep(3 * time.Second) // Wait for the trigger to fire

	// 8. Verify that the function was executed
	executions, err := executionRepo.ListByFunctionID(testFunction.ID, 0, 10)
	require.NoError(t, err, "Failed to get executions")
	require.NotEmpty(t, executions, "No executions found")

	// 9. Verify that the oracle was called
	assert.True(t, mockTEE.WasOracleCalled("test-price-source"), "Oracle was not called")

	// 10. Verify that the blockchain update was attempted
	assert.True(t, mockBlockchain.WasContractMethodCalled("PriceContract", "updatePrice"), "Contract method was not called")

	// 11. Verify the execution result contains the expected data
	latestExecution := executions[0]
	var result map[string]interface{}
	err = json.Unmarshal(latestExecution.Result, &result)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, true, result["success"])
	assert.Equal(t, 42.5, result["price"])
	assert.Equal(t, mockTxHash, result["txHash"])

	// 12. Verify trigger history is updated
	events, err := triggerRepo.ListEventsByTriggerID(1, 0, 10)
	require.NoError(t, err, "Failed to get trigger events")
	require.NotEmpty(t, events, "No trigger events found")

	// The first event should have a successful status
	assert.Equal(t, "success", events[0].Status)
}

// setupTestDatabase creates a test database and returns a cleanup function
func setupTestDatabase(t *testing.T) (*sql.DB, func()) {
	// For a real integration test, we would create a test database
	// and run migrations to set up the schema

	// For this example, we'll use a simplified mock approach
	db, err := sql.Open("postgres", os.Getenv("TEST_DATABASE_URL"))
	require.NoError(t, err, "Failed to connect to test database")

	// Run migrations
	err = database.Migrate(db)
	require.NoError(t, err, "Failed to run migrations")

	// Return the database connection and a cleanup function
	return db, func() {
		// Clean up the database after the test
		_, err := db.Exec("TRUNCATE users, functions, executions, triggers, trigger_events, data_sources CASCADE")
		if err != nil {
			fmt.Printf("Error cleaning up test database: %v\n", err)
		}

		db.Close()
	}
}
