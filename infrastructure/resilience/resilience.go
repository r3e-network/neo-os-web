// Package resilience provides fault tolerance patterns backed by
// github.com/sony/gobreaker/v2 (circuit breaking) and
// github.com/cenkalti/backoff/v4 (retry with exponential backoff).
//
// This package is a thin adapter that preserves the original API surface
// used throughout the codebase while delegating to battle-tested OSS.
package resilience

import (
	"context"
	"errors"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/sony/gobreaker/v2"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// State represents circuit breaker state.
type State int

const (
	StateClosed   State = State(gobreaker.StateClosed)
	StateHalfOpen State = State(gobreaker.StateHalfOpen)
	StateOpen     State = State(gobreaker.StateOpen)
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrCircuitOpen     = errors.New("circuit breaker is open")
	ErrTooManyRequests = errors.New("too many requests in half-open state")
)

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

// Config for circuit breaker.
type Config struct {
	MaxFailures   int           // consecutive failures before opening
	Timeout       time.Duration // time in open state before half-open
	HalfOpenMax   int           // max requests allowed in half-open
	OnStateChange func(from, to State)
}

// DefaultConfig returns sensible defaults.
func DefaultConfig() Config {
	return Config{
		MaxFailures: 5,
		Timeout:     30 * time.Second,
		HalfOpenMax: 3,
	}
}

// CircuitBreaker wraps gobreaker.CircuitBreaker while preserving the
// original Execute(ctx, fn) signature used by all consumers.
type CircuitBreaker struct {
	gb *gobreaker.CircuitBreaker[any]
}

// New creates a new CircuitBreaker backed by sony/gobreaker.
func New(cfg Config) *CircuitBreaker {
	if cfg.MaxFailures <= 0 {
		cfg.MaxFailures = 5
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.HalfOpenMax <= 0 {
		cfg.HalfOpenMax = 3
	}

	maxFailures := uint32(cfg.MaxFailures)
	halfOpenMax := uint32(cfg.HalfOpenMax)

	settings := gobreaker.Settings{
		MaxRequests: halfOpenMax,
		Interval:    0, // gobreaker resets counts on state change, not on interval
		Timeout:     cfg.Timeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= maxFailures
		},
	}

	if cfg.OnStateChange != nil {
		settings.OnStateChange = func(name string, from, to gobreaker.State) {
			cfg.OnStateChange(State(from), State(to))
		}
	}

	return &CircuitBreaker{
		gb: gobreaker.NewCircuitBreaker[any](settings),
	}
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() State {
	return State(cb.gb.State())
}

// Execute runs fn with circuit breaker protection.
// The ctx parameter is accepted for API compatibility but gobreaker does not
// use it internally — callers should enforce timeouts via context on fn itself.
func (cb *CircuitBreaker) Execute(_ context.Context, fn func() error) error {
	_, err := cb.gb.Execute(func() (any, error) {
		return nil, fn()
	})
	if err != nil {
		return mapGobreakerError(err)
	}
	return nil
}

// mapGobreakerError translates gobreaker sentinel errors to our own so that
// existing consumer code comparing against ErrCircuitOpen / ErrTooManyRequests
// continues to work.
func mapGobreakerError(err error) error {
	if errors.Is(err, gobreaker.ErrOpenState) {
		return ErrCircuitOpen
	}
	if errors.Is(err, gobreaker.ErrTooManyRequests) {
		return ErrTooManyRequests
	}
	return err
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

// RetryConfig configures retry behavior.
type RetryConfig struct {
	MaxAttempts  int
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Multiplier   float64
	Jitter       float64 // 0-1, adds randomness (mapped to backoff.RandomizationFactor)
}

// DefaultRetryConfig returns sensible defaults.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     10 * time.Second,
		Multiplier:   2.0,
		Jitter:       0.1,
	}
}

// Retry executes fn with exponential backoff using cenkalti/backoff.
func Retry(ctx context.Context, cfg RetryConfig, fn func() error) error {
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 1
	}

	bo := backoff.NewExponentialBackOff()
	if cfg.InitialDelay > 0 {
		bo.InitialInterval = cfg.InitialDelay
	}
	if cfg.MaxDelay > 0 {
		bo.MaxInterval = cfg.MaxDelay
	}
	if cfg.Multiplier > 0 {
		bo.Multiplier = cfg.Multiplier
	}
	if cfg.Jitter > 0 {
		bo.RandomizationFactor = cfg.Jitter
	} else {
		bo.RandomizationFactor = 0
	}
	// Disable the global elapsed-time limit; we control via MaxRetries.
	bo.MaxElapsedTime = 0

	// MaxRetries = MaxAttempts - 1 because the first call is not a "retry".
	maxRetries := uint64(cfg.MaxAttempts - 1)

	withMax := backoff.WithMaxRetries(bo, maxRetries)
	withCtx := backoff.WithContext(withMax, ctx)

	return backoff.Retry(func() error {
		return fn()
	}, withCtx)
}

