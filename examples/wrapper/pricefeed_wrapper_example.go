// This is a reference implementation for the pricefeed wrapper pattern

package pricefeed

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	corePriceFeed "github.com/R3E-Network/service_layer/internal/core/pricefeed"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/internal/tee"
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

	// Create the core service with appropriate configuration
	corePriceFeedService, err := corePriceFeed.NewPriceFeedService(
		config,
		repository,
		&blockchainClient,
		nil, // GasBank service is optional
		teeManager,
		&corePriceFeed.Config{ // Use the Config type from core package
			MinUpdateInterval:  config.PriceFeed.MinInterval,     // Match field names correctly
			MaxUpdateInterval:  config.PriceFeed.MaxInterval,     // Match field names correctly
			MaxPriceFeeds:      config.PriceFeed.MaxFeeds,        // Match field names correctly
			MinValidSources:    config.PriceFeed.MinSources,      // Match field names correctly
			DefaultTimeout:     config.PriceFeed.DefaultTimeout,  // Match field names correctly 
			DefaultWeight:      1.0,                              // Use default or from config if available
			WorkerCount:        config.PriceFeed.Workers,         // Match field names correctly
			DeviationThreshold: config.PriceFeed.Threshold,       // Match field names correctly
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create core price feed service: %w", err)
	}

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

// CreatePriceFeed delegates to the wrapper to create a new price feed
func (s *Service) CreatePriceFeed(ctx context.Context, symbol string, contractAddress string, interval int, threshold float64, minSources int) (*models.PriceFeed, error) {
	return s.wrapper.CreatePriceFeed(ctx, symbol, contractAddress, interval, threshold, minSources)
}

// Other methods would delegate to the wrapper in the same way
// ...