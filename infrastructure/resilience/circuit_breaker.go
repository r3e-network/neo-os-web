// Package resilience provides fault tolerance patterns
package resilience

import (
	"context"
	"errors"
	"sync"
	"time"
)

// State represents circuit breaker state
type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
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

// Common errors
var (
	ErrCircuitOpen     = errors.New("circuit breaker is open")
	ErrTooManyRequests = errors.New("too many requests in half-open state")
)

// Config for circuit breaker
type Config struct {
	MaxFailures   int           // failures before opening
	Timeout       time.Duration // time in open state
	HalfOpenMax   int           // max requests in half-open
	OnStateChange func(from, to State)
}

// DefaultConfig returns sensible defaults
func DefaultConfig() Config {
	return Config{
		MaxFailures: 5,
		Timeout:     30 * time.Second,
		HalfOpenMax: 3,
	}
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	mu           sync.RWMutex
	config       Config
	state        State
	failures     int
	successes    int
	halfOpenReqs int
	lastFailure  time.Time
}

// New creates a new CircuitBreaker
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
	return &CircuitBreaker{config: cfg, state: StateClosed}
}

// State returns current state
func (cb *CircuitBreaker) State() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Execute runs fn with circuit breaker protection
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	if err := cb.beforeRequest(); err != nil {
		return err
	}

	err := fn()
	cb.afterRequest(err == nil)
	return err
}

func (cb *CircuitBreaker) beforeRequest() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateOpen:
		if time.Since(cb.lastFailure) > cb.config.Timeout {
			cb.setState(StateHalfOpen)
			cb.halfOpenReqs = 1
			return nil
		}
		return ErrCircuitOpen
	case StateHalfOpen:
		if cb.halfOpenReqs >= cb.config.HalfOpenMax {
			return ErrTooManyRequests
		}
		cb.halfOpenReqs++
	}
	return nil
}

func (cb *CircuitBreaker) afterRequest(success bool) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if success {
		cb.onSuccess()
	} else {
		cb.onFailure()
	}
}

func (cb *CircuitBreaker) onSuccess() {
	switch cb.state {
	case StateHalfOpen:
		cb.successes++
		if cb.successes >= cb.config.HalfOpenMax {
			cb.setState(StateClosed)
		}
	case StateClosed:
		cb.failures = 0
	}
}

func (cb *CircuitBreaker) onFailure() {
	cb.failures++
	cb.lastFailure = time.Now()

	switch cb.state {
	case StateHalfOpen:
		cb.setState(StateOpen)
	case StateClosed:
		if cb.failures >= cb.config.MaxFailures {
			cb.setState(StateOpen)
		}
	}
}

func (cb *CircuitBreaker) setState(newState State) {
	if cb.state == newState {
		return
	}
	old := cb.state
	cb.state = newState
	cb.failures = 0
	cb.successes = 0
	cb.halfOpenReqs = 0

	if cb.config.OnStateChange != nil {
		go cb.config.OnStateChange(old, newState)
	}
}
