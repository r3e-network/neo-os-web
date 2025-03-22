package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/jmoiron/sqlx"
)

// PriceFeedRepository implements the models.PriceFeedRepository interface
type PriceFeedRepository struct {
	db *sqlx.DB
}

// NewPriceFeedRepository creates a new price feed repository
func NewPriceFeedRepository(db *sqlx.DB) *PriceFeedRepository {
	return &PriceFeedRepository{
		db: db,
	}
}

// CreatePriceFeed creates a new price feed in the database
func (r *PriceFeedRepository) CreatePriceFeed(feed *models.PriceFeed) (*models.PriceFeed, error) {
	query := `
		INSERT INTO price_feeds 
		(base_token, quote_token, pair, update_interval, deviation_threshold, heartbeat_interval, contract_address, active, created_at, updated_at) 
		VALUES 
		($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) 
		RETURNING id
	`

	now := time.Now().UTC()
	feed.CreatedAt = now
	feed.UpdatedAt = now

	var id int
	err := r.db.QueryRowx(query,
		feed.BaseToken,
		feed.QuoteToken,
		feed.Pair,
		feed.UpdateInterval,
		feed.DeviationThreshold,
		feed.HeartbeatInterval,
		feed.ContractAddress,
		feed.Active,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create price feed: %w", err)
	}

	feed.ID = id
	return feed, nil
}

// GetPriceFeedByID gets a price feed by ID
func (r *PriceFeedRepository) GetPriceFeedByID(id int) (*models.PriceFeed, error) {
	query := `SELECT * FROM price_feeds WHERE id = $1`

	var feed models.PriceFeed
	err := r.db.Get(&feed, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get price feed: %w", err)
	}

	return &feed, nil
}

// GetPriceFeedByPair gets a price feed by token pair
func (r *PriceFeedRepository) GetPriceFeedByPair(pair string) (*models.PriceFeed, error) {
	query := `SELECT * FROM price_feeds WHERE pair = $1`

	var feed models.PriceFeed
	err := r.db.Get(&feed, query, pair)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get price feed by pair: %w", err)
	}

	return &feed, nil
}

// ListPriceFeeds lists all price feeds
func (r *PriceFeedRepository) ListPriceFeeds() ([]*models.PriceFeed, error) {
	query := `SELECT * FROM price_feeds ORDER BY id`

	var feeds []*models.PriceFeed
	err := r.db.Select(&feeds, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list price feeds: %w", err)
	}

	return feeds, nil
}

// UpdatePriceFeed updates a price feed
func (r *PriceFeedRepository) UpdatePriceFeed(feed *models.PriceFeed) (*models.PriceFeed, error) {
	query := `
		UPDATE price_feeds 
		SET base_token = $1, quote_token = $2, pair = $3, update_interval = $4, 
		    deviation_threshold = $5, heartbeat_interval = $6, contract_address = $7, 
		    active = $8, updated_at = $9 
		WHERE id = $10
	`

	now := time.Now().UTC()
	feed.UpdatedAt = now

	_, err := r.db.Exec(query,
		feed.BaseToken,
		feed.QuoteToken,
		feed.Pair,
		feed.UpdateInterval,
		feed.DeviationThreshold,
		feed.HeartbeatInterval,
		feed.ContractAddress,
		feed.Active,
		now,
		feed.ID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update price feed: %w", err)
	}

	return feed, nil
}

// DeletePriceFeed deletes a price feed
func (r *PriceFeedRepository) DeletePriceFeed(id int) error {
	query := `DELETE FROM price_feeds WHERE id = $1`

	_, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete price feed: %w", err)
	}

	return nil
}

// CreatePriceData creates a new price data entry
func (r *PriceFeedRepository) CreatePriceData(data *models.PriceData) (*models.PriceData, error) {
	query := `
		INSERT INTO price_data 
		(price_feed_id, price, timestamp, round_id, tx_hash, source, created_at) 
		VALUES 
		($1, $2, $3, $4, $5, $6, $7) 
		RETURNING id
	`

	now := time.Now().UTC()
	data.CreatedAt = now

	var id int
	err := r.db.QueryRowx(query,
		data.PriceFeedID,
		data.Price,
		data.Timestamp,
		data.RoundID,
		data.TxHash,
		data.Source,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create price data: %w", err)
	}

	data.ID = id
	return data, nil
}

