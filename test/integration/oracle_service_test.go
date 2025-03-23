package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"service_layer/internal/blockchain"
	"service_layer/internal/config"
	"service_layer/internal/models"
	"service_layer/internal/oracle"
	"service_layer/internal/tee"
	"service_layer/test/mocks"
)

// TestOracleServiceIntegration tests the integration between the Oracle service,
// external data sources, and blockchain updates
func TestOracleServiceIntegration(t *testing.T) {
	// Set up test environment
	ctx := context.Background()
	cfg := setupTestConfig()
	mockBlockchain := setupMockBlockchain(t)
	teeManager := setupTEEManager(t)
	oracleService := setupOracleService(t, cfg, mockBlockchain, teeManager)

	t.Run("CreateOracleDataSource", testCreateOracleDataSource(ctx, oracleService))
	t.Run("FetchTransformData", testFetchTransformData(ctx, oracleService))
	t.Run("UpdateBlockchainContract", testUpdateBlockchainContract(ctx, oracleService, mockBlockchain))
	t.Run("CompleteOracleFlow", testCompleteOracleFlow(ctx, oracleService, mockBlockchain))
}

func setupTestConfig() *config.Config {
	return &config.Config{
		Oracle: config.OracleConfig{
			UpdateInterval: 60, // 60 seconds
			MaxDataSources: 10,
		},
		Blockchain: config.BlockchainConfig{
			Network:     "private",
			RPCEndpoint: "http://localhost:10332",
		},
	}
}

func setupMockBlockchain(t *testing.T) *mocks.BlockchainClient {
	mockClient := new(mocks.BlockchainClient)

	// Setup mock expectations for contract calls
	mockClient.On("InvokeContractFunction",
		"0x1234567890abcdef1234567890abcdef12345678",
		"updateOracleData",
		[]interface{}{"WEATHER", `{"temperature":25.5,"humidity":65,"timestamp":1630000000}`}).
		Return(&blockchain.InvokeResult{
			Success:       true,
			TransactionID: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		}, nil)

	return mockClient
}

func setupTEEManager(t *testing.T) *tee.Manager {
	// In tests, we use a mock TEE environment
	return tee.NewManager(&config.Config{
		TEE: config.TEEConfig{
			Enabled: false, // Use simulation mode for tests
		},
	})
}

func setupOracleService(t *testing.T, cfg *config.Config, blockchainClient blockchain.Client, teeManager *tee.Manager) *oracle.Service {
	repository := mocks.NewMockOracleRepository()

	service, err := oracle.NewService(
		cfg,
		repository,
		blockchainClient,
		teeManager,
	)
	require.NoError(t, err)

	return service
}

func testCreateOracleDataSource(ctx context.Context, service *oracle.Service) func(*testing.T) {
	return func(t *testing.T) {
		// Create a mock HTTP server for the data source
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"temperature": 25.5,
				"humidity":    65,
				"timestamp":   1630000000,
			})
		}))
		defer mockServer.Close()

		// Create a new data source
		dataSource := &models.OracleDataSource{
			Name:           "WEATHER",
			URL:            mockServer.URL,
			UpdateInterval: 60, // seconds
			ContractScript: "0x1234567890abcdef1234567890abcdef12345678",
			Method:         "updateOracleData",
			DataPath:       "$", // take the entire JSON response
			TransformScript: `
				function transform(data) {
					return {
						temperature: data.temperature,
						humidity: data.humidity,
						timestamp: data.timestamp
					};
				}
			`,
			Active: true,
		}

		createdSource, err := service.CreateDataSource(ctx, dataSource)
		require.NoError(t, err)
		assert.Equal(t, "WEATHER", createdSource.Name)
		assert.Equal(t, mockServer.URL, createdSource.URL)
		assert.True(t, createdSource.Active)
	}
}

