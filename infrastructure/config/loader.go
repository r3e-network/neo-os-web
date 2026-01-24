// Package config provides unified configuration loading helpers for service layer services.
// This package eliminates duplication across service entry points by providing:
// - Environment variable and secret loading with fallbacks
// - Hex address prefix trimming
// - CSV parsing
// - Byte size parsing
// - Port configuration
// - Chain configuration helpers
package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/hex"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
)

// =============================================================================
// Environment/Secret Loading Helpers
// =============================================================================

// EnvOrSecret retrieves a configuration value from environment or Marble secrets.
// Priority:
// 1. Marble secret (production/TEE mode)
// 2. Environment variable
// 3. Default value (if provided)
//
// This is the preferred way to load configuration values in Marble services.
func EnvOrSecret(m *marble.Marble, envKey string, defaultValue string) string {
	// Try Marble secret first (production/TEE mode)
	if m != nil {
		if secret, ok := m.Secret(envKey); ok && len(secret) > 0 {
			return strings.TrimSpace(string(secret))
		}
	}

	// Fallback to environment variable
	value := strings.TrimSpace(os.Getenv(envKey))
	if value != "" {
		return value
	}

	return defaultValue
}

// EnvOrSecretBytes is like EnvOrSecret but returns raw bytes for binary values.
func EnvOrSecretBytes(m *marble.Marble, envKey string) ([]byte, error) {
	// Try Marble secret first
	if m != nil {
		if secret, ok := m.Secret(envKey); ok && len(secret) > 0 {
			return secret, nil
		}
	}

	// Fallback to environment variable (hex-encoded)
	value := strings.TrimSpace(os.Getenv(envKey))
	if value == "" {
		return nil, fmt.Errorf("%s is required", envKey)
	}

	// Check if hex-encoded
	if strings.HasPrefix(value, "0x") {
		return hex.DecodeString(value)
	}

	return []byte(value), nil
}

// RequireEnvOrSecret retrieves a required configuration value.
// Returns empty string and logs error if not found.
func RequireEnvOrSecret(m *marble.Marble, envKey string) string {
	value := EnvOrSecret(m, envKey, "")
	if value == "" {
		log.Printf("CRITICAL: %s is required but not configured", envKey)
	}
	return value
}

// GetEnv retrieves an environment variable with optional default.
// This is a simple wrapper for os.Getenv without Marble secret support.
// For services running in Marble, use EnvOrSecret instead.
func GetEnv(key, defaultValue string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return defaultValue
}

// GetEnvBool retrieves a boolean environment variable with optional default.
// Accepts: "true", "1", "yes", "y" (case-insensitive) as true.
func GetEnvBool(key string, defaultValue bool) bool {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return defaultValue
	}
	lower := strings.ToLower(val)
	return lower == "true" || lower == "1" || lower == "yes" || lower == "y"
}

// GetEnvInt retrieves an integer environment variable with optional default.
// Returns 0 if the value is invalid.
func GetEnvInt(key string, defaultValue int) int {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return defaultValue
	}
	return parsed
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

// =============================================================================
// CSV Parsing
// =============================================================================

// SplitAndTrimCSV splits a CSV string and trims each part.
// Empty values are filtered out.
func SplitAndTrimCSV(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// =============================================================================
// Byte Size Parsing
// =============================================================================

// ParseByteSize parses a size string like "1GB", "512MB" into bytes.
// Supported suffixes: B, KB, MB, GB, TB (and their lowercase variants).
func ParseByteSize(raw string) (int64, error) {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" {
		return 0, fmt.Errorf("empty size")
	}

	type suffix struct {
		value      string
		multiplier int64
	}

	suffixes := []suffix{
		{"gib", 1024 * 1024 * 1024},
		{"gb", 1024 * 1024 * 1024},
		{"g", 1024 * 1024 * 1024},
		{"mib", 1024 * 1024},
		{"mb", 1024 * 1024},
		{"m", 1024 * 1024},
		{"kib", 1024},
		{"kb", 1024},
		{"k", 1024},
		{"b", 1},
	}

	const maxInt64 = int64(^uint64(0) >> 1)

	for _, entry := range suffixes {
		if !strings.HasSuffix(value, entry.value) {
			continue
		}
		num := strings.TrimSpace(strings.TrimSuffix(value, entry.value))
		if num == "" {
			return 0, fmt.Errorf("missing size value")
		}
		parsed, err := strconv.ParseInt(num, 10, 64)
		if err != nil {
			return 0, err
		}
		if parsed <= 0 {
			return 0, fmt.Errorf("size must be positive")
		}
		if parsed > maxInt64/entry.multiplier {
			return 0, fmt.Errorf("size too large")
		}
		return parsed * entry.multiplier, nil
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, err
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("size must be positive")
	}
	return parsed, nil
}

