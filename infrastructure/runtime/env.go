// Package runtime provides environment/runtime detection helpers shared across the service layer.
package runtime

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Environment represents the logical deployment environment.
//
// This is intentionally lightweight: it is derived from environment variables
// (primarily MARBLE_ENV) and is safe to use from low-level packages.
type Environment string

const (
	Development Environment = "development"
	Testing     Environment = "testing"
	Production  Environment = "production"
)

// ParseEnvironment parses an environment string (case-insensitive) into a known
// Environment value. It returns ok=false for unknown inputs.
func ParseEnvironment(raw string) (env Environment, ok bool) {
	raw = strings.ToLower(strings.TrimSpace(raw))

	switch Environment(raw) {
	case Development, Testing, Production:
		return Environment(raw), true
	default:
		return Development, false
	}
}

// Env returns the current environment derived from MARBLE_ENV (preferred) or
// ENVIRONMENT (legacy fallback). Unknown values default to Development.
func Env() Environment {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("MARBLE_ENV")))
	if raw == "" {
		raw = strings.ToLower(strings.TrimSpace(os.Getenv("ENVIRONMENT")))
	}

	if env, ok := ParseEnvironment(raw); ok {
		return env
	}
	return Development
}

func IsDevelopment() bool { return Env() == Development }
func IsTesting() bool     { return Env() == Testing }
func IsProduction() bool  { return Env() == Production }

func IsDevelopmentOrTesting() bool {
	env := Env()
	return env == Development || env == Testing
}

// ParseEnvInt parses an integer from the environment variable with the given key.
// Returns the parsed value and true if successful, or 0 and false if not set or invalid.
func ParseEnvInt(key string) (int, bool) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0, false
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, false
	}
	return value, true
}

// ParseEnvDuration parses a duration from the environment variable with the given key.
// Returns the parsed duration and true if successful, or 0 and false if not set or invalid.
func ParseEnvDuration(key string) (time.Duration, bool) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0, false
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return 0, false
	}
	return parsed, true
}
