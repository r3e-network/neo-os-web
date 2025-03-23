package pricefeed

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	corePriceFeed "github.com/R3E-Network/service_layer/internal/core/pricefeed"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockPriceFeedRepository is a mock implementation of models.PriceFeedRepository
type MockPriceFeedRepository struct {
	mock.Mock
}

func (m *MockPriceFeedRepository) CreatePriceFeed(ctx interface{}, priceFeed *models.PriceFeed) (*models.PriceFeed, error) {
	args := m.Called(ctx, priceFeed)
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceFeed(ctx interface{}, id string) (*models.PriceFeed, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) UpdatePriceFeed(ctx interface{}, priceFeed *models.PriceFeed) (*models.PriceFeed, error) {
	args := m.Called(ctx, priceFeed)
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) DeletePriceFeed(ctx interface{}, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockPriceFeedRepository) ListPriceFeeds(ctx interface{}) ([]*models.PriceFeed, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) GetPriceFeedBySymbol(ctx interface{}, symbol string) (*models.PriceFeed, error) {
	args := m.Called(ctx, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockPriceFeedRepository) AddPriceSource(ctx interface{}, priceFeedID string, source *models.PriceSource) (*models.PriceSource, error) {
	args := m.Called(ctx, priceFeedID, source)
	return args.Get(0).(*models.PriceSource), args.Error(1)
}

func (m *MockPriceFeedRepository) RemovePriceSource(ctx interface{}, priceFeedID string, sourceID string) error {
	args := m.Called(ctx, priceFeedID, sourceID)
	return args.Error(0)
}

func (m *MockPriceFeedRepository) UpdateLastPrice(ctx interface{}, id string, price float64, txHash string) error {
	args := m.Called(ctx, id, price, txHash)
	return args.Error(0)
}

func (m *MockPriceFeedRepository) RecordPriceUpdate(ctx interface{}, id string, price float64, txID string) error {
	args := m.Called(ctx, id, price, txID)
	return args.Error(0)
}

func (m *MockPriceFeedRepository) GetPriceHistory(ctx interface{}, id string, limit int) ([]*models.PriceUpdate, error) {
	args := m.Called(ctx, id, limit)
	return args.Get(0).([]*models.PriceUpdate), args.Error(1)
}

// MockCorePriceFeedService is a mock implementation of the core PriceFeed service
type MockCorePriceFeedService struct {
	mock.Mock
}

func (m *MockCorePriceFeedService) CreatePriceFeed(baseToken, quoteToken, updateInterval string, deviationThreshold float64, heartbeatInterval, contractAddress string) (*models.PriceFeed, error) {
	args := m.Called(baseToken, quoteToken, updateInterval, deviationThreshold, heartbeatInterval, contractAddress)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockCorePriceFeedService) UpdatePriceFeed(id int, baseToken, quoteToken, updateInterval string, deviationThreshold float64, heartbeatInterval, contractAddress string, active bool) (*models.PriceFeed, error) {
	args := m.Called(id, baseToken, quoteToken, updateInterval, deviationThreshold, heartbeatInterval, contractAddress, active)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockCorePriceFeedService) DeletePriceFeed(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockCorePriceFeedService) GetPriceFeed(id int) (*models.PriceFeed, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockCorePriceFeedService) GetPriceFeedByPair(pair string) (*models.PriceFeed, error) {
	args := m.Called(pair)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceFeed), args.Error(1)
}

func (m *MockCorePriceFeedService) ListPriceFeeds() ([]*models.PriceFeed, error) {
	args := m.Called()
	return args.Get(0).([]*models.PriceFeed), args.Error(1)
}

func (m *MockCorePriceFeedService) GetLatestPrice(pair string) (*models.PriceData, error) {
	args := m.Called(pair)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PriceData), args.Error(1)
}

func (m *MockCorePriceFeedService) Start(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockCorePriceFeedService) Stop() {
	m.Called()
}

