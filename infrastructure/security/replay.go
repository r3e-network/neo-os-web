package security

import (
	"sync"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

// ReplayProtection provides thread-safe replay attack protection by tracking
// seen request IDs within a time window. It automatically cleans up expired
// entries to prevent memory leaks.
type ReplayProtection struct {
	window       time.Duration
	maxSize      int
	mu           sync.RWMutex
	seenRequests map[string]time.Time
	logger       *logging.Logger
}

// NewReplayProtection creates a new replay protection instance.
// window: How long to remember request IDs (e.g., 5 * time.Minute)
func NewReplayProtection(window time.Duration, logger *logging.Logger) *ReplayProtection {
	return NewReplayProtectionWithMaxSize(window, 0, logger)
}

// NewReplayProtectionWithMaxSize creates a new replay protection instance with a maximum size limit.
// window: How long to remember request IDs (e.g., 5 * time.Minute)
// maxSize: Maximum number of request IDs to track (0 = unlimited)
func NewReplayProtectionWithMaxSize(window time.Duration, maxSize int, logger *logging.Logger) *ReplayProtection {
	if window <= 0 {
		window = 5 * time.Minute
	}

	return &ReplayProtection{
		window:       window,
		maxSize:      maxSize,
		seenRequests: make(map[string]time.Time),
		logger:       logger,
	}
}

// ValidateAndMark checks if a request ID has been seen before and marks it as seen.
// Returns true if the request is valid (not a replay), false if it's a replay.
func (rp *ReplayProtection) ValidateAndMark(requestID string) bool {
	if requestID == "" {
		return false // Empty IDs are rejected for security
	}

	rp.mu.Lock()
	defer rp.mu.Unlock()

	// Clean up expired entries periodically (every 100 requests)
	if len(rp.seenRequests)%100 == 0 {
		rp.cleanupExpired()
	}

	// Check if already seen
	if seenTime, exists := rp.seenRequests[requestID]; exists {
		// Check if within replay window
		if time.Since(seenTime) < rp.window {
			if rp.logger != nil {
				rp.logger.WithField("request_id", requestID).
					WithField("window", rp.window).
					Warn("replay attack detected")
			}
			return false
		}
		// Expired, remove old entry
		delete(rp.seenRequests, requestID)
	}

	// Check max size limit
	if rp.maxSize > 0 && len(rp.seenRequests) >= rp.maxSize {
		// Emergency cleanup of expired entries
		rp.cleanupExpired()
		// If still at capacity, reject new requests
		if len(rp.seenRequests) >= rp.maxSize {
			if rp.logger != nil {
				rp.logger.WithField("max_size", rp.maxSize).
					Warn("replay protection at capacity, rejecting request")
			}
			return false
		}
	}

	// Mark as seen
	rp.seenRequests[requestID] = time.Now()
	return true
}

// IsReplay checks if a request ID is a replay without marking it.
// Returns true if the request is a replay, false if it's valid.
func (rp *ReplayProtection) IsReplay(requestID string) bool {
	if requestID == "" {
		return false
	}

	rp.mu.RLock()
	defer rp.mu.RUnlock()

	seenTime, exists := rp.seenRequests[requestID]
	if !exists {
		return false
	}

	return time.Since(seenTime) < rp.window
}

// cleanupExpired removes expired entries from the seen requests map.
func (rp *ReplayProtection) cleanupExpired() {
	now := time.Now()
	for id, seenTime := range rp.seenRequests {
		if now.Sub(seenTime) > rp.window {
			delete(rp.seenRequests, id)
		}
	}
}

// Size returns the current number of tracked request IDs.
func (rp *ReplayProtection) Size() int {
	rp.mu.RLock()
	defer rp.mu.RUnlock()
	return len(rp.seenRequests)
}

// Clear removes all tracked request IDs.
func (rp *ReplayProtection) Clear() {
	rp.mu.Lock()
	defer rp.mu.Unlock()
	rp.seenRequests = make(map[string]time.Time)
}
