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

// ParseEnvInt returns the integer value of the named environment variable.
// Returns (0, false) when the variable is empty or not a valid integer.
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

// ParseEnvBool interprets a raw string as a boolean.
// Recognises "1", "true", "yes", "y", "on" (case-insensitive) as true;
// everything else (including empty) is false.
func ParseEnvBool(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

// ParseEnvBoolKey returns the boolean value of the named environment variable.
// Returns false when the variable is empty or not a recognised truthy value.
func ParseEnvBoolKey(key string) bool {
	return ParseEnvBool(os.Getenv(key))
}

// ParseEnvDuration returns the duration value of the named environment variable.
// Returns (0, false) when the variable is empty or not a valid duration string.
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
