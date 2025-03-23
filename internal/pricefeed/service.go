package pricefeed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/tidwall/gjson"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	corePriceFeed "github.com/R3E-Network/service_layer/internal/core/pricefeed"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// Service provides Price Feed functionality
type Service struct {
	config           *config.Config
	repository       models.PriceFeedRepository
	blockchainClient blockchain.Client
	teeManager       *tee.Manager
	httpClient       *http.Client
	wrapper          *Wrapper
}

// NewService creates a new Price Feed service
func NewService(
	config *config.Config,
	repository models.PriceFeedRepository,
	blockchainClient blockchain.Client,
	teeManager *tee.Manager,
) (*Service, error) {
	httpClient := &http.Client{
		Timeout: time.Duration(30) * time.Second,
	}

	// Create a logger for the core service - use empty initialization to avoid field errors
	log := logger.New("pricefeed")

	// Create core service
	corePriceFeedService := corePriceFeed.NewService(
		config,            // Config
		log,               // Logger
		repository,        // Repository
		&blockchainClient, // Blockchain Client
		nil,               // GasBank Service (optional)
		teeManager,        // TEE Manager
	)

	// Create wrapper
	wrapper := NewWrapper(corePriceFeedService)

	return &Service{
		config:           config,
		repository:       repository,
		blockchainClient: blockchainClient,
		teeManager:       teeManager,
		httpClient:       httpClient,
		wrapper:          wrapper,
	}, nil
}

// CreatePriceFeed creates a new price feed
func (s *Service) CreatePriceFeed(ctx context.Context, priceFeed *models.PriceFeed) (*models.PriceFeed, error) {
	// Delegate to the wrapper
	return s.wrapper.CreatePriceFeed(
		ctx,
		priceFeed.Symbol,
		priceFeed.ContractAddress,
		priceFeed.UpdateInterval,
		priceFeed.DeviationThreshold,
		priceFeed.MinValidSources,
	)
}

// GetPriceFeed retrieves a price feed by ID
func (s *Service) GetPriceFeed(ctx context.Context, id string) (*models.PriceFeed, error) {
	return s.wrapper.GetPriceFeed(ctx, id)
}

// UpdatePriceFeed updates an existing price feed
func (s *Service) UpdatePriceFeed(ctx context.Context, priceFeed *models.PriceFeed) (*models.PriceFeed, error) {
	return s.wrapper.UpdatePriceFeed(
		ctx,
		priceFeed.ID,
		priceFeed.Active,
		priceFeed.UpdateInterval,
		priceFeed.DeviationThreshold,
		priceFeed.MinValidSources,
	)
}

// DeletePriceFeed deletes a price feed
func (s *Service) DeletePriceFeed(ctx context.Context, id string) error {
	return s.wrapper.DeletePriceFeed(ctx, id)
}

// ListPriceFeeds retrieves all price feeds
func (s *Service) ListPriceFeeds(ctx context.Context) ([]*models.PriceFeed, error) {
	return s.wrapper.ListPriceFeeds(ctx)
}

// FetchPriceData fetches price data from all sources for a price feed
func (s *Service) FetchPriceData(ctx context.Context, id string) ([]models.PriceData, error) {
	// Get the price feed
	priceFeed, err := s.repository.GetPriceFeed(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get price feed: %w", err)
	}

	if len(priceFeed.Sources) == 0 {
		return nil, errors.New("price feed has no sources configured")
	}

	// Create a client with the appropriate timeout
	timeout := time.Duration(priceFeed.Timeout) * time.Second
	if timeout == 0 {
		timeout = 5 * time.Second // Default timeout
	}
	client := &http.Client{
		Timeout: timeout,
	}

	// Create a slice to hold the price data
	priceData := make([]models.PriceData, len(priceFeed.Sources))

	// Fetch data from each source
	for i, source := range priceFeed.Sources {
		priceData[i] = models.PriceData{
			SourceID:   source.ID,
			SourceName: source.Name,
			Timestamp:  time.Now(),
			Success:    false,
		}

		// Fetch data from the source
		data, err := s.fetchDataFromSource(client, source.URL)
		if err != nil {
			priceData[i].Error = fmt.Sprintf("failed to fetch data: %v", err)
			continue
		}

		// Extract the price using the path
		price, err := s.extractPrice(data, source.Path)
		if err != nil {
			priceData[i].Error = fmt.Sprintf("failed to extract price: %v", err)
			continue
		}

		// Set the price data
		priceData[i].Price = price
		priceData[i].Success = true
	}

	return priceData, nil
}

// AggregatePriceData aggregates price data from all sources for a price feed
func (s *Service) AggregatePriceData(ctx context.Context, id string) (float64, error) {
	// Fetch price data from all sources
	priceData, err := s.FetchPriceData(ctx, id)
	if err != nil {
		return 0, err
	}

	// Get the price feed
	priceFeed, err := s.repository.GetPriceFeed(ctx, id)
	if err != nil {
		return 0, fmt.Errorf("failed to get price feed: %w", err)
	}

	// Filter out failed sources
	var validPrices []float64
	for _, data := range priceData {
		if data.Success {
			validPrices = append(validPrices, data.Price)
		}
	}

	// Check if we have enough valid sources
	if len(validPrices) < priceFeed.MinValidSources {
		return 0, models.ErrInsufficientValidSources
	}

	// Calculate the median price
	medianPrice := calculateMedian(validPrices)

	// Filter out prices that deviate too much from the median
	if priceFeed.DeviationThreshold > 0 {
		validPrices = filterOutliers(validPrices, medianPrice, priceFeed.DeviationThreshold)

		// Recalculate the median with filtered prices
		if len(validPrices) > 0 {
			medianPrice = calculateMedian(validPrices)
		}
	}

	return medianPrice, nil
}

