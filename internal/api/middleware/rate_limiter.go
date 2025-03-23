package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/errors"
	"github.com/R3E-Network/service_layer/internal/metrics"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// TokenBucket represents a rate limiter for a specific user
type TokenBucket struct {
	limiter *rate.Limiter
	// lastSeen is the last time this token bucket was used
	// Used for cleaning up unused buckets
	lastSeen time.Time
}

// RateLimiter implements a rate limiting middleware
type RateLimiter struct {
	// Map of IP/API key/user ID to token bucket
	limiters map[string]*TokenBucket
	mutex    sync.RWMutex
	// Token bucket configuration
	rate      rate.Limit
	burst     int
	// How often to clean up unused token buckets
	cleanupInterval time.Duration
	// How long to keep unused token buckets
	bucketTTL time.Duration
}

// NewRateLimiter creates a new rate limiter middleware
func NewRateLimiter(r rate.Limit, burst int) *RateLimiter {
	limiter := &RateLimiter{
		limiters:        make(map[string]*TokenBucket),
		rate:            r,
		burst:           burst,
		cleanupInterval: 5 * time.Minute,
		bucketTTL:       24 * time.Hour,
	}

	// Start the cleanup goroutine
	go limiter.cleanup()

	return limiter
}

// cleanup removes unused token buckets
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mutex.Lock()
		for key, bucket := range rl.limiters {
			if time.Since(bucket.lastSeen) > rl.bucketTTL {
				delete(rl.limiters, key)
			}
		}
		rl.mutex.Unlock()
	}
}

// getLimiter gets or creates a token bucket for the given key
func (rl *RateLimiter) getLimiter(key string) *rate.Limiter {
	rl.mutex.RLock()
	bucket, exists := rl.limiters[key]
	rl.mutex.RUnlock()

	if !exists {
		rl.mutex.Lock()
		defer rl.mutex.Unlock()

		// Check again in case it was created while we were waiting for the lock
		bucket, exists = rl.limiters[key]
		if !exists {
			limiter := rate.NewLimiter(rl.rate, rl.burst)
			bucket = &TokenBucket{
				limiter:  limiter,
				lastSeen: time.Now(),
			}
			rl.limiters[key] = bucket
		}
	}

	// Update last seen time
	bucket.lastSeen = time.Now()
	return bucket.limiter
}

// Middleware returns a Gin middleware function for rate limiting
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting for the metrics endpoint
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		// Get a key for the rate limiter
		key := rl.getLimiterKey(c)
		limiter := rl.getLimiter(key)

		// Try to take a token from the bucket
		if !limiter.Allow() {
			// Record rate limit exceeded metric
			metrics.RateLimitExceededTotal.Inc()

			// Return rate limit exceeded error
			limitErr := errors.RateLimitExceededError(rl.burst, int(1/float64(rl.rate)))
			c.JSON(http.StatusTooManyRequests, limitErr.ToResponse())
			c.Abort()
			return
		}

		c.Next()
	}
}

// getLimiterKey gets a key for the rate limiter based on request information
func (rl *RateLimiter) getLimiterKey(c *gin.Context) string {
	// Try to use user ID if authenticated
	if userID, exists := c.Get("user_id"); exists {
		return fmt.Sprintf("user:%v", userID)
	}

	// Try to use API key if available
	if apiKey := c.GetHeader("X-API-Key"); apiKey != "" {
		// Use a hash of the API key to avoid storing it directly
		return fmt.Sprintf("apikey:%s", apiKey)
	}

	// Fall back to IP address
	return fmt.Sprintf("ip:%s", c.ClientIP())
}

// DynamicRateLimiter provides different rate limits based on the client
type DynamicRateLimiter struct {
	// Map of IP/API key/user ID to token bucket
	limiters map[string]*TokenBucket
	mutex    sync.RWMutex
	// Default limits for unauthenticated requests
	defaultRate  rate.Limit
	defaultBurst int
	// Higher limits for authenticated requests
	authRate  rate.Limit
	authBurst int
	// How often to clean up unused token buckets
	cleanupInterval time.Duration
	// How long to keep unused token buckets
	bucketTTL time.Duration
}

