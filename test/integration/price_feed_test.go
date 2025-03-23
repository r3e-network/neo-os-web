package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/pricefeed"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/test/mocks"
)

// TestPriceFeedIntegration tests the Price Feed service's ability to fetch, aggregate,
// and update price data to the blockchain
func TestPriceFeedIntegration(t *testing.T) {
	// Set up test environment
	ctx := context.Background()
	cfg := setupPriceFeedTestConfig()
	mockBlockchain := setupPriceFeedMockBlockchain(t)
	teeManager := setupPriceFeedTEEManager(t)
	priceFeedService := setupPriceFeedService(t, cfg, mockBlockchain, teeManager)

	t.Run("FetchPriceDataFromMultipleSources", testFetchPriceData(ctx, priceFeedService))
	t.Run("AggregatePriceData", testAggregatePriceData(ctx, priceFeedService))
	t.Run("UpdateBlockchainPrice", testUpdateBlockchainPrice(ctx, priceFeedService, mockBlockchain))
	t.Run("HandleSourceFailures", testHandleSourceFailures(ctx, priceFeedService))
	t.Run("CompleteUpdateCycle", testCompleteUpdateCycle(ctx, priceFeedService, mockBlockchain))
}

func setupPriceFeedTestConfig() *config.Config {
	return &config.Config{
		PriceFeed: config.PriceFeedConfig{
			UpdateInterval: 60, // 60 seconds
			Sources: map[string]string{
				"source1": "http://example.com/api1",
				"source2": "http://example.com/api2",
				"source3": "http://example.com/api3",
			},
		},
		Blockchain: config.BlockchainConfig{
			Network:     "private",
			RPCEndpoint: "http://localhost:10332",
		},
	}
}

func setupPriceFeedMockBlockchain(t *testing.T) *mocks.BlockchainClient {
	mockClient := new(mocks.BlockchainClient)

	// Setup mock expectations for contract calls
	mockClient.On("InvokeContractFunction",
		"0x1234567890abcdef1234567890abcdef12345678",
		"updatePrice",
		mock.MatchedBy(func(args []interface{}) bool {
			// Verify the arguments include the token symbol and a price value
			if len(args) != 2 {
				return false
			}
			_, symbolOk := args[0].(string)
			_, priceOk := args[1].(string)
			return symbolOk && priceOk
		})).
		Return(&blockchain.InvokeResult{
			Success:       true,
			TransactionID: "0xabcdef1234567890abcdef1234567890",
		}, nil)

	return mockClient
}

func setupPriceFeedTEEManager(t *testing.T) *tee.Manager {
	// In tests, we use a mock TEE environment
	return tee.NewManager(&config.Config{
		TEE: config.TEEConfig{
			Enabled: false, // Use simulation mode for tests
		},
	})
}

func setupPriceFeedService(t *testing.T, cfg *config.Config, blockchainClient blockchain.Client, teeManager *tee.Manager) *pricefeed.Service {
	repository := mocks.NewMockPriceFeedRepository()

	service, err := pricefeed.NewService(
		cfg,
		repository,
		blockchainClient,
		teeManager,
	)
	require.NoError(t, err)

	return service
}

// createMockPriceSource creates a mock HTTP server that returns configurable price data
func createMockPriceSource(t *testing.T, prices map[string]float64, shouldFail bool, delayMs int) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if shouldFail {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		if delayMs > 0 {
			time.Sleep(time.Duration(delayMs) * time.Millisecond)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"prices":    prices,
			"timestamp": time.Now().Unix(),
		})
	}))
}

func testFetchPriceData(ctx context.Context, service *pricefeed.Service) func(*testing.T) {
	return func(t *testing.T) {
		// Create mock price sources with different price data
		source1 := createMockPriceSource(t, map[string]float64{
			"BTC": 50000.0,
			"ETH": 3000.0,
			"NEO": 40.0,
		}, false, 0)
		defer source1.Close()

		source2 := createMockPriceSource(t, map[string]float64{
			"BTC": 50100.0,
			"ETH": 3020.0,
			"NEO": 40.5,
		}, false, 0)
		defer source2.Close()

		source3 := createMockPriceSource(t, map[string]float64{
			"BTC": 49900.0,
			"ETH": 2980.0,
			"NEO": 39.5,
		}, false, 0)
		defer source3.Close()

		// Configure the price feed with the mock sources
		priceFeed := &models.PriceFeed{
			Symbol: "BTC",
			Sources: []models.PriceSource{
				{
					Name: "source1",
					URL:  source1.URL,
					Path: "$.prices.BTC",
				},
				{
					Name: "source2",
					URL:  source2.URL,
					Path: "$.prices.BTC",
				},
				{
					Name: "source3",
					URL:  source3.URL,
					Path: "$.prices.BTC",
				},
			},
			ContractAddress: "0x1234567890abcdef1234567890abcdef12345678",
			UpdateInterval:  60,
			Active:          true,
		}

		// Create the price feed
		createdFeed, err := service.CreatePriceFeed(ctx, priceFeed)
		require.NoError(t, err)
		assert.Equal(t, "BTC", createdFeed.Symbol)
		assert.Len(t, createdFeed.Sources, 3)

		// Fetch price data from all sources
		priceData, err := service.FetchPriceData(ctx, createdFeed.ID)
		require.NoError(t, err)

		// Verify price data was fetched from all sources
		assert.Len(t, priceData, 3)
		assert.InDelta(t, 50000.0, priceData[0].Price, 0.1)
		assert.InDelta(t, 50100.0, priceData[1].Price, 0.1)
		assert.InDelta(t, 49900.0, priceData[2].Price, 0.1)
		assert.True(t, priceData[0].Success)
		assert.True(t, priceData[1].Success)
		assert.True(t, priceData[2].Success)
	}
}