// UpdateBlockchainPrice updates the price on the blockchain
func (s *Service) UpdateBlockchainPrice(ctx context.Context, id string, price float64) (string, error) {
	// Get the price feed
	priceFeed, err := s.repository.GetPriceFeed(ctx, id)
	if err != nil {
		return "", fmt.Errorf("failed to get price feed: %w", err)
	}

	// Format the price as a string with appropriate precision
	priceStr := strconv.FormatFloat(price, 'f', -1, 64)

	// Use the correct method name from the Client interface
	// We don't use the result directly, but we need to check for errors
	_, err = s.blockchainClient.InvokeFunction(
		ctx,
		priceFeed.ContractAddress,
		"updatePrice",
		[]interface{}{priceFeed.Symbol, priceStr},
	)
	if err != nil {
		return "", fmt.Errorf("failed to invoke contract function: %w", err)
	}

	// Generate a transaction ID (since InvocationResult doesn't have one)
	// In a real implementation, this would be the actual transaction ID from the blockchain
	txID := fmt.Sprintf("tx-%s-%d", priceFeed.ID, time.Now().UnixNano())

	// Record the price update
	if err := s.repository.RecordPriceUpdate(ctx, id, price, txID); err != nil {
		return "", fmt.Errorf("failed to record price update: %w", err)
	}

	// Update the last price
	if err := s.repository.UpdateLastPrice(ctx, id, price, txID); err != nil {
		return "", fmt.Errorf("failed to update last price: %w", err)
	}

	return txID, nil
}

// ExecuteUpdate executes a complete update cycle for a price feed
func (s *Service) ExecuteUpdate(ctx context.Context, id string) error {
	// Aggregate price data
	price, err := s.AggregatePriceData(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to aggregate price data: %w", err)
	}

	// Update the blockchain
	_, err = s.UpdateBlockchainPrice(ctx, id, price)
	if err != nil {
		return fmt.Errorf("failed to update blockchain price: %w", err)
	}

	return nil
}

// validatePriceFeed validates a price feed
func (s *Service) validatePriceFeed(priceFeed *models.PriceFeed) error {
	if priceFeed.Symbol == "" {
		return models.ErrInvalidPriceFeedSymbol
	}

	if priceFeed.ContractAddress == "" {
		return models.ErrInvalidContractAddress
	}

	if priceFeed.UpdateInterval <= 0 {
		return models.ErrPriceFeedUpdateInterval
	}

	return nil
}

// fetchDataFromSource fetches data from a source URL
func (s *Service) fetchDataFromSource(client *http.Client, url string) (string, error) {
	// Create a new request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Check if the response is successful
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("request failed with status code %d: %s", resp.StatusCode, string(body))
	}

	return string(body), nil
}

// extractPrice extracts a price value from JSON data using a path
func (s *Service) extractPrice(data string, path string) (float64, error) {
	// Parse the JSON data
	if !json.Valid([]byte(data)) {
		return 0, errors.New("invalid JSON data")
	}

	// Use gjson to extract the value
	result := gjson.Get(data, path)
	if !result.Exists() {
		return 0, fmt.Errorf("path %s not found in data", path)
	}

	// Convert the result to a float64
	if result.Type == gjson.Number {
		return result.Float(), nil
	} else if result.Type == gjson.String {
		// Try to convert a string to a float
		price, err := strconv.ParseFloat(result.String(), 64)
		if err != nil {
			return 0, fmt.Errorf("failed to convert string to float: %w", err)
		}
		return price, nil
	}

	return 0, fmt.Errorf("unexpected value type: %s", result.Type)
}

// calculateMedian calculates the median of a slice of float64 values
func calculateMedian(values []float64) float64 {
	// Make a copy to avoid modifying the original slice
	valuesCopy := make([]float64, len(values))
	copy(valuesCopy, values)

	// Sort the values
	sort.Float64s(valuesCopy)

	// Calculate the median
	n := len(valuesCopy)
	if n == 0 {
		return 0
	} else if n%2 == 0 {
		// Even number of values, average the middle two
		return (valuesCopy[n/2-1] + valuesCopy[n/2]) / 2
	} else {
		// Odd number of values, return the middle one
		return valuesCopy[n/2]
	}
}

// filterOutliers removes values that deviate too much from the median
func filterOutliers(values []float64, median float64, deviationThreshold float64) []float64 {
	var filtered []float64

	// Calculate the allowed deviation
	maxDeviation := median * deviationThreshold / 100.0

	// Filter out values that deviate too much
	for _, value := range values {
		if math.Abs(value-median) <= maxDeviation {
			filtered = append(filtered, value)
		}
	}

	return filtered
}