// ---------------------------------------------------------------------------
// Service-level convenience configs (preserved from config.go)
// ---------------------------------------------------------------------------

// ServiceCircuitBreakerConfig provides preconfigured circuit breaker settings
// optimized for service-to-service HTTP calls.
type ServiceCircuitBreakerConfig struct {
	MaxFailures    int
	TimeoutSeconds int
	HalfOpenMax    int
	Logger         *logging.Logger
}

// DefaultServiceCBConfig returns a circuit breaker configuration suitable for
// most service HTTP clients.
func DefaultServiceCBConfig(logger *logging.Logger) Config {
	return ServiceCBConfig(ServiceCircuitBreakerConfig{
		MaxFailures:    5,
		TimeoutSeconds: 30,
		HalfOpenMax:    3,
		Logger:         logger,
	})
}

// StrictServiceCBConfig returns a conservative circuit breaker configuration
// for critical services that should fail fast.
func StrictServiceCBConfig(logger *logging.Logger) Config {
	return ServiceCBConfig(ServiceCircuitBreakerConfig{
		MaxFailures:    3,
		TimeoutSeconds: 60,
		HalfOpenMax:    1,
		Logger:         logger,
	})
}

// LenientServiceCBConfig returns a lenient circuit breaker configuration
// for services that can tolerate more failures.
func LenientServiceCBConfig(logger *logging.Logger) Config {
	return ServiceCBConfig(ServiceCircuitBreakerConfig{
		MaxFailures:    10,
		TimeoutSeconds: 15,
		HalfOpenMax:    5,
		Logger:         logger,
	})
}

// ServiceCBConfig creates a Config from ServiceCircuitBreakerConfig.
func ServiceCBConfig(cfg ServiceCircuitBreakerConfig) Config {
	cbConfig := Config{
		MaxFailures: cfg.MaxFailures,
		Timeout:     SecondsToDuration(cfg.TimeoutSeconds),
		HalfOpenMax: cfg.HalfOpenMax,
	}

	if cbConfig.MaxFailures <= 0 {
		cbConfig.MaxFailures = 5
	}
	if cbConfig.Timeout <= 0 {
		cbConfig.Timeout = 30 * time.Second
	}
	if cbConfig.HalfOpenMax <= 0 {
		cbConfig.HalfOpenMax = 3
	}

	if cfg.Logger != nil {
		cbConfig.OnStateChange = func(from, to State) {
			cfg.Logger.WithFields(map[string]interface{}{
				"from_state": from.String(),
				"to_state":   to.String(),
			}).Warn("circuit breaker state changed")
		}
	}

	return cbConfig
}

// SecondsToDuration converts seconds to Duration.
func SecondsToDuration(seconds int) time.Duration {
	return time.Duration(seconds) * time.Second
}
