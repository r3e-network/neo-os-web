package pricefeed

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/gasbank"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// PriceFeedService handles price feed operations
type PriceFeedService struct {
	config               *config.Config
	logger               *logger.Logger
	priceFeedRepository  models.PriceFeedRepository
	blockchainClient     *blockchain.Client
	gasBankService       *gasbank.Service
	teeManager           *tee.Manager
	fetcherFactory       PriceFetcherFactory
	aggregator           PriceAggregator
	updateScheduler      *UpdateScheduler
	updateTriggerChan    chan *models.PriceFeed
	shutdownChan         chan struct{}
	runningUpdateWorkers sync.WaitGroup
}

// PriceFetcherFactory creates price fetchers for different sources
type PriceFetcherFactory interface {
	CreateFetcher(source *models.PriceSource) (PriceFetcher, error)
}

// PriceFetcher fetches price data from an external source
type PriceFetcher interface {
	FetchPrice(ctx context.Context, baseToken, quoteToken string) (float64, error)
}

// PriceAggregator aggregates price data from multiple sources
type PriceAggregator interface {
	Aggregate(prices map[string]float64, weights map[string]float64) (float64, error)
}

// UpdateScheduler schedules price updates
type UpdateScheduler struct {
	feeds      map[int]*models.PriceFeed
	timers     map[int]*time.Timer
	heartbeats map[int]*time.Timer
	mu         sync.RWMutex
	triggerCh  chan *models.PriceFeed
}

// NewService creates a new price feed service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	priceFeedRepository models.PriceFeedRepository,
	blockchainClient *blockchain.Client,
	gasBankService *gasbank.Service,
	teeManager *tee.Manager,
) *PriceFeedService {
	service := &PriceFeedService{
		config:              cfg,
		logger:              log,
		priceFeedRepository: priceFeedRepository,
		blockchainClient:    blockchainClient,
		gasBankService:      gasBankService,
		teeManager:          teeManager,
		fetcherFactory:      NewDefaultFetcherFactory(cfg, log),
		aggregator:          NewMedianAggregator(),
		updateTriggerChan:   make(chan *models.PriceFeed, 100),
		shutdownChan:        make(chan struct{}),
	}

	service.updateScheduler = NewUpdateScheduler(service.updateTriggerChan)

	return service
}

// Start starts the price feed service
func (s *PriceFeedService) Start(ctx context.Context) error {
	s.logger.Info("Starting price feed service")

	// Start update workers
	numWorkers := s.config.Services.PriceFeed.NumWorkers
	if numWorkers <= 0 {
		numWorkers = 5 // Default number of workers
	}

	for i := 0; i < numWorkers; i++ {
		s.runningUpdateWorkers.Add(1)
		go s.updateWorker(ctx)
	}

	// Load all active price feeds
	feeds, err := s.priceFeedRepository.ListPriceFeeds()
	if err != nil {
		return fmt.Errorf("failed to load price feeds: %w", err)
	}

	// Schedule updates for all active feeds
	for _, feed := range feeds {
		if feed.Active {
			if err := s.scheduleUpdates(feed); err != nil {
				s.logger.Errorf("Failed to schedule updates for feed %d (%s): %v", feed.ID, feed.Pair, err)
				continue
			}
		}
	}

	s.logger.Info("Price feed service started")
	return nil
}

// Stop stops the price feed service
func (s *PriceFeedService) Stop() {
	s.logger.Info("Stopping price feed service")

	// Stop the update scheduler
	s.updateScheduler.Stop()

	// Signal all workers to stop
	close(s.shutdownChan)

	// Wait for all workers to finish
	s.runningUpdateWorkers.Wait()

	s.logger.Info("Price feed service stopped")
}

