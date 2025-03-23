package mocks

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/models"
)

// MockPriceFeedRepository implements a mock repository for Price Feed tests
type MockPriceFeedRepository struct {
	priceFeeds   map[string]*models.PriceFeed
	priceUpdates map[string][]*models.PriceUpdate
	mutex        sync.RWMutex
}

// NewMockPriceFeedRepository creates a new mock Price Feed repository
func NewMockPriceFeedRepository() *MockPriceFeedRepository {
	return &MockPriceFeedRepository{
		priceFeeds:   make(map[string]*models.PriceFeed),
		priceUpdates: make(map[string][]*models.PriceUpdate),
	}
}

// CreatePriceFeed creates a new price feed
func (r *MockPriceFeedRepository) CreatePriceFeed(ctx interface{}, priceFeed *models.PriceFeed) (*models.PriceFeed, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// Generate a unique ID if not provided
	if priceFeed.ID == "" {
		priceFeed.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now()
	priceFeed.CreatedAt = now
	priceFeed.UpdatedAt = now

	// Store the price feed
	r.priceFeeds[priceFeed.ID] = priceFeed

	// Return a copy to avoid modifying the stored value
	return r.copyPriceFeed(priceFeed), nil
}

// GetPriceFeed retrieves a price feed by ID
func (r *MockPriceFeedRepository) GetPriceFeed(ctx interface{}, id string) (*models.PriceFeed, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	priceFeed, exists := r.priceFeeds[id]
	if !exists {
		return nil, models.ErrPriceFeedNotFound
	}

	return r.copyPriceFeed(priceFeed), nil
}

// UpdatePriceFeed updates an existing price feed
func (r *MockPriceFeedRepository) UpdatePriceFeed(ctx interface{}, priceFeed *models.PriceFeed) (*models.PriceFeed, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.priceFeeds[priceFeed.ID]
	if !exists {
		return nil, models.ErrPriceFeedNotFound
	}

	// Update timestamp
	priceFeed.UpdatedAt = time.Now()

	// Store the updated price feed
	r.priceFeeds[priceFeed.ID] = priceFeed

	return r.copyPriceFeed(priceFeed), nil
}

// DeletePriceFeed deletes a price feed
func (r *MockPriceFeedRepository) DeletePriceFeed(ctx interface{}, id string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.priceFeeds[id]
	if !exists {
		return models.ErrPriceFeedNotFound
	}

	delete(r.priceFeeds, id)
	delete(r.priceUpdates, id)
	return nil
}

// ListPriceFeeds retrieves all price feeds
func (r *MockPriceFeedRepository) ListPriceFeeds(ctx interface{}) ([]*models.PriceFeed, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make([]*models.PriceFeed, 0, len(r.priceFeeds))
	for _, priceFeed := range r.priceFeeds {
		result = append(result, r.copyPriceFeed(priceFeed))
	}

	return result, nil
}

// GetPriceFeedBySymbol retrieves a price feed by symbol
func (r *MockPriceFeedRepository) GetPriceFeedBySymbol(ctx interface{}, symbol string) (*models.PriceFeed, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	for _, priceFeed := range r.priceFeeds {
		if priceFeed.Symbol == symbol {
			return r.copyPriceFeed(priceFeed), nil
		}
	}

	return nil, models.ErrPriceFeedNotFound
}

// AddPriceSource adds a price source to a price feed
func (r *MockPriceFeedRepository) AddPriceSource(ctx interface{}, priceFeedID string, source *models.PriceSource) (*models.PriceSource, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	priceFeed, exists := r.priceFeeds[priceFeedID]
	if !exists {
		return nil, models.ErrPriceFeedNotFound
	}

	// Generate a unique ID if not provided
	if source.ID == "" {
		source.ID = uuid.New().String()
	}

	// Set created and updated timestamps
	now := time.Now()
	source.CreatedAt = now
	source.UpdatedAt = now

	// Add the source to the price feed
	priceFeed.Sources = append(priceFeed.Sources, *source)
	priceFeed.UpdatedAt = now

	return source, nil
}

// RemovePriceSource removes a price source from a price feed
func (r *MockPriceFeedRepository) RemovePriceSource(ctx interface{}, priceFeedID string, sourceID string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	priceFeed, exists := r.priceFeeds[priceFeedID]
	if !exists {
		return models.ErrPriceFeedNotFound
	}

	// Find and remove the source
	for i, source := range priceFeed.Sources {
		if source.ID == sourceID {
			// Remove the source from the slice
			priceFeed.Sources = append(priceFeed.Sources[:i], priceFeed.Sources[i+1:]...)
			priceFeed.UpdatedAt = time.Now()
			return nil
		}
	}

	return errors.New("price source not found")
}

// UpdateLastPrice updates the last price for a price feed
func (r *MockPriceFeedRepository) UpdateLastPrice(ctx interface{}, id string, price float64, txHash string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	priceFeed, exists := r.priceFeeds[id]
	if !exists {
		return models.ErrPriceFeedNotFound
	}

	// Update the price feed
	priceFeed.LastPrice = price
	priceFeed.LastTxHash = txHash
	priceFeed.LastUpdated = time.Now()
	priceFeed.UpdatedAt = time.Now()

	return nil
}

// RecordPriceUpdate records a price update
func (r *MockPriceFeedRepository) RecordPriceUpdate(ctx interface{}, id string, price float64, txID string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	priceFeed, exists := r.priceFeeds[id]
	if !exists {
		return models.ErrPriceFeedNotFound
	}

	// Create a new price update
	priceUpdate := &models.PriceUpdate{
		ID:            uuid.New().String(),
		PriceFeedID:   id,
		Symbol:        priceFeed.Symbol,
		Price:         price,
		TransactionID: txID,
		Success:       true,
		Timestamp:     time.Now(),
	}

	// Add the update to the list
	r.priceUpdates[id] = append(r.priceUpdates[id], priceUpdate)

	return nil
}

// GetPriceHistory retrieves the price history for a price feed
func (r *MockPriceFeedRepository) GetPriceHistory(ctx interface{}, id string, limit int) ([]*models.PriceUpdate, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	_, exists := r.priceFeeds[id]
	if !exists {
		return nil, models.ErrPriceFeedNotFound
	}

	// Get the updates
	updates := r.priceUpdates[id]

	// Apply the limit
	if limit > 0 && limit < len(updates) {
		// Return the most recent updates
		start := len(updates) - limit
		return updates[start:], nil
	}

	return updates, nil
}

// Helper method to create a copy of a price feed to avoid modifying the stored data
func (r *MockPriceFeedRepository) copyPriceFeed(priceFeed *models.PriceFeed) *models.PriceFeed {
	copy := *priceFeed

	// Deep copy the sources slice
	if priceFeed.Sources != nil {
		copy.Sources = make([]models.PriceSource, len(priceFeed.Sources))
		for i, source := range priceFeed.Sources {
			copy.Sources[i] = source
		}
	}

	return &copy
}
