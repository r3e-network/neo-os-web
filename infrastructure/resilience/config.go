package resilience

import (
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

// ServiceCircuitBreakerConfig provides preconfigured circuit breaker settings
// optimized for service-to-service HTTP calls.
type ServiceCircuitBreakerConfig struct {
	// MaxFailures is the number of consecutive failures before opening the circuit
	MaxFailures int

	// Timeout is the duration to wait in open state before trying half-open
	TimeoutSeconds int

	// HalfOpenMax is the maximum number of requests allowed in half-open state
	HalfOpenMax int

	// Logger for state change notifications (optional)
	Logger *logging.Logger
}

// DefaultServiceCBConfig returns a circuit breaker configuration suitable for
// most service HTTP clients with sensible defaults:
// - MaxFailures: 5
// - Timeout: 30 seconds
// - HalfOpenMax: 3
func DefaultServiceCBConfig(logger *logging.Logger) Config {
	return ServiceCBConfig(ServiceCircuitBreakerConfig{
		MaxFailures:    5,
		TimeoutSeconds: 30,
		HalfOpenMax:    3,
		Logger:         logger,
	})
}

// StrictServiceCBConfig returns a more conservative circuit breaker configuration
// for critical services that should fail fast:
// - MaxFailures: 3
// - Timeout: 60 seconds
// - HalfOpenMax: 1
func StrictServiceCBConfig(logger *logging.Logger) Config {
	return ServiceCBConfig(ServiceCircuitBreakerConfig{
		MaxFailures:    3,
		TimeoutSeconds: 60,
		HalfOpenMax:    1,
		Logger:         logger,
	})
}

// LenientServiceCBConfig returns a more lenient circuit breaker configuration
// for services that can tolerate more failures:
// - MaxFailures: 10
// - Timeout: 15 seconds
// - HalfOpenMax: 5
func LenientServiceCBConfig(logger *logging.Logger) Config {
	return ServiceCBConfig(ServiceCircuitBreakerConfig{
		MaxFailures:    10,
		TimeoutSeconds: 15,
		HalfOpenMax:    5,
		Logger:         logger,
	})
}

// ServiceCBConfig creates a Config from ServiceCircuitBreakerConfig
func ServiceCBConfig(cfg ServiceCircuitBreakerConfig) Config {
	cbConfig := Config{
		MaxFailures: cfg.MaxFailures,
		Timeout:     SecondsToDuration(cfg.TimeoutSeconds),
		HalfOpenMax: cfg.HalfOpenMax,
	}

	// Set defaults if not specified
	if cbConfig.MaxFailures <= 0 {
		cbConfig.MaxFailures = 5
	}
	if cbConfig.Timeout <= 0 {
		cbConfig.Timeout = 30 * time.Second
	}
	if cbConfig.HalfOpenMax <= 0 {
		cbConfig.HalfOpenMax = 3
	}

	// Add state change logging if logger provided
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

// SecondsToDuration converts seconds to Duration
func SecondsToDuration(seconds int) time.Duration {
	return time.Duration(seconds) * time.Second
}