// NewDynamicRateLimiter creates a new dynamic rate limiter middleware
func NewDynamicRateLimiter(defaultRate, authRate rate.Limit, defaultBurst, authBurst int) *DynamicRateLimiter {
	limiter := &DynamicRateLimiter{
		limiters:        make(map[string]*TokenBucket),
		defaultRate:     defaultRate,
		defaultBurst:    defaultBurst,
		authRate:        authRate,
		authBurst:       authBurst,
		cleanupInterval: 5 * time.Minute,
		bucketTTL:       24 * time.Hour,
	}

	// Start the cleanup goroutine
	go limiter.cleanup()

	return limiter
}

// cleanup removes unused token buckets for the dynamic rate limiter
func (rl *DynamicRateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mutex.Lock()
		for key, bucket := range rl.limiters {
			if time.Since(bucket.lastSeen) > rl.bucketTTL {
				delete(rl.limiters, key)
			}
		}
		rl.mutex.Unlock()
	}
}

// getLimiter gets or creates a token bucket for the given key
func (rl *DynamicRateLimiter) getLimiter(key string, isAuthenticated bool) *rate.Limiter {
	rl.mutex.RLock()
	bucket, exists := rl.limiters[key]
	rl.mutex.RUnlock()

	if !exists {
		rl.mutex.Lock()
		defer rl.mutex.Unlock()

		// Check again in case it was created while we were waiting for the lock
		bucket, exists = rl.limiters[key]
		if !exists {
			// Use different limits based on whether the client is authenticated
			var limiter *rate.Limiter
			if isAuthenticated {
				limiter = rate.NewLimiter(rl.authRate, rl.authBurst)
			} else {
				limiter = rate.NewLimiter(rl.defaultRate, rl.defaultBurst)
			}

			bucket = &TokenBucket{
				limiter:  limiter,
				lastSeen: time.Now(),
			}
			rl.limiters[key] = bucket
		}
	}

	// Update last seen time
	bucket.lastSeen = time.Now()
	return bucket.limiter
}

// Middleware returns a Gin middleware function for dynamic rate limiting
func (rl *DynamicRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting for the metrics endpoint
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		// Check if the client is authenticated
		isAuthenticated := false
		if _, exists := c.Get("user_id"); exists {
			isAuthenticated = true
		}

		// Get a key for the rate limiter
		key := rl.getLimiterKey(c)
		limiter := rl.getLimiter(key, isAuthenticated)

		// Try to take a token from the bucket
		if !limiter.Allow() {
			// Record rate limit exceeded metric
			metrics.RateLimitExceededTotal.Inc()

			// Determine the actual rate and burst used for this client
			var rateInt, burst int
			if isAuthenticated {
				rateInt = int(1 / float64(rl.authRate))
				burst = rl.authBurst
			} else {
				rateInt = int(1 / float64(rl.defaultRate))
				burst = rl.defaultBurst
			}

			// Return rate limit exceeded error
			limitErr := errors.RateLimitExceededError(burst, rateInt)
			c.JSON(http.StatusTooManyRequests, limitErr.ToResponse())
			c.Abort()
			return
		}

		// Add rate limit headers
		rl.addRateLimitHeaders(c, limiter, isAuthenticated)

		c.Next()
	}
}

// getLimiterKey gets a key for the rate limiter based on request information
func (rl *DynamicRateLimiter) getLimiterKey(c *gin.Context) string {
	// Try to use user ID if authenticated
	if userID, exists := c.Get("user_id"); exists {
		return fmt.Sprintf("user:%v", userID)
	}

	// Try to use API key if available
	if apiKey := c.GetHeader("X-API-Key"); apiKey != "" {
		// Use a hash of the API key to avoid storing it directly
		return fmt.Sprintf("apikey:%s", apiKey)
	}

	// Fall back to IP address
	return fmt.Sprintf("ip:%s", c.ClientIP())
}

// addRateLimitHeaders adds rate limit headers to the response
func (rl *DynamicRateLimiter) addRateLimitHeaders(c *gin.Context, limiter *rate.Limiter, isAuthenticated bool) {
	// Get tokens remaining
	tokens := limiter.Tokens()
	
	// Add rate limit headers (in RFC 6585 format)
	c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limiter.Burst()))
	c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", int(tokens)))
	
	// Add reset time (in seconds)
	resetTime := time.Now().Add(time.Second * time.Duration(1/float64(limiter.Limit())))
	c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
}