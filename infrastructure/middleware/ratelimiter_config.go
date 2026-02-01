package middleware

import (
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

// RateLimiterConfig provides configuration options for creating rate limiters
type RateLimiterConfig struct {
	// RequestsPerSecond is the sustained rate limit (default: 50)
	RequestsPerSecond int

	// Burst is the maximum burst size (default: 100)
	Burst int

	// Window is the time window for fixed-window rate limiting (default: 1 second)
	Window time.Duration

	// MaxLimiters is the maximum number of limiters to keep in memory (default: 10000)
	MaxLimiters int

	// LimiterTTL is how long to keep idle limiters (default: 24 hours)
	LimiterTTL time.Duration

	// CleanupInterval is how often to run cleanup (default: 5 minutes)
	CleanupInterval time.Duration

	// Logger for rate limit events (optional)
	Logger *logging.Logger
}

// DefaultRateLimiterConfig returns a rate limiter configuration with sensible defaults
// for most service HTTP clients:
// - RequestsPerSecond: 50
// - Burst: 100
// - Window: 1 second
// - MaxLimiters: 10000
func DefaultRateLimiterConfig(logger *logging.Logger) RateLimiterConfig {
	return RateLimiterConfig{
		RequestsPerSecond: 50,
		Burst:             100,
		Window:            time.Second,
		MaxLimiters:       10000,
		LimiterTTL:        24 * time.Hour,
		CleanupInterval:   5 * time.Minute,
		Logger:            logger,
	}
}

// StrictRateLimiterConfig returns a more restrictive rate limiter configuration
// for sensitive endpoints:
// - RequestsPerSecond: 10
// - Burst: 20
// - Window: 1 second
func StrictRateLimiterConfig(logger *logging.Logger) RateLimiterConfig {
	return RateLimiterConfig{
		RequestsPerSecond: 10,
		Burst:             20,
		Window:            time.Second,
		MaxLimiters:       10000,
		LimiterTTL:        24 * time.Hour,
		CleanupInterval:   5 * time.Minute,
		Logger:            logger,
	}
}

// LenientRateLimiterConfig returns a more permissive rate limiter configuration
// for internal services:
// - RequestsPerSecond: 100
// - Burst: 200
// - Window: 1 second
func LenientRateLimiterConfig(logger *logging.Logger) RateLimiterConfig {
	return RateLimiterConfig{
		RequestsPerSecond: 100,
		Burst:             200,
		Window:            time.Second,
		MaxLimiters:       10000,
		LimiterTTL:        24 * time.Hour,
		CleanupInterval:   5 * time.Minute,
		Logger:            logger,
	}
}

// NewRateLimiterFromConfig creates a rate limiter from configuration
func NewRateLimiterFromConfig(cfg RateLimiterConfig) *RateLimiter {
	// Apply defaults
	if cfg.RequestsPerSecond <= 0 {
		cfg.RequestsPerSecond = 50
	}
	if cfg.Burst <= 0 {
		cfg.Burst = cfg.RequestsPerSecond * 2
	}
	if cfg.Window <= 0 {
		cfg.Window = time.Second
	}

	var rl *RateLimiter

	// Use window-based or rate-based limiter depending on configuration
	if cfg.Window > 0 && cfg.Window != time.Second {
		// Fixed window rate limiting
		limit := int(float64(cfg.RequestsPerSecond) * cfg.Window.Seconds())
		if limit < 1 {
			limit = 1
		}
		rl = NewRateLimiterWithWindow(limit, cfg.Window, cfg.Burst, cfg.Logger)
	} else {
		// Token bucket rate limiting
		rl = NewRateLimiter(cfg.RequestsPerSecond, cfg.Burst, cfg.Logger)
	}

	// Set advanced options
	if cfg.MaxLimiters > 0 {
		rl.SetMaxSize(cfg.MaxLimiters)
	}
	if cfg.LimiterTTL > 0 {
		rl.SetLimiterTTL(cfg.LimiterTTL)
	}

	return rl
}

// StartCleanupFromConfig starts the background cleanup goroutine using config values
// and returns a stop function that should be called on service shutdown
func StartCleanupFromConfig(rl *RateLimiter, cfg RateLimiterConfig) func() {
	interval := cfg.CleanupInterval
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return rl.StartCleanup(interval)
}
