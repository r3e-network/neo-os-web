// Package datafeed provides Chainlink price feed integration.
package datafeed

import (
	"math/big"
	"time"
)

// PriceData represents a price reading from Chainlink.
type PriceData struct {
	Symbol     string
	RoundID    *big.Int
	Price      *big.Int
	Timestamp  time.Time
	Decimals   int
	StartedAt  time.Time
	AnsweredIn uint64
	Category   FeedCategory
	Base       string
	Quote      string
}

// BatchPriceData represents a batch of price readings.
type BatchPriceData struct {
	Prices    []PriceData
	FetchedAt time.Time
	Network   string
}

// AggregatorV3Response represents the response from latestRoundData().
type AggregatorV3Response struct {
	RoundID         *big.Int
	Answer          *big.Int
	StartedAt       *big.Int
	UpdatedAt       *big.Int
	AnsweredInRound *big.Int
}
