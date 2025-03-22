package pricefeed

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/willtech-services/service_layer/internal/blockchain"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// Mock PriceFeedRepository
type MockPriceFeedRepository struct {
	mock.Mock
}

func (m *MockPriceFeedRepository) CreatePriceFeed(feed *models.PriceFeed) (*models.PriceFeed, error) {
	args := m.Called(feed)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceFeedByID(id int) (*models.PriceFeed, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceFeedByPair(pair string) (*models.PriceFeed, error) {
	args := m.Called(pair)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) ListPriceFeeds() ([]*models.PriceFeed, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) UpdatePriceFeed(feed *models.PriceFeed) (*models.PriceFeed, error) {
	args := m.Called(feed)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) DeletePriceFeed(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockPriceFeedRepository) CreatePriceData(data *models.PriceData) (*models.PriceData, error) {
	args := m.Called(data)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceData), args.Error(1)
}

func (m *MockPriceFeedRepository) GetLatestPriceData(priceFeedID int) (*models.PriceData, error) {
	args := m.Called(priceFeedID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceData), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceDataHistory(priceFeedID int, limit int, offset int) ([]*models.PriceData, error) {
	args := m.Called(priceFeedID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.PriceData), args.Error(1)
}

func (m *MockPriceFeedRepository) CreatePriceSource(source *models.PriceSource) (*models.PriceSource, error) {
	args := m.Called(source)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceSource), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceSourceByID(id int) (*models.PriceSource, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceSource), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceSourceByName(name string) (*models.PriceSource, error) {
	args := m.Called(name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceSource), args.Error(1)
}

func (m *MockPriceFeedRepository) ListPriceSources() ([]*models.PriceSource, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.PriceSource), args.Error(1)
}

func (m *MockPriceFeedRepository) UpdatePriceSource(source *models.PriceSource) (*models.PriceSource, error) {
	args := m.Called(source)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceSource), args.Error(1)
}

func (m *MockPriceFeedRepository) DeletePriceSource(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

// Mock PriceFetcherFactory
type MockPriceFetcherFactory struct {
	mock.Mock
}

func (m *MockPriceFetcherFactory) CreateFetcher(source *models.PriceSource) (PriceFetcher, error) {
	args := m.Called(source)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(PriceFetcher), args.Error(1)
}

// Mock PriceFetcher
type MockPriceFetcher struct {
	mock.Mock
}

func (m *MockPriceFetcher) FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error) {
	args := m.Called(ctx, baseToken, quoteToken)
	return args.Get(0).(float64), args.Error(1)
}

// Mock PriceAggregator
type MockPriceAggregator struct {
	mock.Mock
}

func (m *MockPriceAggregator) Aggregate(prices map[string]float64, weights map[string]float64) (float64, error) {
	args := m.Called(prices, weights)
	return args.Get(0).(float64), args.Error(1)
}

// Mock GasBankService
type MockGasBankService struct {
	mock.Mock
}

func (m *MockGasBankService) AllocateGas(userID int, operation string, estimatedGas int64) (int64, error) {
	args := m.Called(userID, operation, estimatedGas)
	return args.Get(0).(int64), args.Error(1)
}

// Mock TEEManager
type MockTEEManager struct {
	mock.Mock
}

// Helper function to setup test service
func setupTestService() (*PriceFeedService, *MockPriceFeedRepository, *MockPriceFetcherFactory, *MockPriceAggregator, *MockGasBankService, *MockTEEManager) {
	cfg := &config.Config{
		Services: config.ServicesConfig{
			PriceFeed: config.PriceFeedConfig{
				NumWorkers: 1,
			},
		},
	}
	log := logger.NewLogger("test")
	mockRepo := new(MockPriceFeedRepository)
	mockBlockchainClient := &blockchain.Client{}
	mockGasBankService := new(MockGasBankService)
	mockTEEManager := new(MockTEEManager)

	service := NewService(cfg, log, mockRepo, mockBlockchainClient, mockGasBankService, mockTEEManager)

	mockFetcherFactory := new(MockPriceFetcherFactory)
	mockAggregator := new(MockPriceAggregator)

	service.fetcherFactory = mockFetcherFactory
	service.aggregator = mockAggregator

	return service, mockRepo, mockFetcherFactory, mockAggregator, mockGasBankService, mockTEEManager
}