func testAggregatePriceData(ctx context.Context, service *pricefeed.Service) func(*testing.T) {
	return func(t *testing.T) {
		// Create mock price sources with varying prices
		source1 := createMockPriceSource(t, map[string]float64{
			"ETH": 3000.0,
		}, false, 0)
		defer source1.Close()

		source2 := createMockPriceSource(t, map[string]float64{
			"ETH": 3020.0,
		}, false, 0)
		defer source2.Close()

		source3 := createMockPriceSource(t, map[string]float64{
			"ETH": 2980.0,
		}, false, 0)
		defer source3.Close()

		// Include an outlier source
		source4 := createMockPriceSource(t, map[string]float64{
			"ETH": 3500.0, // This is an outlier and should be rejected
		}, false, 0)
		defer source4.Close()

		// Configure the price feed with the mock sources
		priceFeed := &models.PriceFeed{
			Symbol: "ETH",
			Sources: []models.PriceSource{
				{
					Name: "source1",
					URL:  source1.URL,
					Path: "$.prices.ETH",
				},
				{
					Name: "source2",
					URL:  source2.URL,
					Path: "$.prices.ETH",
				},
				{
					Name: "source3",
					URL:  source3.URL,
					Path: "$.prices.ETH",
				},
				{
					Name: "source4",
					URL:  source4.URL,
					Path: "$.prices.ETH",
				},
			},
			DeviationThreshold: 5.0, // 5% deviation threshold
			ContractAddress:    "0x1234567890abcdef1234567890abcdef12345678",
			UpdateInterval:     60,
			Active:             true,
		}

		// Create the price feed
		createdFeed, err := service.CreatePriceFeed(ctx, priceFeed)
		require.NoError(t, err)

		// Fetch and aggregate price data
		aggregatedPrice, err := service.AggregatePriceData(ctx, createdFeed.ID)
		require.NoError(t, err)

		// The median of 2980, 3000, 3020 should be 3000
		// The outlier 3500 should be rejected as it exceeds the deviation threshold
		assert.InDelta(t, 3000.0, aggregatedPrice, 0.1)

		// Test with another configuration including different deviation threshold
		priceFeed2 := &models.PriceFeed{
			Symbol: "ETH_WIDE",
			Sources: []models.PriceSource{
				{
					Name: "source1",
					URL:  source1.URL,
					Path: "$.prices.ETH",
				},
				{
					Name: "source2",
					URL:  source2.URL,
					Path: "$.prices.ETH",
				},
				{
					Name: "source3",
					URL:  source3.URL,
					Path: "$.prices.ETH",
				},
				{
					Name: "source4",
					URL:  source4.URL,
					Path: "$.prices.ETH",
				},
			},
			DeviationThreshold: 20.0, // 20% deviation threshold - should include the outlier
			ContractAddress:    "0x1234567890abcdef1234567890abcdef12345678",
			UpdateInterval:     60,
			Active:             true,
		}

		// Create the second price feed
		createdFeed2, err := service.CreatePriceFeed(ctx, priceFeed2)
		require.NoError(t, err)

		// Fetch and aggregate price data with wider threshold
		aggregatedPrice2, err := service.AggregatePriceData(ctx, createdFeed2.ID)
		require.NoError(t, err)

		// The median of 2980, 3000, 3020, 3500 should be (3000 + 3020) / 2 = 3010
		assert.InDelta(t, 3010.0, aggregatedPrice2, 0.1)
	}
}

func testUpdateBlockchainPrice(ctx context.Context, service *pricefeed.Service, mockBlockchain *mocks.BlockchainClient) func(*testing.T) {
	return func(t *testing.T) {
		// Create a price feed
		priceFeed := &models.PriceFeed{
			Symbol:          "NEO",
			ContractAddress: "0x1234567890abcdef1234567890abcdef12345678",
			UpdateInterval:  60,
			Active:          true,
		}

		// Create the price feed
		createdFeed, err := service.CreatePriceFeed(ctx, priceFeed)
		require.NoError(t, err)

		// Update the blockchain with a price
		price := 42.50
		txID, err := service.UpdateBlockchainPrice(ctx, createdFeed.ID, price)
		require.NoError(t, err)
		assert.Equal(t, "0xabcdef1234567890abcdef1234567890", txID)

		// Verify that the mock blockchain client was called correctly
		mockBlockchain.AssertCalled(t, "InvokeContractFunction",
			"0x1234567890abcdef1234567890abcdef12345678",
			"updatePrice",
			mock.MatchedBy(func(args []interface{}) bool {
				return args[0] == "NEO" && args[1] == "42.5"
			}))
	}
}

