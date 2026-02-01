package resilience

import (
	"context"
	"math/rand"
	"time"
)

// RetryConfig configures retry behavior
type RetryConfig struct {
	MaxAttempts  int
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Multiplier   float64
	Jitter       float64 // 0-1, adds randomness
}

// DefaultRetryConfig returns sensible defaults
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     10 * time.Second,
		Multiplier:   2.0,
		Jitter:       0.1,
	}
}

// Retry executes fn with exponential backoff
func Retry(ctx context.Context, cfg RetryConfig, fn func() error) error {
	var lastErr error
	delay := cfg.InitialDelay

	for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
		}

		if attempt < cfg.MaxAttempts-1 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(addJitter(delay, cfg.Jitter)):
			}
			delay = nextDelay(delay, cfg)
		}
	}
	return lastErr
}

func nextDelay(current time.Duration, cfg RetryConfig) time.Duration {
	next := time.Duration(float64(current) * cfg.Multiplier)
	if next > cfg.MaxDelay {
		return cfg.MaxDelay
	}
	return next
}

func addJitter(d time.Duration, jitter float64) time.Duration {
	if jitter <= 0 {
		return d
	}
	delta := float64(d) * jitter
	return d + time.Duration(rand.Float64()*delta*2-delta)
}