// =============================================================================
// Duration Parsing
// =============================================================================

// ParseDurationOrDefault parses a duration string or returns the default.
func ParseDurationOrDefault(raw string, defaultDuration time.Duration) time.Duration {
	if raw == "" {
		return defaultDuration
	}
	if parsed, err := time.ParseDuration(raw); err == nil {
		return parsed
	}
	return defaultDuration
}

// =============================================================================
// Bool Parsing
// =============================================================================

// ParseBoolOrDefault parses a boolean string or returns the default.
// Accepts: "true", "1", "yes", "y" (case-insensitive) as true.
func ParseBoolOrDefault(raw string, defaultValue bool) bool {
	if raw == "" {
		return defaultValue
	}
	lower := strings.ToLower(raw)
	return lower == "true" || lower == "1" || lower == "yes" || lower == "y"
}

// =============================================================================
// Integer Parsing
// =============================================================================

// ParseIntOrDefault parses an integer string or returns the default.
func ParseIntOrDefault(raw string, defaultValue int) int {
	if raw == "" {
		return defaultValue
	}
	if parsed, err := strconv.Atoi(raw); err == nil {
		return parsed
	}
	return defaultValue
}

// ParseInt64OrDefault parses an int64 string or returns the default.
func ParseInt64OrDefault(raw string, defaultValue int64) int64 {
	if raw == "" {
		return defaultValue
	}
	if parsed, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return parsed
	}
	return defaultValue
}

// ParseUint32OrDefault parses a uint32 string or returns the default.
func ParseUint32OrDefault(raw string, defaultValue uint32) uint32 {
	if raw == "" {
		return defaultValue
	}
	parsed, err := strconv.ParseUint(raw, 10, 32)
	if err == nil {
		return uint32(parsed)
	}
	return defaultValue
}

// =============================================================================
// Port Configuration
// =============================================================================

// GetPort retrieves the service port from config or environment.
func GetPort(serviceID string, defaultPort int) int {
	if port := os.Getenv("PORT"); port != "" {
		if parsed, err := strconv.Atoi(port); err == nil && parsed > 0 {
			return parsed
		}
	}

	// Check services config
	cfg := LoadServicesConfigOrDefault()
	if settings := cfg.GetSettings(serviceID); settings != nil && settings.Port > 0 {
		return settings.Port
	}

	return defaultPort
}

// =============================================================================
// Chain Configuration Helpers
// =============================================================================

// ChainConfigValue gets a chain configuration value with fallback.
// Priority: chain meta config -> environment variable -> secret -> default
func ChainConfigValue(chainMeta map[string]string, envKey string, secretKey string, defaultValue string) string {
	// Try chain meta first
	if chainMeta != nil {
		if value := chainMeta[envKey]; value != "" {
			return hex.TrimPrefix(value)
		}
	}

	// Try environment variable
	if value := strings.TrimSpace(os.Getenv(envKey)); value != "" {
		return hex.TrimPrefix(value)
	}

	return defaultValue
}

// =============================================================================
// Timeouts
// =============================================================================

// DefaultTimeouts returns standard timeout values for different operations.
type DefaultTimeouts struct {
	HTTP     time.Duration
	RPC      time.Duration
	Database time.Duration
	TxProxy  time.Duration
	Service  time.Duration
}

// GetDefaultTimeouts returns default timeout values.
func GetDefaultTimeouts() DefaultTimeouts {
	return DefaultTimeouts{
		HTTP:     30 * time.Second,
		RPC:      15 * time.Second,
		Database: 10 * time.Second,
		TxProxy:  30 * time.Second,
		Service:  15 * time.Second,
	}
}