// CreatePriceFeed creates a new price feed
func (s *PriceFeedService) CreatePriceFeed(
	baseToken, quoteToken, updateInterval string,
	deviationThreshold float64,
	heartbeatInterval, contractAddress string,
) (*models.PriceFeed, error) {
	// Validate input
	if baseToken == "" || quoteToken == "" {
		return nil, errors.New("base token and quote token are required")
	}

	// Create pair string
	pair := fmt.Sprintf("%s/%s", baseToken, quoteToken)

	// Check if pair already exists
	existingFeed, err := s.priceFeedRepository.GetPriceFeedByPair(pair)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing feed: %w", err)
	}
	if existingFeed != nil {
		return nil, fmt.Errorf("price feed for pair %s already exists", pair)
	}

	// Set default values if not provided
	if updateInterval == "" {
		updateInterval = s.config.Services.PriceFeed.DefaultUpdateInterval
	}

	if deviationThreshold <= 0 {
		deviationThreshold = s.config.Services.PriceFeed.DefaultDeviationThreshold
	}

	if heartbeatInterval == "" {
		heartbeatInterval = s.config.Services.PriceFeed.DefaultHeartbeatInterval
	}

	// Create feed
	feed := &models.PriceFeed{
		BaseToken:          baseToken,
		QuoteToken:         quoteToken,
		Pair:               pair,
		UpdateInterval:     updateInterval,
		DeviationThreshold: deviationThreshold,
		HeartbeatInterval:  heartbeatInterval,
		ContractAddress:    contractAddress,
		Active:             true,
	}

	// Save to database
	feed, err = s.priceFeedRepository.CreatePriceFeed(feed)
	if err != nil {
		return nil, fmt.Errorf("failed to create price feed: %w", err)
	}

	// If the feed is active, schedule updates
	if feed.Active {
		if err := s.scheduleUpdates(feed); err != nil {
			s.logger.Errorf("Failed to schedule updates for feed %d (%s): %v", feed.ID, feed.Pair, err)
		}
	}

	s.logger.Infof("Created price feed %d (%s)", feed.ID, feed.Pair)
	return feed, nil
}

// UpdatePriceFeed updates a price feed
func (s *PriceFeedService) UpdatePriceFeed(
	id int,
	baseToken, quoteToken, updateInterval string,
	deviationThreshold float64,
	heartbeatInterval, contractAddress string,
	active bool,
) (*models.PriceFeed, error) {
	// Get existing feed
	feed, err := s.priceFeedRepository.GetPriceFeedByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get price feed: %w", err)
	}
	if feed == nil {
		return nil, errors.New("price feed not found")
	}

	// Update fields if provided
	if baseToken != "" {
		feed.BaseToken = baseToken
	}

	if quoteToken != "" {
		feed.QuoteToken = quoteToken
	}

	if baseToken != "" || quoteToken != "" {
		feed.Pair = fmt.Sprintf("%s/%s", feed.BaseToken, feed.QuoteToken)
	}

	if updateInterval != "" {
		feed.UpdateInterval = updateInterval
	}

	if deviationThreshold > 0 {
		feed.DeviationThreshold = deviationThreshold
	}

	if heartbeatInterval != "" {
		feed.HeartbeatInterval = heartbeatInterval
	}

	if contractAddress != "" {
		feed.ContractAddress = contractAddress
	}

	previouslyActive := feed.Active
	feed.Active = active

	// Save to database
	feed, err = s.priceFeedRepository.UpdatePriceFeed(feed)
	if err != nil {
		return nil, fmt.Errorf("failed to update price feed: %w", err)
	}

	// Handle scheduling changes based on active status
	if feed.Active && !previouslyActive {
		// Feed was activated
		if err := s.scheduleUpdates(feed); err != nil {
			s.logger.Errorf("Failed to schedule updates for feed %d (%s): %v", feed.ID, feed.Pair, err)
		}
	} else if !feed.Active && previouslyActive {
		// Feed was deactivated
		s.updateScheduler.RemoveFeed(feed.ID)
	} else if feed.Active {
		// Feed was already active, but configuration changed
		s.updateScheduler.RemoveFeed(feed.ID)
		if err := s.scheduleUpdates(feed); err != nil {
			s.logger.Errorf("Failed to reschedule updates for feed %d (%s): %v", feed.ID, feed.Pair, err)
		}
	}

	s.logger.Infof("Updated price feed %d (%s)", feed.ID, feed.Pair)
	return feed, nil
}

