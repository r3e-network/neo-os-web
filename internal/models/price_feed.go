package models

import (
	"time"
)

// PriceFeed represents a price feed configuration
type PriceFeed struct {
	ID                 int       `json:"id" db:"id"`
	BaseToken          string    `json:"base_token" db:"base_token"`
	QuoteToken         string    `json:"quote_token" db:"quote_token"`
	Pair               string    `json:"pair" db:"pair"`
	UpdateInterval     string    `json:"update_interval" db:"update_interval"`
	DeviationThreshold float64   `json:"deviation_threshold" db:"deviation_threshold"`
	HeartbeatInterval  string    `json:"heartbeat_interval" db:"heartbeat_interval"`
	ContractAddress    string    `json:"contract_address" db:"contract_address"`
	Active             bool      `json:"active" db:"active"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// PriceSource represents an external price data source
type PriceSource struct {
	ID        int       `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	URL       string    `json:"url" db:"url"`
	Weight    float64   `json:"weight" db:"weight"`
	Timeout   string    `json:"timeout" db:"timeout"`
	Active    bool      `json:"active" db:"active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// PriceData represents a single price point
type PriceData struct {
	ID         int       `json:"id" db:"id"`
	PriceFeedID int       `json:"price_feed_id" db:"price_feed_id"`
	Price      float64   `json:"price" db:"price"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
	RoundID    int64     `json:"round_id" db:"round_id"`
	TxHash     string    `json:"tx_hash" db:"tx_hash"`
	Source     string    `json:"source" db:"source"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// PriceUpdate represents a price update to be sent to the blockchain
type PriceUpdate struct {
	PriceFeedID int       `json:"price_feed_id"`
	Price       float64   `json:"price"`
	Timestamp   time.Time `json:"timestamp"`
	RoundID     int64     `json:"round_id"`
}

// PriceFeedRepository defines the interface for price feed data access
type PriceFeedRepository interface {
	// PriceFeed management
	CreatePriceFeed(feed *PriceFeed) (*PriceFeed, error)
	GetPriceFeedByID(id int) (*PriceFeed, error)
	GetPriceFeedByPair(pair string) (*PriceFeed, error)
	ListPriceFeeds() ([]*PriceFeed, error)
	UpdatePriceFeed(feed *PriceFeed) (*PriceFeed, error)
	DeletePriceFeed(id int) error
	
	// Price data management
	CreatePriceData(data *PriceData) (*PriceData, error)
	GetLatestPriceData(priceFeedID int) (*PriceData, error)
	GetPriceDataHistory(priceFeedID int, limit int, offset int) ([]*PriceData, error)
	
	// Price source management
	CreatePriceSource(source *PriceSource) (*PriceSource, error)
	GetPriceSourceByID(id int) (*PriceSource, error)
	GetPriceSourceByName(name string) (*PriceSource, error)
	ListPriceSources() ([]*PriceSource, error)
	UpdatePriceSource(source *PriceSource) (*PriceSource, error)
	DeletePriceSource(id int) error
} 