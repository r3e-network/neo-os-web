package integration_tests

import (
	"database/sql"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/automation"
	"github.com/R3E-Network/service_layer/internal/core/functions"
	"github.com/R3E-Network/service_layer/internal/core/pricefeed"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/R3E-Network/service_layer/test/mocks"
)

// TestPriceTriggeredContractInteraction is an integration test for the "Price-Triggered Contract Interaction" scenario.
// This test verifies that a function is triggered when a price threshold is reached and that it can
// interact with a smart contract based on the price data.
func TestPriceTriggeredContractInteraction(t *testing.T) {
	// Skip this test if not running integration tests
	if os.Getenv("RUN_INTEGRATION_TESTS") != "true" {
		t.Skip("Skipping integration test. Set RUN_INTEGRATION_TESTS=true to run.")
	}

	// Setup test environment
	log := logger.New("integration-test")

	// Create test configuration
	cfg := &config.Config{
		Features: config.Features{
			Automation: true,
			PriceFeed:  true,
		},
	}

	// Configure test database
	db, teardown := setupTestDatabase(t)
	defer teardown()

	// Create mock repositories
	userRepo := mockUserRepository()
	functionRepo := mockFunctionRepository()
	executionRepo := mockExecutionRepository()
	triggerRepo := mockTriggerRepository()
	priceFeedRepo := mockPriceFeedRepository()

	// Create mock blockchain client and TEE manager
	mockBlockchain := mocks.NewMockBlockchainClient()
	mockTEE := mocks.NewMockTEEManager()

	// Create service instances
	functionService := mockFunctionService(functionRepo, executionRepo, mockTEE)
	priceFeedService := mockPriceFeedService(priceFeedRepo, mockBlockchain)
	automationService := mockAutomationService(cfg, log, triggerRepo, functionService, mockBlockchain)

	// Start the services
	err := priceFeedService.Start()
	require.NoError(t, err, "Failed to start price feed service")
	defer priceFeedService.Stop()

	err = automationService.Start()
	require.NoError(t, err, "Failed to start automation service")
	defer automationService.Stop()

	// 1. Create a test user
	testUser := createTestUser(t, userRepo)

	// 2. Create a test function that interacts with a smart contract based on price
	functionCode := `
	// This function processes price data and interacts with a smart contract
	async function main(params) {
		// Get the price data from trigger parameters
		const price = params.price;
		const assetPair = params.assetPair;
		
		// Calculate some value based on the price
		const value = price * 2; // Simple calculation for test
		
		// Update value on smart contract
		const txHash = await updateOnChain("PriceContract", "updateValue", [assetPair, value]);
		
		return {
			success: true,
			price: price,
			calculatedValue: value,
			txHash: txHash
		};
	}
	`

	testFunction := createTestFunction(t, functionRepo, testUser.ID, "price-action-function", functionCode)

	// 3. Create a price feed configuration
	assetPair := "NEO/GAS"
	initialPrice := 9.5 // Initial price below threshold
	triggerThreshold := 10.0

	priceFeed := createPriceFeed(t, priceFeedRepo, testUser.ID, assetPair)

	// 4. Create a price-based trigger that fires when price goes above threshold
	priceConfig := models.PriceTriggerConfig{
		AssetPair: assetPair,
		Condition: "above",
		Threshold: triggerThreshold,
		Duration:  0, // Trigger immediately when condition is met
	}
	priceConfigJSON, _ := json.Marshal(priceConfig)

	trigger := createTrigger(
		t,
		automationService,
		testUser.ID,
		testFunction.ID,
		"price-threshold-trigger",
		models.TriggerTypePrice,
		priceConfigJSON,
	)

	// 5. Set initial price (below threshold)
	updatePrice(t, priceFeedService, priceFeed.ID, initialPrice)

	// Wait a moment for the price to be processed
	time.Sleep(500 * time.Millisecond)

	// Verify no executions yet
	executions, err := executionRepo.ListByFunctionID(testFunction.ID, 0, 10)
	require.NoError(t, err, "Failed to get executions")
	assert.Empty(t, executions, "There should be no executions before price threshold is reached")

	// 6. Update price to cross threshold
	updatePrice(t, priceFeedService, priceFeed.ID, triggerThreshold+1.0)

	// 7. Wait for the trigger to execute
	time.Sleep(1 * time.Second)

	// 8. Verify that the function was executed
	executions, err = executionRepo.ListByFunctionID(testFunction.ID, 0, 10)
	require.NoError(t, err, "Failed to get executions")
	require.NotEmpty(t, executions, "No executions found after price threshold was reached")

	// 9. Verify the contract method was called with the correct parameters
	assert.True(t, mockBlockchain.WasContractMethodCalled("PriceContract", "updateValue"),
		"Contract method was not called")

	// 10. Verify the execution result contains the expected data
	latestExecution := executions[0]
	var result map[string]interface{}
	err = json.Unmarshal(latestExecution.Result, &result)
	require.NoError(t, err, "Failed to parse execution result")

	assert.Equal(t, true, result["success"])
	assert.InDelta(t, triggerThreshold+1.0, result["price"].(float64), 0.01)
	assert.InDelta(t, (triggerThreshold+1.0)*2, result["calculatedValue"].(float64), 0.01)

	// 11. Verify trigger history is updated
	events, err := triggerRepo.ListEventsByTriggerID(trigger.ID, 0, 10)
	require.NoError(t, err, "Failed to get trigger events")
	require.NotEmpty(t, events, "No trigger events found")

	// The event should have a successful status
	assert.Equal(t, "success", events[0].Status)
}