// GetLatestPriceData gets the latest price data for a price feed
func (r *PriceFeedRepository) GetLatestPriceData(priceFeedID int) (*models.PriceData, error) {
	query := `
		SELECT * FROM price_data 
		WHERE price_feed_id = $1 
		ORDER BY timestamp DESC, id DESC 
		LIMIT 1
	`

	var data models.PriceData
	err := r.db.Get(&data, query, priceFeedID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get latest price data: %w", err)
	}

	return &data, nil
}

// GetPriceDataHistory gets the price data history for a price feed
func (r *PriceFeedRepository) GetPriceDataHistory(priceFeedID int, limit int, offset int) ([]*models.PriceData, error) {
	query := `
		SELECT * FROM price_data 
		WHERE price_feed_id = $1 
		ORDER BY timestamp DESC, id DESC 
		LIMIT $2 OFFSET $3
	`

	var dataHistory []*models.PriceData
	err := r.db.Select(&dataHistory, query, priceFeedID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get price data history: %w", err)
	}

	return dataHistory, nil
}

// CreatePriceSource creates a new price source
func (r *PriceFeedRepository) CreatePriceSource(source *models.PriceSource) (*models.PriceSource, error) {
	query := `
		INSERT INTO price_sources 
		(name, url, weight, timeout, active, created_at, updated_at) 
		VALUES 
		($1, $2, $3, $4, $5, $6, $6) 
		RETURNING id
	`

	now := time.Now().UTC()
	source.CreatedAt = now
	source.UpdatedAt = now

	var id int
	err := r.db.QueryRowx(query,
		source.Name,
		source.URL,
		source.Weight,
		source.Timeout,
		source.Active,
		now,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create price source: %w", err)
	}

	source.ID = id
	return source, nil
}

// GetPriceSourceByID gets a price source by ID
func (r *PriceFeedRepository) GetPriceSourceByID(id int) (*models.PriceSource, error) {
	query := `SELECT * FROM price_sources WHERE id = $1`

	var source models.PriceSource
	err := r.db.Get(&source, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get price source: %w", err)
	}

	return &source, nil
}

// GetPriceSourceByName gets a price source by name
func (r *PriceFeedRepository) GetPriceSourceByName(name string) (*models.PriceSource, error) {
	query := `SELECT * FROM price_sources WHERE name = $1`

	var source models.PriceSource
	err := r.db.Get(&source, query, name)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get price source by name: %w", err)
	}

	return &source, nil
}

// ListPriceSources lists all price sources
func (r *PriceFeedRepository) ListPriceSources() ([]*models.PriceSource, error) {
	query := `SELECT * FROM price_sources ORDER BY id`

	var sources []*models.PriceSource
	err := r.db.Select(&sources, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list price sources: %w", err)
	}

	return sources, nil
}

// UpdatePriceSource updates a price source
func (r *PriceFeedRepository) UpdatePriceSource(source *models.PriceSource) (*models.PriceSource, error) {
	query := `
		UPDATE price_sources 
		SET name = $1, url = $2, weight = $3, timeout = $4, active = $5, updated_at = $6 
		WHERE id = $7
	`

	now := time.Now().UTC()
	source.UpdatedAt = now

	_, err := r.db.Exec(query,
		source.Name,
		source.URL,
		source.Weight,
		source.Timeout,
		source.Active,
		now,
		source.ID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update price source: %w", err)
	}

	return source, nil
}

// DeletePriceSource deletes a price source
func (r *PriceFeedRepository) DeletePriceSource(id int) error {
	query := `DELETE FROM price_sources WHERE id = $1`

	_, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete price source: %w", err)
	}

	return nil
}