// TestCreatePriceFeed tests price feed creation
func TestCreatePriceFeed(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceFeedByPair", "BTC/USD").Return(nil, errors.New("not found")).Once()

		expectedFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		}
		mockRepo.On("CreatePriceFeed", mock.AnythingOfType("*models.PriceFeed")).Return(expectedFeed, nil).Once()

		// Call service
		feed, err := service.CreatePriceFeed("BTC", "USD", "1h", 0.5, "24h", "0x1234")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedFeed, feed)
		mockRepo.AssertExpectations(t)
	})

	t.Run("PairAlreadyExists", func(t *testing.T) {
		// Setup mock
		existingFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
		}
		mockRepo.On("GetPriceFeedByPair", "BTC/USD").Return(existingFeed, nil).Once()

		// Call service
		feed, err := service.CreatePriceFeed("BTC", "USD", "1h", 0.5, "24h", "0x1234")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		assert.Contains(t, err.Error(), "already exists")
		mockRepo.AssertExpectations(t)
	})

	t.Run("ValidationError", func(t *testing.T) {
		// Call service with invalid input
		feed, err := service.CreatePriceFeed("", "USD", "1h", 0.5, "24h", "0x1234")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		assert.Contains(t, err.Error(), "required")

		// No repository calls should be made
		mockRepo.AssertNotCalled(t, "GetPriceFeedByPair")
		mockRepo.AssertNotCalled(t, "CreatePriceFeed")
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceFeedByPair", "BTC/USD").Return(nil, errors.New("not found")).Once()
		mockRepo.On("CreatePriceFeed", mock.AnythingOfType("*models.PriceFeed")).Return(nil, errors.New("database error")).Once()

		// Call service
		feed, err := service.CreatePriceFeed("BTC", "USD", "1h", 0.5, "24h", "0x1234")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestUpdatePriceFeed tests price feed update
func TestUpdatePriceFeed(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		existingFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
		}
		mockRepo.On("GetPriceFeedByID", 1).Return(existingFeed, nil).Once()

		updatedFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "2h",
			DeviationThreshold: 0.8,
			HeartbeatInterval:  "48h",
			ContractAddress:    "0x5678",
			Active:             false,
		}
		mockRepo.On("UpdatePriceFeed", mock.AnythingOfType("*models.PriceFeed")).Return(updatedFeed, nil).Once()

		// Call service
		feed, err := service.UpdatePriceFeed(1, "BTC", "USD", "2h", 0.8, "48h", "0x5678", false)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, updatedFeed, feed)
		mockRepo.AssertExpectations(t)
	})

	t.Run("FeedNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceFeedByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		feed, err := service.UpdatePriceFeed(999, "BTC", "USD", "2h", 0.8, "48h", "0x5678", false)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		assert.Contains(t, err.Error(), "not found")
		mockRepo.AssertExpectations(t)
	})

	t.Run("ValidationError", func(t *testing.T) {
		// Call service with invalid input
		feed, err := service.UpdatePriceFeed(1, "", "USD", "2h", 0.8, "48h", "0x5678", false)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		assert.Contains(t, err.Error(), "required")

		// No repository calls should be made
		mockRepo.AssertNotCalled(t, "GetPriceFeedByID")
		mockRepo.AssertNotCalled(t, "UpdatePriceFeed")
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		existingFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
		}
		mockRepo.On("GetPriceFeedByID", 1).Return(existingFeed, nil).Once()
		mockRepo.On("UpdatePriceFeed", mock.AnythingOfType("*models.PriceFeed")).Return(nil, errors.New("database error")).Once()

		// Call service
		feed, err := service.UpdatePriceFeed(1, "BTC", "USD", "2h", 0.8, "48h", "0x5678", false)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestDeletePriceFeed tests price feed deletion
func TestDeletePriceFeed(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		mockRepo.On("DeletePriceFeed", 1).Return(nil).Once()

		// Call service
		err := service.DeletePriceFeed(1)

		// Assertions
		require.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("DeletePriceFeed", 1).Return(errors.New("database error")).Once()

		// Call service
		err := service.DeletePriceFeed(1)

		// Assertions
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "database error")
		mockRepo.AssertExpectations(t)
	})
}

// TestGetPriceFeed tests retrieving a price feed
func TestGetPriceFeed(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
		}
		mockRepo.On("GetPriceFeedByID", 1).Return(expectedFeed, nil).Once()

		// Call service
		feed, err := service.GetPriceFeed(1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedFeed, feed)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceFeedByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		feed, err := service.GetPriceFeed(999)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetPriceFeedByPair tests retrieving a price feed by pair
func TestGetPriceFeedByPair(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
		}
		mockRepo.On("GetPriceFeedByPair", "BTC/USD").Return(expectedFeed, nil).Once()

		// Call service
		feed, err := service.GetPriceFeedByPair("BTC/USD")

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedFeed, feed)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceFeedByPair", "XYZ/ABC").Return(nil, errors.New("not found")).Once()

		// Call service
		feed, err := service.GetPriceFeedByPair("XYZ/ABC")

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feed)
		mockRepo.AssertExpectations(t)
	})
}

