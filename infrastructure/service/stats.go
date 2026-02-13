package service

import (
	"sync"
)

// StatsCollector simplifies building statistics maps for service /info endpoints.
// It provides a fluent API for constructing statistics with optional locking
// and conditional field inclusion.
type StatsCollector struct {
	mu     *sync.RWMutex
	stats  map[string]any
	locked bool
	collMu sync.Mutex // Protects the stats map during concurrent writes
}

// NewStatsCollector creates a new StatsCollector with an empty stats map.
func NewStatsCollector() *StatsCollector {
	return &StatsCollector{
		stats: make(map[string]any),
	}
}

// WithRLock acquires a read lock for the duration of stats collection.
// The lock is released when Build() is called.
func (sc *StatsCollector) WithRLock(mu *sync.RWMutex) *StatsCollector {
	sc.mu = mu
	if sc.mu != nil {
		sc.mu.RLock()
		sc.locked = true
	}
	return sc
}

// Add adds a key-value pair to the statistics map.
func (sc *StatsCollector) Add(key string, value any) *StatsCollector {
	sc.collMu.Lock()
	defer sc.collMu.Unlock()
	sc.stats[key] = value
	return sc
}

// AddIf adds a key-value pair only if the condition is true.
func (sc *StatsCollector) AddIf(condition bool, key string, value any) *StatsCollector {
	if condition {
		sc.collMu.Lock()
		defer sc.collMu.Unlock()
		sc.stats[key] = value
	}
	return sc
}

// AddNonNil adds a key-value pair only if the value is not nil.
func (sc *StatsCollector) AddNonNil(key string, value any) *StatsCollector {
	if value != nil {
		sc.collMu.Lock()
		defer sc.collMu.Unlock()
		sc.stats[key] = value
	}
	return sc
}

// AddMap merges another map into the statistics.
func (sc *StatsCollector) AddMap(m map[string]any) *StatsCollector {
	sc.collMu.Lock()
	defer sc.collMu.Unlock()
	for k, v := range m {
		sc.stats[k] = v
	}
	return sc
}

// Build returns the final statistics map and releases any locks.
func (sc *StatsCollector) Build() map[string]any {
	if sc.locked && sc.mu != nil {
		sc.mu.RUnlock()
		sc.locked = false
	}
	return sc.stats
}

// MustBuild is like Build but also checks if the collector is still locked.
// It panics if called multiple times on a locked collector.
func (sc *StatsCollector) MustBuild() map[string]any {
	if sc.locked && sc.mu != nil {
		defer func() {
			sc.mu.RUnlock()
			sc.locked = false
		}()
	}
	return sc.stats
}