// Test helper functions
func setupWrapperTest(t *testing.T) (*Wrapper, *MockCorePriceFeedService) {
	mockCoreService := new(MockCorePriceFeedService)
	wrapper := NewWrapper(mockCoreService)
	return wrapper, mockCoreService
}

// Test cases
func TestWrapperCreatePriceFeed(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup expected parameters
	symbol := "BTC/USD"
	contractAddress := "0x1234567890"
	interval := 60
	threshold := 1.0
	minSources := 3

	// Setup expected return
	expectedResult := &models.PriceFeed{
		ID:                 "1",
		Symbol:             symbol,
		ContractAddress:    contractAddress,
		DeviationThreshold: threshold,
		UpdateInterval:     interval,
		MinValidSources:    minSources,
		Active:             true,
		LastUpdated:        time.Now(),
	}

	// Setup mock expectations
	mockCoreService.On(
		"CreatePriceFeed", 
		symbol, 
		"", // empty quoteToken parameter
		fmt.Sprintf("%ds", interval), // formatted interval
		threshold, 
		fmt.Sprintf("%ds", interval*10), // formatted heartbeat interval
		contractAddress,
	).Return(expectedResult, nil)

	// Call the wrapper method
	result, err := wrapper.CreatePriceFeed(ctx, symbol, contractAddress, interval, threshold, minSources)

	// Assert expectations
	assert.NoError(t, err)
	assert.Equal(t, expectedResult, result)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperGetPriceFeed(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup expected parameters
	id := "123"
	expectedID := 123

	// Setup expected return
	expectedResult := &models.PriceFeed{
		ID:              id,
		Symbol:          "BTC/USD",
		ContractAddress: "0x1234567890",
		Active:          true,
	}

	// Setup mock expectations
	mockCoreService.On("GetPriceFeed", expectedID).Return(expectedResult, nil)

	// Call the wrapper method
	result, err := wrapper.GetPriceFeed(ctx, id)

	// Assert expectations
	assert.NoError(t, err)
	assert.Equal(t, expectedResult, result)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperGetPriceFeedInvalidID(t *testing.T) {
	wrapper, _ := setupWrapperTest(t)
	ctx := context.Background()

	// Call with invalid ID
	_, err := wrapper.GetPriceFeed(ctx, "invalid")

	// Should get error for invalid ID format
	assert.Error(t, err)
}

func TestWrapperFetchLatestPrice(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup expected parameters
	symbol := "BTC/USD"

	// Setup expected return from core service
	expectedFeed := &models.PriceFeed{
		ID:        "1",
		Symbol:    symbol,
		LastPrice: 50000.0,
	}

	// Setup mock expectations
	mockCoreService.On("GetPriceFeedByPair", symbol).Return(expectedFeed, nil)

	// Call the wrapper method
	price, err := wrapper.FetchLatestPrice(ctx, symbol)

	// Assert expectations
	assert.NoError(t, err)
	assert.Equal(t, 50000.0, price)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperFetchLatestPriceNotFound(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup expected parameters
	symbol := "UNKNOWN/PAIR"

	// Setup mock expectations - no price feed found
	mockCoreService.On("GetPriceFeedByPair", symbol).Return(nil, fmt.Errorf("not found"))

	// Call the wrapper method
	_, err := wrapper.FetchLatestPrice(ctx, symbol)

	// Assert expectations
	assert.Error(t, err)
	mockCoreService.AssertExpectations(t)
}

func TestWrapperStartAndStop(t *testing.T) {
	wrapper, mockCoreService := setupWrapperTest(t)
	ctx := context.Background()

	// Setup mock expectations
	mockCoreService.On("Start", ctx).Return(nil)
	mockCoreService.On("Stop").Return()

	// Call the wrapper methods
	err := wrapper.Start(ctx)
	assert.NoError(t, err)

	err = wrapper.Stop(ctx)
	assert.NoError(t, err)

	// Assert expectations
	mockCoreService.AssertExpectations(t)
}