// TestListPriceFeeds tests listing all price feeds
func TestListPriceFeeds(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedFeeds := []*models.PriceFeed{
			{
				ID:                 1,
				BaseToken:          "BTC",
				QuoteToken:         "USD",
				Pair:               "BTC/USD",
				UpdateInterval:     "1h",
				DeviationThreshold: 0.5,
				HeartbeatInterval:  "24h",
				ContractAddress:    "0x1234",
				Active:             true,
			},
			{
				ID:                 2,
				BaseToken:          "ETH",
				QuoteToken:         "USD",
				Pair:               "ETH/USD",
				UpdateInterval:     "1h",
				DeviationThreshold: 0.5,
				HeartbeatInterval:  "24h",
				ContractAddress:    "0x5678",
				Active:             true,
			},
		}
		mockRepo.On("ListPriceFeeds").Return(expectedFeeds, nil).Once()

		// Call service
		feeds, err := service.ListPriceFeeds()

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedFeeds, feeds)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("ListPriceFeeds").Return(nil, errors.New("database error")).Once()

		// Call service
		feeds, err := service.ListPriceFeeds()

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, feeds)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetLatestPrice tests retrieving the latest price
func TestGetLatestPrice(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedPrice := &models.PriceData{
			ID:          1,
			PriceFeedID: 1,
			Price:       50000.0,
			Timestamp:   time.Now(),
			RoundID:     123,
			TxHash:      "0xabcd",
			Source:      "test",
		}
		mockRepo.On("GetLatestPriceData", 1).Return(expectedPrice, nil).Once()

		// Call service
		price, err := service.GetLatestPrice(1)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedPrice, price)
		mockRepo.AssertExpectations(t)
	})

	t.Run("NotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetLatestPriceData", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		price, err := service.GetLatestPrice(999)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, price)
		mockRepo.AssertExpectations(t)
	})
}

// TestGetPriceHistory tests retrieving price history
func TestGetPriceHistory(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		expectedPrices := []*models.PriceData{
			{
				ID:          1,
				PriceFeedID: 1,
				Price:       50000.0,
				Timestamp:   time.Now().Add(-time.Hour),
				RoundID:     122,
				TxHash:      "0xabcd1",
				Source:      "test",
			},
			{
				ID:          2,
				PriceFeedID: 1,
				Price:       51000.0,
				Timestamp:   time.Now(),
				RoundID:     123,
				TxHash:      "0xabcd2",
				Source:      "test",
			},
		}
		mockRepo.On("GetPriceDataHistory", 1, 10, 0).Return(expectedPrices, nil).Once()

		// Call service
		prices, err := service.GetPriceHistory(1, 10, 0)

		// Assertions
		require.NoError(t, err)
		assert.Equal(t, expectedPrices, prices)
		mockRepo.AssertExpectations(t)
	})

	t.Run("RepositoryError", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceDataHistory", 1, 10, 0).Return(nil, errors.New("database error")).Once()

		// Call service
		prices, err := service.GetPriceHistory(1, 10, 0)

		// Assertions
		assert.Error(t, err)
		assert.Nil(t, prices)
		mockRepo.AssertExpectations(t)
	})
}

// TestTriggerPriceUpdate tests manually triggering a price update
func TestTriggerPriceUpdate(t *testing.T) {
	service, mockRepo, _, _, _, _ := setupTestService()

	t.Run("Success", func(t *testing.T) {
		// Setup mock
		existingFeed := &models.PriceFeed{
			ID:                 1,
			BaseToken:          "BTC",
			QuoteToken:         "USD",
			Pair:               "BTC/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x1234",
			Active:             true,
		}
		mockRepo.On("GetPriceFeedByID", 1).Return(existingFeed, nil).Once()

		// Call service
		err := service.TriggerPriceUpdate(1)

		// Assertions
		require.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("FeedNotFound", func(t *testing.T) {
		// Setup mock
		mockRepo.On("GetPriceFeedByID", 999).Return(nil, errors.New("not found")).Once()

		// Call service
		err := service.TriggerPriceUpdate(999)

		// Assertions
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
		mockRepo.AssertExpectations(t)
	})

	t.Run("InactiveFeed", func(t *testing.T) {
		// Setup mock
		inactiveFeed := &models.PriceFeed{
			ID:                 2,
			BaseToken:          "ETH",
			QuoteToken:         "USD",
			Pair:               "ETH/USD",
			UpdateInterval:     "1h",
			DeviationThreshold: 0.5,
			HeartbeatInterval:  "24h",
			ContractAddress:    "0x5678",
			Active:             false,
		}
		mockRepo.On("GetPriceFeedByID", 2).Return(inactiveFeed, nil).Once()

		// Call service
		err := service.TriggerPriceUpdate(2)

		// Assertions
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "inactive")
		mockRepo.AssertExpectations(t)
	})
}
