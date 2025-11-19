package pricefeed

import "time"

// Feed represents a configured price feed definition.
type Feed struct {
	ID               string
	AccountID        string
	BaseAsset        string
	QuoteAsset       string
	Pair             string
	UpdateInterval   string
	DeviationPercent float64
	Heartbeat        string
	Active           bool
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Snapshot captures a recorded price for a feed.
type Snapshot struct {
	ID          string
	FeedID      string
	Price       float64
	Source      string
	CollectedAt time.Time
	CreatedAt   time.Time
}

// Round captures an aggregated price round for a feed.
type Round struct {
	ID               string
	FeedID           string
	RoundID          int64
	AggregatedPrice  float64
	ObservationCount int
	StartedAt        time.Time
	ClosedAt         time.Time
	Finalized        bool
	CreatedAt        time.Time
}

// Observation stores a single submission used to construct a round.
type Observation struct {
	ID          string
	FeedID      string
	RoundID     int64
	Source      string
	Price       float64
	CollectedAt time.Time
	CreatedAt   time.Time
}
