// Package runtime provides environment/runtime detection helpers shared across the service layer.
package runtime

import (
	"os"
	"strings"
	"time"
)

// ResolveInt returns the first positive value from: cfgValue, env var, fallback.
// Useful for service config fields that support env-var overrides with a default.
func ResolveInt(cfgValue int, envKey string, fallback int) int {
	if cfgValue > 0 {
		return cfgValue
	}
	if parsed, ok := ParseEnvInt(envKey); ok && parsed > 0 {
		return parsed
	}
	return fallback
}

// ResolveDuration returns the first positive value from: cfgValue, env var, fallback.
func ResolveDuration(cfgValue time.Duration, envKey string, fallback time.Duration) time.Duration {
	if cfgValue > 0 {
		return cfgValue
	}
	if parsed, ok := ParseEnvDuration(envKey); ok && parsed > 0 {
		return parsed
	}
	return fallback
}

// ResolveString returns the first non-empty value from: cfgValue, env var, fallback.
func ResolveString(cfgValue string, envKey string, fallback string) string {
	if v := strings.TrimSpace(cfgValue); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv(envKey)); v != "" {
		return v
	}
	return fallback
}

// ResolveBool returns the env-var override if set, otherwise cfgValue.
// Unlike the other Resolve* helpers, bools cannot use "zero means unset" so
// the env var takes precedence only when it is explicitly set (non-empty).
func ResolveBool(cfgValue bool, envKey string) bool {
	if raw := strings.TrimSpace(os.Getenv(envKey)); raw != "" {
		return ParseBoolValue(raw)
	}
	return cfgValue
}