func testHandleSourceFailures(ctx context.Context, service *pricefeed.Service) func(*testing.T) {
	return func(t *testing.T) {
		// Create mock sources - one working, one failing, one slow
		workingSource := createMockPriceSource(t, map[string]float64{
			"GAS": 5.0,
		}, false, 0)
		defer workingSource.Close()

		failingSource := createMockPriceSource(t, map[string]float64{
			"GAS": 5.2,
		}, true, 0) // This source will return an error
		defer failingSource.Close()

		slowSource := createMockPriceSource(t, map[string]float64{
			"GAS": 4.8,
		}, false, 3000) // This source will be slow (3 seconds)
		defer slowSource.Close()

		// Configure the price feed with the mock sources
		priceFeed := &models.PriceFeed{
			Symbol: "GAS",
			Sources: []models.PriceSource{
				{
					Name: "working",
					URL:  workingSource.URL,
					Path: "$.prices.GAS",
				},
				{
					Name: "failing",
					URL:  failingSource.URL,
					Path: "$.prices.GAS",
				},
				{
					Name: "slow",
					URL:  slowSource.URL,
					Path: "$.prices.GAS",
				},
			},
			Timeout:         1, // 1 second timeout - the slow source should time out
			ContractAddress: "0x1234567890abcdef1234567890abcdef12345678",
			UpdateInterval:  60,
			MinValidSources: 1, // Only need one valid source
			Active:          true,
		}

		// Create the price feed
		createdFeed, err := service.CreatePriceFeed(ctx, priceFeed)
		require.NoError(t, err)

		// Fetch price data - should handle the failing and slow sources
		priceData, err := service.FetchPriceData(ctx, createdFeed.ID)
		require.NoError(t, err)

		// Should have three source results, but only one successful
		assert.Len(t, priceData, 3)

		// Count successful sources
		successCount := 0
		for _, data := range priceData {
			if data.Success {
				successCount++
				assert.InDelta(t, 5.0, data.Price, 0.1)
			}
		}

		assert.Equal(t, 1, successCount)

		// The aggregation should still work with just one source
		price, err := service.AggregatePriceData(ctx, createdFeed.ID)
		require.NoError(t, err)
		assert.InDelta(t, 5.0, price, 0.1)
	}
}

func testCompleteUpdateCycle(ctx context.Context, service *pricefeed.Service, mockBlockchain *mocks.BlockchainClient) func(*testing.T) {
	return func(t *testing.T) {
		// Create mock sources with consistent prices
		source1 := createMockPriceSource(t, map[string]float64{
			"FLM": 0.25,
		}, false, 0)
		defer source1.Close()

		source2 := createMockPriceSource(t, map[string]float64{
			"FLM": 0.26,
		}, false, 0)
		defer source2.Close()

		source3 := createMockPriceSource(t, map[string]float64{
			"FLM": 0.24,
		}, false, 0)
		defer source3.Close()

		// Configure the price feed with the mock sources
		priceFeed := &models.PriceFeed{
			Symbol: "FLM",
			Sources: []models.PriceSource{
				{
					Name: "source1",
					URL:  source1.URL,
					Path: "$.prices.FLM",
				},
				{
					Name: "source2",
					URL:  source2.URL,
					Path: "$.prices.FLM",
				},
				{
					Name: "source3",
					URL:  source3.URL,
					Path: "$.prices.FLM",
				},
			},
			ContractAddress: "0x1234567890abcdef1234567890abcdef12345678",
			UpdateInterval:  60,
			Active:          true,
		}

		// Create the price feed
		createdFeed, err := service.CreatePriceFeed(ctx, priceFeed)
		require.NoError(t, err)

		// Execute a complete update cycle
		err = service.ExecuteUpdate(ctx, createdFeed.ID)
		require.NoError(t, err)

		// Verify the blockchain client was called with the median price (0.25)
		mockBlockchain.AssertCalled(t, "InvokeContractFunction",
			"0x1234567890abcdef1234567890abcdef12345678",
			"updatePrice",
			mock.MatchedBy(func(args []interface{}) bool {
				return args[0] == "FLM" && args[1] == "0.25"
			}))

		// Check that the last update timestamp was updated
		updatedFeed, err := service.GetPriceFeed(ctx, createdFeed.ID)
		require.NoError(t, err)
		assert.True(t, updatedFeed.LastUpdated.After(time.Now().Add(-1*time.Minute)))
	}
}
