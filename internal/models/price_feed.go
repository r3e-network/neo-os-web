package models

import (
	"context"
	"errors"
	"time"
)

// Common errors for price feed operations
var (
	ErrPriceFeedNotFound        = errors.New("price feed not found")
	ErrInvalidPriceFeedSymbol   = errors.New("invalid price feed symbol")
	ErrInvalidContractAddress   = errors.New("invalid contract address")
	ErrPriceFeedUpdateInterval  = errors.New("invalid price feed update interval")
	ErrInsufficientValidSources = errors.New("insufficient valid price sources")
	ErrMaxPriceFeedsReached     = errors.New("maximum number of price feeds reached")
)

// PriceSource represents a data source for price information
type PriceSource struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	URL       string    `json:"url" db:"url"`
	Path      string    `json:"path" db:"path"`
	Weight    float64   `json:"weight" db:"weight"`
	Timeout   int       `json:"timeout" db:"timeout"`
	Active    bool      `json:"active" db:"active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// PriceData represents a price data point from a source
type PriceData struct {
	SourceID   string    `json:"source_id" db:"source_id"`
	SourceName string    `json:"source_name" db:"source_name"`
	Price      float64   `json:"price" db:"price"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
	Success    bool      `json:"success" db:"success"`
	Error      string    `json:"error" db:"error"`
}

// PriceFeed represents a price feed configuration
type PriceFeed struct {
	ID                 string        `json:"id" db:"id"`
	Symbol             string        `json:"symbol" db:"symbol"`
	ContractAddress    string        `json:"contract_address" db:"contract_address"`
	DeviationThreshold float64       `json:"deviation_threshold" db:"deviation_threshold"`
	UpdateInterval     int           `json:"update_interval" db:"update_interval"`
	MinValidSources    int           `json:"min_valid_sources" db:"min_valid_sources"`
	Timeout            int           `json:"timeout" db:"timeout"`
	Sources            []PriceSource `json:"sources" db:"sources"`
	Active             bool          `json:"active" db:"active"`
	LastUpdated        time.Time     `json:"last_updated" db:"last_updated"`
	LastPrice          float64       `json:"last_price" db:"last_price"`
	LastTxHash         string        `json:"last_tx_hash" db:"last_tx_hash"`
	CreatedAt          time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at" db:"updated_at"`
}

// PriceUpdate represents a record of a price feed update
type PriceUpdate struct {
	ID            string    `json:"id" db:"id"`
	PriceFeedID   string    `json:"price_feed_id" db:"price_feed_id"`
	Symbol        string    `json:"symbol" db:"symbol"`
	Price         float64   `json:"price" db:"price"`
	TransactionID string    `json:"transaction_id" db:"transaction_id"`
	Success       bool      `json:"success" db:"success"`
	Error         string    `json:"error" db:"error"`
	BlockHeight   uint32    `json:"block_height" db:"block_height"`
	Timestamp     time.Time `json:"timestamp" db:"timestamp"`
}

// PriceFeedRepository defines the interface for price feed data storage
type PriceFeedRepository interface {
	// Price feed operations
	CreatePriceFeed(ctx interface{}, priceFeed *PriceFeed) (*PriceFeed, error)
	GetPriceFeed(ctx interface{}, id string) (*PriceFeed, error)
	UpdatePriceFeed(ctx interface{}, priceFeed *PriceFeed) (*PriceFeed, error)
	DeletePriceFeed(ctx interface{}, id string) error
	ListPriceFeeds(ctx interface{}) ([]*PriceFeed, error)
	GetPriceFeedBySymbol(ctx interface{}, symbol string) (*PriceFeed, error)

	// Price source operations
	AddPriceSource(ctx interface{}, priceFeedID string, source *PriceSource) (*PriceSource, error)
	RemovePriceSource(ctx interface{}, priceFeedID string, sourceID string) error

	// Price update operations
	UpdateLastPrice(ctx interface{}, id string, price float64, txHash string) error
	RecordPriceUpdate(ctx interface{}, id string, price float64, txID string) error
	GetPriceHistory(ctx interface{}, id string, limit int) ([]*PriceUpdate, error)
}

// PriceFeedService defines the interface for the price feed service
type PriceFeedService interface {
	// Price feed management
	CreatePriceFeed(ctx context.Context, symbol string, contractAddress string, interval int, threshold float64, minSources int) (*PriceFeed, error)
	UpdatePriceFeed(ctx context.Context, id string, active bool, interval int, threshold float64, minSources int) (*PriceFeed, error)
	DeletePriceFeed(ctx context.Context, id string) error
	GetPriceFeed(ctx context.Context, id string) (*PriceFeed, error)
	GetPriceFeedBySymbol(ctx context.Context, symbol string) (*PriceFeed, error)
	ListPriceFeeds(ctx context.Context) ([]*PriceFeed, error)

	// Price source management
	AddPriceSource(ctx context.Context, priceFeedID string, name string, url string, path string, weight float64, timeout int) (*PriceSource, error)
	UpdatePriceSource(ctx context.Context, priceFeedID string, sourceID string, active bool, weight float64, timeout int) (*PriceSource, error)
	RemovePriceSource(ctx context.Context, priceFeedID string, sourceID string) error

	// Price operations
	TriggerPriceUpdate(ctx context.Context, priceFeedID string) error
	FetchLatestPrice(ctx context.Context, symbol string) (float64, error)
	GetPriceHistory(ctx context.Context, priceFeedID string, limit int) ([]*PriceUpdate, error)

	// Service lifecycle
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}
