// Package middleware provides HTTP middleware for the service layer
package middleware

import (
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/errors"
	internalhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
)

// limiterEntry wraps a rate.Limiter with access tracking for LRU eviction.
type limiterEntry struct {
	limiter    *rate.Limiter
	lastAccess time.Time
}

// RateLimiter provides rate limiting functionality
type RateLimiter struct {
	limiters map[string]*limiterEntry
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
	limit    int
	window   time.Duration
	logger   *logging.Logger
	stopCh   chan struct{}
	stopOnce sync.Once
}

// LimiterCount returns the number of active limiters.
func (rl *RateLimiter) LimiterCount() int {
	if rl == nil {
		return 0
	}
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	return len(rl.limiters)
}

// NewRateLimiter creates a new rate limiter with automatic background cleanup.
func NewRateLimiter(requestsPerSecond, burst int, logger *logging.Logger) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*limiterEntry),
		rate:     rate.Limit(requestsPerSecond),
		burst:    burst,
		limit:    requestsPerSecond,
		window:   time.Second,
		logger:   logger,
		stopCh:   make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// NewRateLimiterWithWindow creates a rate limiter configured by a fixed window
// and request budget, e.g. 100 requests per 1 minute. Starts automatic background cleanup.
func NewRateLimiterWithWindow(limit int, window time.Duration, burst int, logger *logging.Logger) *RateLimiter {
	if window <= 0 {
		window = time.Second
	}
	requestsPerSecond := float64(limit) / window.Seconds()
	if requestsPerSecond < 0 {
		requestsPerSecond = 0
	}

	rl := &RateLimiter{
		limiters: make(map[string]*limiterEntry),
		rate:     rate.Limit(requestsPerSecond),
		burst:    burst,
		limit:    limit,
		window:   window,
		logger:   logger,
		stopCh:   make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// getLimiter returns a rate limiter for the given key (e.g., user ID or IP)
func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, exists := rl.limiters[key]
	if !exists {
		entry = &limiterEntry{
			limiter: rate.NewLimiter(rl.rate, rl.burst),
		}
		rl.limiters[key] = entry
	}
	entry.lastAccess = time.Now()

	return entry.limiter
}

// Handler returns the rate limiting middleware handler
func (rl *RateLimiter) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Use user ID if authenticated, otherwise use IP address
		key := GetUserID(r.Context())
		if key == "" {
			key = internalhttputil.ClientIP(r)
		}
		if key == "" {
			key = "unknown"
		}

		limiter := rl.getLimiter(key)

		if !limiter.Allow() {
			if rl.logger != nil {
				rl.logger.LogSecurityEvent(r.Context(), "rate_limit_exceeded", map[string]interface{}{
					"key":    key,
					"path":   r.URL.Path,
					"method": r.Method,
				})
			}

			window := rl.window
			if window <= 0 {
				window = time.Second
			}
			serviceErr := errors.RateLimitExceeded(rl.limit, window.String())
			if seconds := int(math.Ceil(window.Seconds())); seconds > 0 {
				w.Header().Set("Retry-After", strconv.Itoa(seconds))
			}
			internalhttputil.WriteErrorResponse(w, r, serviceErr.HTTPStatus, string(serviceErr.Code), serviceErr.Message, serviceErr.Details)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// cleanupLoop runs periodic cleanup until Stop is called.
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.Cleanup()
		case <-rl.stopCh:
			return
		}
	}
}

// Stop terminates the background cleanup goroutine. Safe to call multiple times.
func (rl *RateLimiter) Stop() {
	rl.stopOnce.Do(func() { close(rl.stopCh) })
}

// Cleanup removes stale limiters based on last access time, with a hard cap
// to bound memory usage under sustained attack.
func (rl *RateLimiter) Cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// maxAge: entries idle longer than 2*window are stale (minimum 1 minute)
	maxAge := 2 * rl.window
	if maxAge < time.Minute {
		maxAge = time.Minute
	}

	// Phase 1: evict entries that exceeded maxAge
	for key, entry := range rl.limiters {
		if now.Sub(entry.lastAccess) > maxAge {
			delete(rl.limiters, key)
		}
	}

	// Phase 2: hard cap – if still over 5000, drop oldest entries
	const hardCap = 5000
	if len(rl.limiters) > hardCap {
		type kv struct {
			key        string
			lastAccess time.Time
		}
		entries := make([]kv, 0, len(rl.limiters))
		for k, v := range rl.limiters {
			entries = append(entries, kv{k, v.lastAccess})
		}
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].lastAccess.Before(entries[j].lastAccess)
		})
		toRemove := len(entries) - hardCap
		for i := 0; i < toRemove; i++ {
			delete(rl.limiters, entries[i].key)
		}
	}
}

// StartCleanup starts a background goroutine to periodically cleanup old limiters
func (rl *RateLimiter) StartCleanup(interval time.Duration) (stop func()) {
	if interval <= 0 {
		interval = time.Minute
	}

	ticker := time.NewTicker(interval)
	done := make(chan struct{})
	var once sync.Once

	go func() {
		defer func() {
			if r := recover(); r != nil {
				if rl.logger != nil {
					rl.logger.WithFields(map[string]interface{}{
						"panic": r,
					}).Error("Rate limiter cleanup worker panicked")
					return
				}
				log.Printf("rate limiter cleanup worker recovered from panic: %v", r)
			}
		}()
		for {
			select {
			case <-ticker.C:
				rl.Cleanup()
			case <-done:
				return
			}
		}
	}()

	return func() {
		once.Do(func() {
			ticker.Stop()
			close(done)
		})
	}
}