func testFetchTransformData(ctx context.Context, service *oracle.Service) func(*testing.T) {
	return func(t *testing.T) {
		// Create a mock HTTP server for the data source
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"weather": map[string]interface{}{
					"temperature": 25.5,
					"humidity":    65,
				},
				"timestamp": 1630000000,
			})
		}))
		defer mockServer.Close()

		// Create a data source that requires path extraction and transformation
		dataSource := &models.OracleDataSource{
			Name:           "WEATHER_COMPLEX",
			URL:            mockServer.URL,
			UpdateInterval: 60, // seconds
			ContractScript: "0x1234567890abcdef1234567890abcdef12345678",
			Method:         "updateOracleData",
			DataPath:       "$.weather", // extract the weather object
			TransformScript: `
				function transform(data) {
					return {
						celsiusTemp: data.temperature,
						fahrenheitTemp: data.temperature * 9/5 + 32,
						humidity: data.humidity,
						status: data.humidity > 80 ? "humid" : "normal"
					};
				}
			`,
			Active: true,
		}

		createdSource, err := service.CreateDataSource(ctx, dataSource)
		require.NoError(t, err)

		// Test data fetching and transformation
		transformedData, err := service.FetchAndTransformData(ctx, createdSource.ID)
		require.NoError(t, err)

		// Verify transformed data
		var result map[string]interface{}
		err = json.Unmarshal([]byte(transformedData), &result)
		require.NoError(t, err)

		assert.Equal(t, 25.5, result["celsiusTemp"])
		assert.InDelta(t, 77.9, result["fahrenheitTemp"].(float64), 0.1) // 25.5 * 9/5 + 32 = 77.9
		assert.Equal(t, 65.0, result["humidity"])
		assert.Equal(t, "normal", result["status"])
	}
}

func testUpdateBlockchainContract(ctx context.Context, service *oracle.Service, mockBlockchain *mocks.BlockchainClient) func(*testing.T) {
	return func(t *testing.T) {
		// Create a data source
		dataSource := &models.OracleDataSource{
			Name:            "WEATHER_UPDATE",
			URL:             "https://example.com/weather",
			UpdateInterval:  60, // seconds
			ContractScript:  "0x1234567890abcdef1234567890abcdef12345678",
			Method:          "updateOracleData",
			DataPath:        "$",
			TransformScript: `function transform(data) { return data; }`,
			Active:          true,
		}

		createdSource, err := service.CreateDataSource(ctx, dataSource)
		require.NoError(t, err)

		// Mock the transformed data
		transformedData := `{"temperature":25.5,"humidity":65,"timestamp":1630000000}`

		// Update the blockchain contract
		txID, err := service.UpdateBlockchainContract(ctx, createdSource.ID, transformedData)
		require.NoError(t, err)
		assert.Equal(t, "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", txID)

		// Verify that the mock blockchain client was called correctly
		mockBlockchain.AssertExpectations(t)
	}
}

func testCompleteOracleFlow(ctx context.Context, service *oracle.Service, mockBlockchain *mocks.BlockchainClient) func(*testing.T) {
	return func(t *testing.T) {
		// Create a mock HTTP server for the data source
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"temperature": 25.5,
				"humidity":    65,
				"timestamp":   1630000000,
			})
		}))
		defer mockServer.Close()

		// Create a data source
		dataSource := &models.OracleDataSource{
			Name:            "WEATHER_COMPLETE",
			URL:             mockServer.URL,
			UpdateInterval:  60, // seconds
			ContractScript:  "0x1234567890abcdef1234567890abcdef12345678",
			Method:          "updateOracleData",
			DataPath:        "$",
			TransformScript: `function transform(data) { return data; }`,
			Active:          true,
		}

		// Set up the complete flow: create source, fetch data, update blockchain
		createdSource, err := service.CreateDataSource(ctx, dataSource)
		require.NoError(t, err)

		// Execute the update to trigger the full flow
		err = service.ExecuteUpdate(ctx, createdSource.ID)
		require.NoError(t, err)

		// Verify that the blockchain was updated with the correct data
		mockBlockchain.AssertExpectations(t)

		// Check that the last update timestamp was updated
		updatedSource, err := service.GetDataSource(ctx, createdSource.ID)
		require.NoError(t, err)
		assert.True(t, updatedSource.LastUpdated.After(time.Now().Add(-1*time.Minute)))
	}
}