// DeletePriceFeed deletes a price feed
func (s *PriceFeedService) DeletePriceFeed(id int) error {
	// Get existing feed
	feed, err := s.priceFeedRepository.GetPriceFeedByID(id)
	if err != nil {
		return fmt.Errorf("failed to get price feed: %w", err)
	}
	if feed == nil {
		return errors.New("price feed not found")
	}

	// Remove from scheduler if active
	if feed.Active {
		s.updateScheduler.RemoveFeed(feed.ID)
	}

	// Delete from database
	if err := s.priceFeedRepository.DeletePriceFeed(id); err != nil {
		return fmt.Errorf("failed to delete price feed: %w", err)
	}

	s.logger.Infof("Deleted price feed %d (%s)", feed.ID, feed.Pair)
	return nil
}

// GetPriceFeed gets a price feed by ID
func (s *PriceFeedService) GetPriceFeed(id int) (*models.PriceFeed, error) {
	return s.priceFeedRepository.GetPriceFeedByID(id)
}

// GetPriceFeedByPair gets a price feed by token pair
func (s *PriceFeedService) GetPriceFeedByPair(pair string) (*models.PriceFeed, error) {
	return s.priceFeedRepository.GetPriceFeedByPair(pair)
}

// ListPriceFeeds lists all price feeds
func (s *PriceFeedService) ListPriceFeeds() ([]*models.PriceFeed, error) {
	return s.priceFeedRepository.ListPriceFeeds()
}

// GetLatestPrice gets the latest price for a price feed
func (s *PriceFeedService) GetLatestPrice(priceFeedID int) (*models.PriceData, error) {
	return s.priceFeedRepository.GetLatestPriceData(priceFeedID)
}

// GetPriceHistory gets the price history for a price feed
func (s *PriceFeedService) GetPriceHistory(priceFeedID int, limit, offset int) ([]*models.PriceData, error) {
	return s.priceFeedRepository.GetPriceDataHistory(priceFeedID, limit, offset)
}

// TriggerPriceUpdate manually triggers a price update
func (s *PriceFeedService) TriggerPriceUpdate(priceFeedID int) error {
	feed, err := s.priceFeedRepository.GetPriceFeedByID(priceFeedID)
	if err != nil {
		return fmt.Errorf("failed to get price feed: %w", err)
	}
	if feed == nil {
		return errors.New("price feed not found")
	}

	if !feed.Active {
		return errors.New("cannot update inactive price feed")
	}

	// Trigger update
	s.updateTriggerChan <- feed
	return nil
}

// scheduleUpdates schedules regular price updates for a feed
func (s *PriceFeedService) scheduleUpdates(feed *models.PriceFeed) error {
	return s.updateScheduler.AddFeed(feed)
}

// updateWorker processes price updates
func (s *PriceFeedService) updateWorker(ctx context.Context) {
	defer s.runningUpdateWorkers.Done()

	for {
		select {
		case <-s.shutdownChan:
			return
		case feed := <-s.updateTriggerChan:
			s.processPriceUpdate(ctx, feed)
		}
	}
}

