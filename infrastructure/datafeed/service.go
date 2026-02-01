package datafeed

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// Service provides price feed data from Chainlink.
type Service struct {
	client   *Client
	cache    *BatchPriceData
	cacheTTL time.Duration
	mu       sync.RWMutex
}

// ServiceConfig holds configuration for the datafeed service.
type ServiceConfig struct {
	RPCURL   string
	Network  string
	CacheTTL time.Duration
}

// NewService creates a new datafeed service.
func NewService(cfg ServiceConfig) (*Service, error) {
	if cfg.CacheTTL == 0 {
		cfg.CacheTTL = 30 * time.Second
	}

	client, err := NewClient(cfg.RPCURL, cfg.Network)
	if err != nil {
		return nil, err
	}

	return &Service{
		client:   client,
		cacheTTL: cfg.CacheTTL,
	}, nil
}

// Close closes the service.
func (s *Service) Close() {
	if s.client != nil {
		s.client.Close()
	}
}

// GetAllPrices returns all prices, using cache if valid.
func (s *Service) GetAllPrices(ctx context.Context) (*BatchPriceData, error) {
	s.mu.RLock()
	if s.cache != nil && time.Since(s.cache.FetchedAt) < s.cacheTTL {
		cached := s.cache
		s.mu.RUnlock()
		return cached, nil
	}
	s.mu.RUnlock()

	// Fetch fresh data
	data, err := s.client.FetchAllPrices(ctx)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.cache = data
	s.mu.Unlock()

	return data, nil
}

// BatchUpdateParams holds parameters for PriceFeed.BatchUpdate.
type BatchUpdateParams struct {
	Symbols              []string
	RoundIDs             []int64
	Prices               []int64
	Timestamps           []uint64
	AttestationHashes    [][]byte
	SourceSetIDs         []int64
	BatchAttestationHash []byte
}

// PrepareForBatchUpdate prepares price data for PriceFeed.BatchUpdate.
func (s *Service) PrepareForBatchUpdate(ctx context.Context) (*BatchUpdateParams, error) {
	data, err := s.GetAllPrices(ctx)
	if err != nil {
		return nil, err
	}

	n := len(data.Prices)
	params := &BatchUpdateParams{
		Symbols:           make([]string, n),
		RoundIDs:          make([]int64, n),
		Prices:            make([]int64, n),
		Timestamps:        make([]uint64, n),
		AttestationHashes: make([][]byte, n),
		SourceSetIDs:      make([]int64, n),
	}

	// Build batch attestation hash from all prices
	hashData := ""
	for i, p := range data.Prices {
		params.Symbols[i] = p.Symbol
		params.RoundIDs[i] = p.RoundID.Int64()
		params.Prices[i] = p.Price.Int64()
		ts := p.Timestamp.Unix()
		if ts < 0 {
			ts = 0
		}
		params.Timestamps[i] = uint64(ts) // #nosec G115 -- ts is clamped to non-negative
		params.SourceSetIDs[i] = 1        // Chainlink source

		// Individual attestation hash
		h := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%d",
			p.Symbol, p.RoundID.Int64(), p.Price.Int64())))
		params.AttestationHashes[i] = h[:]

		hashData += fmt.Sprintf("%s:%d:%d;", p.Symbol, p.RoundID.Int64(), p.Price.Int64())
	}

	// Batch attestation hash
	batchHash := sha256.Sum256([]byte(hashData))
	params.BatchAttestationHash = batchHash[:]

	return params, nil
}

// GetFeedCount returns the number of configured feeds.
func (s *Service) GetFeedCount() int {
	return len(s.client.GetFeeds())
}

// FormatPrice formats a price with proper decimals.
func FormatPrice(price int64, decimals int) string {
	if decimals <= 0 {
		return fmt.Sprintf("%d", price)
	}

	divisor := int64(1)
	for i := 0; i < decimals; i++ {
		divisor *= 10
	}

	whole := price / divisor
	frac := price % divisor

	format := fmt.Sprintf("%%d.%%0%dd", decimals)
	return fmt.Sprintf(format, whole, frac)
}

// GetAttestationHashHex returns the batch attestation hash as hex string.
func (p *BatchUpdateParams) GetAttestationHashHex() string {
	return hex.EncodeToString(p.BatchAttestationHash)
}
