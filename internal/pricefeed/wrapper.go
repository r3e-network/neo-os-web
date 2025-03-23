package pricefeed

import (
	"context"
	"fmt"
	"strconv"

	"github.com/R3E-Network/service_layer/internal/core/pricefeed"
	"github.com/R3E-Network/service_layer/internal/models"
)

// Wrapper implements the models.PriceFeedService interface by delegating to the core implementation
type Wrapper struct {
	coreService *pricefeed.PriceFeedService
}

// NewWrapper creates a new wrapper around the core pricefeed service
func NewWrapper(coreService *pricefeed.PriceFeedService) *Wrapper {
	return &Wrapper{
		coreService: coreService,
	}
}

// CreatePriceFeed creates a new price feed
func (w *Wrapper) CreatePriceFeed(ctx context.Context, symbol string, contractAddress string, interval int, threshold float64, minSources int) (*models.PriceFeed, error) {
	// Adapt parameters to core service
	return w.coreService.CreatePriceFeed(symbol, "",
		formatInterval(interval), threshold, formatInterval(interval*10),
		contractAddress)
}

// UpdatePriceFeed updates an existing price feed
func (w *Wrapper) UpdatePriceFeed(ctx context.Context, id string, active bool, interval int, threshold float64, minSources int) (*models.PriceFeed, error) {
	// Convert string ID to int
	idInt, err := parseID(id)
	if err != nil {
		return nil, err
	}

	return w.coreService.UpdatePriceFeed(idInt, "", "",
		formatInterval(interval), threshold, formatInterval(interval*10),
		"", active)
}

// DeletePriceFeed deletes a price feed
func (w *Wrapper) DeletePriceFeed(ctx context.Context, id string) error {
	// Convert string ID to int
	idInt, err := parseID(id)
	if err != nil {
		return err
	}

	return w.coreService.DeletePriceFeed(idInt)
}

// GetPriceFeed gets a price feed by ID
func (w *Wrapper) GetPriceFeed(ctx context.Context, id string) (*models.PriceFeed, error) {
	// Convert string ID to int
	idInt, err := parseID(id)
	if err != nil {
		return nil, err
	}

	return w.coreService.GetPriceFeed(idInt)
}

// GetPriceFeedBySymbol gets a price feed by symbol
func (w *Wrapper) GetPriceFeedBySymbol(ctx context.Context, symbol string) (*models.PriceFeed, error) {
	// The core service uses pair, but we use symbol - we'll need to adapt this
	return w.coreService.GetPriceFeedByPair(symbol)
}

// ListPriceFeeds lists all price feeds
func (w *Wrapper) ListPriceFeeds(ctx context.Context) ([]*models.PriceFeed, error) {
	return w.coreService.ListPriceFeeds()
}

// AddPriceSource adds a price source to a price feed
func (w *Wrapper) AddPriceSource(ctx context.Context, priceFeedID string, name string, url string, path string, weight float64, timeout int) (*models.PriceSource, error) {
	// This method needs to be implemented - the core service doesn't have a direct equivalent
	// This would typically involve fetching the price feed, updating its sources, and saving it
	return nil, nil // Placeholder
}

// UpdatePriceSource updates a price source
func (w *Wrapper) UpdatePriceSource(ctx context.Context, priceFeedID string, sourceID string, active bool, weight float64, timeout int) (*models.PriceSource, error) {
	// This method needs to be implemented - the core service doesn't have a direct equivalent
	return nil, nil // Placeholder
}

// RemovePriceSource removes a price source from a price feed
func (w *Wrapper) RemovePriceSource(ctx context.Context, priceFeedID string, sourceID string) error {
	// This method needs to be implemented - the core service doesn't have a direct equivalent
	return nil // Placeholder
}

// TriggerPriceUpdate triggers a price update for a price feed
func (w *Wrapper) TriggerPriceUpdate(ctx context.Context, priceFeedID string) error {
	// For now, we'll return nil as the core service doesn't have a direct equivalent
	// In a real implementation, we would call the appropriate method on the core service
	// _ = idInt // commented out to avoid linter error
	return nil
}

// FetchLatestPrice fetches the latest price for a symbol
func (w *Wrapper) FetchLatestPrice(ctx context.Context, symbol string) (float64, error) {
	// The core service doesn't have a direct equivalent that returns a float64
	// In a real implementation, we would call the appropriate method and extract the price
	feed, err := w.coreService.GetPriceFeedByPair(symbol)
	if err != nil {
		return 0, err
	}

	if feed != nil && feed.LastPrice > 0 {
		return feed.LastPrice, nil
	}

	return 0, fmt.Errorf("no price available for %s", symbol)
}

// GetPriceHistory gets the price history for a price feed
func (w *Wrapper) GetPriceHistory(ctx context.Context, priceFeedID string, limit int) ([]*models.PriceUpdate, error) {
	// For now, we'll return nil as the core service doesn't have a direct equivalent
	// In a real implementation, we would call the appropriate method on the core service
	// _ = idInt // commented out to avoid linter error
	return nil, nil
}

// Start starts the price feed service
func (w *Wrapper) Start(ctx context.Context) error {
	return w.coreService.Start(ctx)
}

// Stop stops the price feed service
func (w *Wrapper) Stop(ctx context.Context) error {
	w.coreService.Stop()
	return nil
}

// Helper functions

// formatInterval formats an interval in seconds to a duration string
func formatInterval(intervalSeconds int) string {
	return fmt.Sprintf("%ds", intervalSeconds)
}

// parseID converts a string ID to an int
func parseID(id string) (int, error) {
	return strconv.Atoi(id)
}