// processPriceUpdate processes a price update for a feed
func (s *PriceFeedService) processPriceUpdate(ctx context.Context, feed *models.PriceFeed) {
	s.logger.Infof("Processing price update for feed %d (%s)", feed.ID, feed.Pair)

	// Step 1: Fetch prices from all sources
	prices, err := s.fetchPrices(ctx, feed.BaseToken, feed.QuoteToken)
	if err != nil {
		s.logger.Errorf("Failed to fetch prices for feed %d (%s): %v", feed.ID, feed.Pair, err)
		return
	}

	if len(prices) == 0 {
		s.logger.Errorf("No prices fetched for feed %d (%s)", feed.ID, feed.Pair)
		return
	}

	// Step 2: Get weights for each source
	weights := make(map[string]float64)
	for sourceName := range prices {
		// In a real implementation, we would get the weight from the source configuration
		weights[sourceName] = 1.0
	}

	// Step 3: Aggregate prices
	aggregatedPrice, err := s.aggregator.Aggregate(prices, weights)
	if err != nil {
		s.logger.Errorf("Failed to aggregate prices for feed %d (%s): %v", feed.ID, feed.Pair, err)
		return
	}

	// Step 4: Check if update is needed based on deviation or heartbeat
	needsUpdate, err := s.needsUpdate(feed, aggregatedPrice)
	if err != nil {
		s.logger.Errorf("Failed to check if update is needed for feed %d (%s): %v", feed.ID, feed.Pair, err)
		return
	}

	if !needsUpdate {
		s.logger.Infof("No update needed for feed %d (%s)", feed.ID, feed.Pair)
		return
	}

	// Step 5: Update on-chain price
	roundID, txHash, err := s.updateOnChainPrice(ctx, feed, aggregatedPrice)
	if err != nil {
		s.logger.Errorf("Failed to update on-chain price for feed %d (%s): %v", feed.ID, feed.Pair, err)
		return
	}

	// Step 6: Record price update
	priceData := &models.PriceData{
		PriceFeedID: feed.ID,
		Price:       aggregatedPrice,
		Timestamp:   time.Now().UTC(),
		RoundID:     roundID,
		TxHash:      txHash,
		Source:      "aggregate",
	}

	_, err = s.priceFeedRepository.CreatePriceData(priceData)
	if err != nil {
		s.logger.Errorf("Failed to record price data for feed %d (%s): %v", feed.ID, feed.Pair, err)
		return
	}

	s.logger.Infof("Price update completed for feed %d (%s): %f", feed.ID, feed.Pair, aggregatedPrice)
}

// fetchPrices fetches prices from all configured sources
func (s *PriceFeedService) fetchPrices(ctx context.Context, baseToken, quoteToken string) (map[string]float64, error) {
	// Get all active price sources
	sources, err := s.priceFeedRepository.ListPriceSources()
	if err != nil {
		return nil, fmt.Errorf("failed to list price sources: %w", err)
	}

	activeSources := make([]*models.PriceSource, 0)
	for _, source := range sources {
		if source.Active {
			activeSources = append(activeSources, source)
		}
	}

	if len(activeSources) == 0 {
		return nil, errors.New("no active price sources found")
	}

	// Fetch prices from all sources in parallel
	prices := make(map[string]float64)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, source := range activeSources {
		wg.Add(1)
		go func(src *models.PriceSource) {
			defer wg.Done()

			fetcher, err := s.fetcherFactory.CreateFetcher(src)
			if err != nil {
				s.logger.Errorf("Failed to create fetcher for source %s: %v", src.Name, err)
				return
			}

			// Create a context with timeout
			timeout, err := time.ParseDuration(src.Timeout)
			if err != nil {
				timeout = 5 * time.Second // Default timeout
			}
			fetchCtx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()

			// Fetch price
			price, err := fetcher.FetchPrice(fetchCtx, baseToken, quoteToken)
			if err != nil {
				s.logger.Errorf("Failed to fetch price from source %s: %v", src.Name, err)
				return
			}

			// Store price
			mu.Lock()
			prices[src.Name] = price
			mu.Unlock()
		}(source)
	}

	wg.Wait()
	return prices, nil
}

// needsUpdate checks if a price update is needed based on deviation or heartbeat
func (s *PriceFeedService) needsUpdate(feed *models.PriceFeed, newPrice float64) (bool, error) {
	latestPrice, err := s.priceFeedRepository.GetLatestPriceData(feed.ID)
	if err != nil {
		return false, fmt.Errorf("failed to get latest price data: %w", err)
	}

	// If no previous price, update is needed
	if latestPrice == nil {
		return true, nil
	}

	// Check deviation
	if feed.DeviationThreshold > 0 {
		deviation := math.Abs((newPrice-latestPrice.Price)/latestPrice.Price) * 100
		if deviation >= feed.DeviationThreshold {
			return true, nil
		}
	}

	// Check heartbeat
	heartbeatDuration, err := time.ParseDuration(feed.HeartbeatInterval)
	if err != nil {
		return false, fmt.Errorf("invalid heartbeat interval: %w", err)
	}

	timeSinceLastUpdate := time.Since(latestPrice.Timestamp)
	if timeSinceLastUpdate >= heartbeatDuration {
		return true, nil
	}

	return false, nil
}