// Mock and helper functions

func mockUserRepository() models.UserRepository {
	// Implementation depends on your mocking strategy
	return &MockUserRepository{
		users:  make(map[int]*models.User),
		nextID: 1,
	}
}

func mockFunctionRepository() models.FunctionRepository {
	return &MockFunctionRepository{
		functions: make(map[int]*models.Function),
		nextID:    1,
	}
}

func mockExecutionRepository() models.ExecutionRepository {
	return &MockExecutionRepository{
		executions: make(map[int]*models.Execution),
		nextID:     1,
	}
}

func mockTriggerRepository() models.TriggerRepository {
	return &MockTriggerRepository{
		triggers:    make(map[int]*models.Trigger),
		events:      make(map[int][]*models.TriggerEvent),
		nextID:      1,
		nextEventID: 1,
	}
}

func mockPriceFeedRepository() models.PriceFeedRepository {
	return &MockPriceFeedRepository{
		priceFeeds: make(map[int]*models.PriceFeed),
		prices:     make(map[string]float64),
		nextID:     1,
	}
}

func mockFunctionService(repo models.FunctionRepository, execRepo models.ExecutionRepository, teeManager *mocks.MockTEEManager) *functions.Service {
	// In a real implementation, create a mock or real service
	return &functions.Service{} // Simple mock, implementation depends on your specific needs
}

func mockPriceFeedService(repo models.PriceFeedRepository, blockchainClient *mocks.MockBlockchainClient) *pricefeed.Service {
	// In a real implementation, create a mock or real service
	return &pricefeed.Service{} // Simple mock, implementation depends on your specific needs
}

func mockAutomationService(cfg *config.Config, log *logger.Logger, repo models.TriggerRepository,
	functionService *functions.Service, blockchainClient *mocks.MockBlockchainClient) *automation.Service {
	// In a real implementation, create a mock or real service
	return &automation.Service{} // Simple mock, implementation depends on your specific needs
}

func createTestUser(t *testing.T, repo models.UserRepository) *models.User {
	user := &models.User{
		Username: "test-user",
		Email:    "test@example.com",
		// Set other required fields
	}
	err := repo.Create(user)
	require.NoError(t, err, "Failed to create test user")
	return user
}

