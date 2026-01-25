// Package middleware provides HTTP middleware for the service layer
package middleware

import (
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/R3E-Network/service_layer/infrastructure/errors"
	internalhttputil "github.com/R3E-Network/service_layer/infrastructure/httputil"
	"github.com/R3E-Network/service_layer/infrastructure/logging"
)

const (
	defaultMaxLimiters     = 10000
	defaultLimiterTTL      = 24 * time.Hour
	defaultCleanupInterval = 5 * time.Minute
)

// RateLimiter provides rate limiting functionality
type RateLimiter struct {
	limiters   map[string]*rate.Limiter
	lastSeen   map[string]time.Time
	mu         sync.RWMutex
	rate       rate.Limit
	burst      int
	limit      int
	window     time.Duration
	logger     *logging.Logger
	maxSize    int
	limiterTTL time.Duration
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

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(requestsPerSecond, burst int, logger *logging.Logger) *RateLimiter {
	return newRateLimiter(requestsPerSecond, burst, time.Second, logger)
}

// NewRateLimiterWithWindow creates a rate limiter configured by a fixed window
// and request budget, e.g. 100 requests per 1 minute.
func NewRateLimiterWithWindow(limit int, window time.Duration, burst int, logger *logging.Logger) *RateLimiter {
	return newRateLimiter(limit, burst, window, logger)
}

func newRateLimiter(limit int, burst int, window time.Duration, logger *logging.Logger) *RateLimiter {
	if window <= 0 {
		window = time.Second
	}
	requestsPerSecond := float64(limit) / window.Seconds()
	if requestsPerSecond < 0 {
		requestsPerSecond = 0
	}

	return &RateLimiter{
		limiters:   make(map[string]*rate.Limiter),
		lastSeen:   make(map[string]time.Time),
		rate:       rate.Limit(requestsPerSecond),
		burst:      burst,
		limit:      limit,
		window:     window,
		logger:     logger,
		maxSize:    defaultMaxLimiters,
		limiterTTL: defaultLimiterTTL,
	}
}

// getLimiter returns a rate limiter for the given key (e.g., user ID or IP)
func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[key]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[key] = limiter
		rl.lastSeen[key] = time.Now()
	} else {
		rl.lastSeen[key] = time.Now()
	}

	return limiter
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

// Cleanup removes old limiters based on last seen time and max size.
// This should be called periodically via StartCleanup.
func (rl *RateLimiter) Cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	ttl := rl.limiterTTL
	if ttl <= 0 {
		ttl = defaultLimiterTTL
	}

	// Remove expired limiters
	for key, lastSeen := range rl.lastSeen {
		if now.Sub(lastSeen) > ttl {
			delete(rl.limiters, key)
			delete(rl.lastSeen, key)
		}
	}

	// If still over max size, remove oldest entries
	maxSize := rl.maxSize
	if maxSize <= 0 {
		maxSize = defaultMaxLimiters
	}

	if len(rl.limiters) > maxSize {
		// Find and remove oldest entries
		type entry struct {
			key      string
			lastSeen time.Time
		}
		entries := make([]entry, 0, len(rl.limiters)-maxSize)
		for key, lastSeen := range rl.lastSeen {
			entries = append(entries, entry{key: key, lastSeen: lastSeen})
		}

		// Sort by lastSeen ascending (oldest first)
		for i := 0; i < len(entries)-1; i++ {
			for j := i + 1; j < len(entries); j++ {
				if entries[j].lastSeen.Before(entries[i].lastSeen) {
					entries[i], entries[j] = entries[j], entries[i]
				}
			}
		}

		// Remove oldest entries
		toRemove := len(rl.limiters) - maxSize
		for i := 0; i < toRemove && i < len(entries); i++ {
			delete(rl.limiters, entries[i].key)
			delete(rl.lastSeen, entries[i].key)
		}

		if rl.logger != nil {
			rl.logger.WithFields(map[string]interface{}{
				"removed_count": toRemove,
				"current_size":  len(rl.limiters),
			}).Debug("Rate limiter cache trimmed due to size limit")
		}
	}
}

// SetMaxSize sets the maximum number of limiters to keep.
func (rl *RateLimiter) SetMaxSize(maxSize int) {
	if maxSize > 0 {
		rl.mu.Lock()
		rl.maxSize = maxSize
		rl.mu.Unlock()
	}
}

// SetLimiterTTL sets the time-to-live for limiters.
func (rl *RateLimiter) SetLimiterTTL(ttl time.Duration) {
	if ttl > 0 {
		rl.mu.Lock()
		rl.limiterTTL = ttl
		rl.mu.Unlock()
	}
}

// StartCleanup starts a background goroutine to periodically cleanup old limiters
func (rl *RateLimiter) StartCleanup(interval time.Duration) (stop func()) {
	if interval <= 0 {
		interval = defaultCleanupInterval
	}

	ticker := time.NewTicker(interval)
	done := make(chan struct{})
	var once sync.Once

	go func() {
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

// Size returns the current number of active limiters.
func (rl *RateLimiter) Size() int {
	if rl == nil {
		return 0
	}
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	return len(rl.limiters)
}