// updateOnChainPrice updates the price on the blockchain
func (s *PriceFeedService) updateOnChainPrice(ctx context.Context, feed *models.PriceFeed, price float64) (int64, string, error) {
	if feed.ContractAddress == "" {
		return 0, "", errors.New("contract address not configured")
	}

	// Get latest round ID
	latestPrice, err := s.priceFeedRepository.GetLatestPriceData(feed.ID)
	if err != nil {
		return 0, "", fmt.Errorf("failed to get latest price data: %w", err)
	}

	// Calculate new round ID
	var roundID int64 = 1
	if latestPrice != nil {
		roundID = latestPrice.RoundID + 1
	}

	// In a real implementation, this would use the blockchain client to send a transaction
	// For now, we'll log the price update and return a placeholder transaction hash
	s.logger.Infof("Would update price for feed %d (%s) on contract %s: roundID=%d, price=%f",
		feed.ID, feed.Pair, feed.ContractAddress, roundID, price)

	// Simulate blockchain transaction
	txHash := fmt.Sprintf("0x%032x", time.Now().UnixNano())

	return roundID, txHash, nil
}

// NewUpdateScheduler creates a new update scheduler
func NewUpdateScheduler(triggerCh chan *models.PriceFeed) *UpdateScheduler {
	return &UpdateScheduler{
		feeds:      make(map[int]*models.PriceFeed),
		timers:     make(map[int]*time.Timer),
		heartbeats: make(map[int]*time.Timer),
		triggerCh:  triggerCh,
	}
}

// AddFeed adds a feed to the scheduler
func (u *UpdateScheduler) AddFeed(feed *models.PriceFeed) error {
	u.mu.Lock()
	defer u.mu.Unlock()

	// Store feed
	u.feeds[feed.ID] = feed

	// Parse update interval
	updateInterval, err := time.ParseDuration(feed.UpdateInterval)
	if err != nil {
		return fmt.Errorf("invalid update interval: %w", err)
	}

	// Parse heartbeat interval
	heartbeatInterval, err := time.ParseDuration(feed.HeartbeatInterval)
	if err != nil {
		return fmt.Errorf("invalid heartbeat interval: %w", err)
	}

	// Schedule regular updates
	u.timers[feed.ID] = time.AfterFunc(updateInterval, func() {
		u.triggerUpdate(feed.ID)
	})

	// Schedule heartbeat updates
	u.heartbeats[feed.ID] = time.AfterFunc(heartbeatInterval, func() {
		u.triggerHeartbeat(feed.ID)
	})

	// Trigger immediate update
	u.triggerCh <- feed

	return nil
}

// RemoveFeed removes a feed from the scheduler
func (u *UpdateScheduler) RemoveFeed(feedID int) {
	u.mu.Lock()
	defer u.mu.Unlock()

	// Stop timers
	if timer, ok := u.timers[feedID]; ok {
		timer.Stop()
		delete(u.timers, feedID)
	}

	if heartbeat, ok := u.heartbeats[feedID]; ok {
		heartbeat.Stop()
		delete(u.heartbeats, feedID)
	}

	// Remove feed
	delete(u.feeds, feedID)
}

// Stop stops all timers
func (u *UpdateScheduler) Stop() {
	u.mu.Lock()
	defer u.mu.Unlock()

	// Stop all timers
	for id, timer := range u.timers {
		timer.Stop()
		delete(u.timers, id)
	}

	for id, heartbeat := range u.heartbeats {
		heartbeat.Stop()
		delete(u.heartbeats, id)
	}

	u.feeds = make(map[int]*models.PriceFeed)
}