func createTestFunction(t *testing.T, repo models.FunctionRepository, userID int, name, code string) *models.Function {
	function := &models.Function{
		UserID:      userID,
		Name:        name,
		Description: "Test function for " + name,
		// Set code field based on your model's field name
		Version:   1,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err := repo.Create(function)
	require.NoError(t, err, "Failed to create test function")
	return function
}

func createPriceFeed(t *testing.T, repo models.PriceFeedRepository, userID int, assetPair string) *models.PriceFeed {
	priceFeed := &models.PriceFeed{
		UserID:    userID,
		AssetPair: assetPair,
		Sources:   []string{"test"},
		Active:    true,
		// Set other required fields
	}
	err := repo.Create(priceFeed)
	require.NoError(t, err, "Failed to create price feed")
	return priceFeed
}

func createTrigger(t *testing.T, service *automation.Service, userID, functionID int, name string,
	triggerType models.TriggerType, configJSON json.RawMessage) *models.Trigger {
	trigger, err := service.CreateTrigger(
		userID,
		functionID,
		name,
		"Test trigger for "+name,
		triggerType,
		configJSON,
	)
	require.NoError(t, err, "Failed to create trigger")
	return trigger
}

func updatePrice(t *testing.T, service *pricefeed.Service, feedID int, price float64) {
	// In a real implementation, this would update the price in the service
	// For this mock, we can simulate the behavior
	// service.UpdatePrice(feedID, price)
	t.Logf("Updating price for feed %d to %f", feedID, price)
}

// Mock repositories
type MockUserRepository struct {
	users  map[int]*models.User
	nextID int
}

func (m *MockUserRepository) Create(user *models.User) error {
	user.ID = m.nextID
	m.nextID++
	m.users[user.ID] = user
	return nil
}

func (m *MockUserRepository) GetByID(id int) (*models.User, error) {
	if user, ok := m.users[id]; ok {
		return user, nil
	}
	return nil, nil
}

// Add other repository methods as needed

type MockFunctionRepository struct {
	functions map[int]*models.Function
	nextID    int
}

func (m *MockFunctionRepository) Create(function *models.Function) error {
	function.ID = m.nextID
	m.nextID++
	m.functions[function.ID] = function
	return nil
}

func (m *MockFunctionRepository) GetByID(id int) (*models.Function, error) {
	if function, ok := m.functions[id]; ok {
		return function, nil
	}
	return nil, nil
}

// Add other repository methods as needed

type MockExecutionRepository struct {
	executions map[int]*models.Execution
	nextID     int
}

func (m *MockExecutionRepository) Create(execution *models.Execution) error {
	execution.ID = m.nextID
	m.nextID++
	m.executions[execution.ID] = execution
	return nil
}

func (m *MockExecutionRepository) ListByFunctionID(functionID, offset, limit int) ([]*models.Execution, error) {
	var result []*models.Execution
	for _, exec := range m.executions {
		if exec.FunctionID == functionID {
			result = append(result, exec)
		}
	}
	// Apply offset and limit if needed
	return result, nil
}

// Add other repository methods as needed

type MockTriggerRepository struct {
	triggers    map[int]*models.Trigger
	events      map[int][]*models.TriggerEvent
	nextID      int
	nextEventID int
}

func (m *MockTriggerRepository) Create(trigger *models.Trigger) error {
	trigger.ID = m.nextID
	m.nextID++
	m.triggers[trigger.ID] = trigger
	m.events[trigger.ID] = []*models.TriggerEvent{}
	return nil
}

func (m *MockTriggerRepository) GetByID(id int) (*models.Trigger, error) {
	if trigger, ok := m.triggers[id]; ok {
		return trigger, nil
	}
	return nil, nil
}

func (m *MockTriggerRepository) CreateEvent(event *models.TriggerEvent) error {
	event.ID = m.nextEventID
	m.nextEventID++
	m.events[event.TriggerID] = append(m.events[event.TriggerID], event)
	return nil
}

func (m *MockTriggerRepository) ListEventsByTriggerID(triggerID, offset, limit int) ([]*models.TriggerEvent, error) {
	if events, ok := m.events[triggerID]; ok {
		// Apply offset and limit if needed
		return events, nil
	}
	return []*models.TriggerEvent{}, nil
}

// Add other repository methods as needed

type MockPriceFeedRepository struct {
	priceFeeds map[int]*models.PriceFeed
	prices     map[string]float64
	nextID     int
}

func (m *MockPriceFeedRepository) Create(priceFeed *models.PriceFeed) error {
	priceFeed.ID = m.nextID
	m.nextID++
	m.priceFeeds[priceFeed.ID] = priceFeed
	return nil
}

func (m *MockPriceFeedRepository) GetByID(id int) (*models.PriceFeed, error) {
	if priceFeed, ok := m.priceFeeds[id]; ok {
		return priceFeed, nil
	}
	return nil, nil
}

// Add other repository methods as needed

// setupTestDatabase creates a test database and returns a cleanup function
func setupTestDatabase(t *testing.T) (*sql.DB, func()) {
	// For integration tests, we could use a real database
	// For this example, we'll return a nil DB since we're using mock repositories
	return nil, func() {
		// No cleanup needed
	}
}
