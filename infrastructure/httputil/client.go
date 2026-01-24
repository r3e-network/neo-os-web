package httputil

import (
	"fmt"
	"net/http"
	"time"
)

// =============================================================================
// HTTP Client Configuration
// =============================================================================

// ClientConfig holds standard client configuration used across all service clients.
// This eliminates duplication of client creation logic.
type ClientConfig struct {
	// BaseURL is the base URL for the service (will be normalized)
	BaseURL string

	// ServiceID identifies the caller for service mesh authentication
	ServiceID string

	// Timeout is the request timeout. Zero means use default.
	Timeout time.Duration

	// HTTPClient is the base HTTP client to use (e.g., Marble mTLS client)
	// If nil, a default client will be created.
	HTTPClient *http.Client

	// MaxBodyBytes caps response body size to prevent memory exhaustion.
	// Zero means use default.
	MaxBodyBytes int64
}

// ClientDefaults holds default values for client configuration.
type ClientDefaults struct {
	Timeout         time.Duration
	MaxBodyBytes    int64
	NormalizeBaseURL bool
	RequireHTTPS    bool
}

// DefaultClientDefaults returns standard default values.
func DefaultClientDefaults() ClientDefaults {
	return ClientDefaults{
		Timeout:         30 * time.Second,
		MaxBodyBytes:    1 << 20, // 1MiB
		NormalizeBaseURL: true,
		RequireHTTPS:    false,
	}
}

// =============================================================================
// Client Creation Helper
// =============================================================================

// NewClient creates an HTTP client with standardized configuration.
// It handles:
// - Base URL normalization (optional)
// - Timeout handling with defaults
// - Max body size limits
// - Service ID trimming
//
// Example:
//
//	client, err := NewClient(ClientConfig{
//	    BaseURL:    cfg.ServiceURL,
//	    ServiceID:  "my-service",
//	    HTTPClient: marble.HTTPClient(),
//	}, ClientDefaults{
//	    Timeout: 15 * time.Second,
//	})
func NewClient(cfg ClientConfig, defaults ClientDefaults) (*http.Client, error) {
	// Apply timeout defaults
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = defaults.Timeout
	}
	forceTimeout := cfg.Timeout != 0

	// Copy or create HTTP client with timeout
	client := CopyHTTPClientWithTimeout(cfg.HTTPClient, timeout, forceTimeout)

	return client, nil
}

// NewClientWithBaseURL creates a client with base URL normalization.
// This is the most common pattern for service-to-service clients.
// Returns the HTTP client and normalized base URL.
func NewClientWithBaseURL(cfg ClientConfig, defaults ClientDefaults) (*http.Client, string, error) {
	// Normalize base URL
	var normalizedURL string
	var err error

	if defaults.NormalizeBaseURL {
		if defaults.RequireHTTPS {
			normalizedURL, _, err = NormalizeServiceBaseURL(cfg.BaseURL)
		} else {
			normalizedURL, _, err = NormalizeBaseURL(cfg.BaseURL, BaseURLOptions{})
		}
		if err != nil {
			return nil, "", fmt.Errorf("normalize base URL: %w", err)
		}
	} else {
		normalizedURL = cfg.BaseURL
	}

	// Create client
	client, err := NewClient(ClientConfig{
		BaseURL:    normalizedURL,
		ServiceID:  cfg.ServiceID,
		Timeout:    cfg.Timeout,
		HTTPClient: cfg.HTTPClient,
	}, defaults)
	if err != nil {
		return nil, "", err
	}

	return client, normalizedURL, nil
}

// =============================================================================
// Max Body Size Helper
// =============================================================================

// ResolveMaxBodyBytes returns the effective max body size from config and defaults.
func ResolveMaxBodyBytes(cfg int64, defaultBytes int64) int64 {
	if cfg <= 0 {
		return defaultBytes
	}
	return cfg
}

// =============================================================================
// Service ID Helper
// =============================================================================

// ResolveServiceID returns a trimmed service ID or empty string.
func ResolveServiceID(serviceID string) string {
	return trimString(serviceID)
}

func trimString(s string) string {
	// Simple inline trim to avoid import cycle
	if len(s) == 0 {
		return s
	}
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