// triggerUpdate triggers an update for a feed
func (u *UpdateScheduler) triggerUpdate(feedID int) {
	u.mu.RLock()
	feed, ok := u.feeds[feedID]
	if !ok {
		u.mu.RUnlock()
		return
	}

	// Reschedule next update
	updateInterval, err := time.ParseDuration(feed.UpdateInterval)
	if err == nil {
		// Stop existing timer if any
		if timer, ok := u.timers[feedID]; ok {
			timer.Stop()
		}

		// Schedule next update
		u.timers[feedID] = time.AfterFunc(updateInterval, func() {
			u.triggerUpdate(feedID)
		})
	}
	u.mu.RUnlock()

	// Trigger update
	u.triggerCh <- feed
}

// triggerHeartbeat triggers a heartbeat update for a feed
func (u *UpdateScheduler) triggerHeartbeat(feedID int) {
	u.mu.RLock()
	feed, ok := u.feeds[feedID]
	if !ok {
		u.mu.RUnlock()
		return
	}

	// Reschedule next heartbeat
	heartbeatInterval, err := time.ParseDuration(feed.HeartbeatInterval)
	if err == nil {
		// Stop existing timer if any
		if timer, ok := u.heartbeats[feedID]; ok {
			timer.Stop()
		}

		// Schedule next heartbeat
		u.heartbeats[feedID] = time.AfterFunc(heartbeatInterval, func() {
			u.triggerHeartbeat(feedID)
		})
	}
	u.mu.RUnlock()

	// Trigger update
	u.triggerCh <- feed
}

// DefaultFetcherFactory is the default implementation of PriceFetcherFactory
type DefaultFetcherFactory struct {
	config *config.Config
	logger *logger.Logger
}

// NewDefaultFetcherFactory creates a new default fetcher factory
func NewDefaultFetcherFactory(cfg *config.Config, log *logger.Logger) *DefaultFetcherFactory {
	return &DefaultFetcherFactory{
		config: cfg,
		logger: log,
	}
}

// CreateFetcher creates a price fetcher for a source
func (f *DefaultFetcherFactory) CreateFetcher(source *models.PriceSource) (PriceFetcher, error) {
	switch source.Name {
	case "binance":
		return NewBinanceFetcher(f.config, f.logger), nil
	case "coingecko":
		return NewCoinGeckoFetcher(f.config, f.logger), nil
	case "coinmarketcap":
		return NewCoinMarketCapFetcher(f.config, f.logger), nil
	case "huobi":
		return NewHuobiFetcher(f.config, f.logger), nil
	case "okx":
		return NewOKXFetcher(f.config, f.logger), nil
	default:
		return nil, fmt.Errorf("unsupported price source: %s", source.Name)
	}
}

// MedianAggregator is a price aggregator that uses median price
type MedianAggregator struct{}

// NewMedianAggregator creates a new median aggregator
func NewMedianAggregator() *MedianAggregator {
	return &MedianAggregator{}
}

// Aggregate aggregates prices using median
func (a *MedianAggregator) Aggregate(prices map[string]float64, weights map[string]float64) (float64, error) {
	if len(prices) == 0 {
		return 0, errors.New("no prices to aggregate")
	}

	// If only one price, return it
	if len(prices) == 1 {
		for _, price := range prices {
			return price, nil
		}
	}

	// Extract prices and sort them
	priceValues := make([]float64, 0, len(prices))
	for _, price := range prices {
		priceValues = append(priceValues, price)
	}

	// Simple median calculation for now
	// In a real implementation, we would use a weighted median
	// or other more sophisticated aggregation method
	if len(priceValues) == 2 {
		return (priceValues[0] + priceValues[1]) / 2, nil
	}

	// For > 2 prices, use a proper median
	// This is a simple implementation - in reality we would use a library or more optimized approach
	// Sort the prices
	for i := 0; i < len(priceValues)-1; i++ {
		for j := 0; j < len(priceValues)-i-1; j++ {
			if priceValues[j] > priceValues[j+1] {
				priceValues[j], priceValues[j+1] = priceValues[j+1], priceValues[j]
			}
		}
	}

	// Return the median
	middle := len(priceValues) / 2
	if len(priceValues)%2 == 0 {
		return (priceValues[middle-1] + priceValues[middle]) / 2, nil
	}
	return priceValues[middle], nil
}
