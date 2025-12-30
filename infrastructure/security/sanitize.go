// Package security provides security utilities for the service layer
package security

import (
	"regexp"
	"strings"
)

// SensitivePattern represents a pattern for detecting sensitive information
type SensitivePattern struct {
	Name    string
	Pattern *regexp.Regexp
	Mask    string
}

var (
	// Common sensitive patterns - order matters! More specific patterns should come first
	sensitivePatterns = []SensitivePattern{
		{
			Name:    "JWT Token",
			Pattern: regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`),
			Mask:    "[REDACTED_JWT]",
		},
		{
			Name:    "Private Key Header",
			Pattern: regexp.MustCompile(`-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----`),
			Mask:    "[REDACTED_PRIVATE_KEY]",
		},
		{
			Name:    "Bearer Token",
			Pattern: regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9_\-\.]{20,}`),
			Mask:    "Bearer [REDACTED_TOKEN]",
		},
		{
			Name:    "API Key",
			Pattern: regexp.MustCompile(`(?i)(api[_-]?key|apikey|access[_-]?key)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?`),
			Mask:    "$1=[REDACTED_API_KEY]",
		},
		{
			Name:    "Password",
			Pattern: regexp.MustCompile(`(?i)(password|passwd|pwd)\s*[:=]\s*['"]?([^'"\s]{6,})['"]?`),
			Mask:    "$1=[REDACTED_PASSWORD]",
		},
		{
			Name:    "Secret",
			Pattern: regexp.MustCompile(`(?i)(secret|client_secret)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{16,})['"]?`),
			Mask:    "$1=[REDACTED_SECRET]",
		},
		{
			Name:    "X-Service-Token Header",
			Pattern: regexp.MustCompile(`(?i)x-service-token\s*:\s*['"]?([^'"\n]{20,})['"]?`),
			Mask:    "X-Service-Token: [REDACTED_SERVICE_TOKEN]",
		},
		{
			Name:    "Authorization Header",
			Pattern: regexp.MustCompile(`(?i)authorization\s*:\s*['"]?([^'"\n]{20,})['"]?`),
			Mask:    "Authorization: [REDACTED_AUTH]",
		},
		{
			Name:    "Credit Card",
			Pattern: regexp.MustCompile(`\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b`),
			Mask:    "[REDACTED_CC]",
		},
		{
			Name:    "Email (partial)",
			Pattern: regexp.MustCompile(`\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b`),
			Mask:    "$1@[REDACTED_DOMAIN]",
		},
	}

	// Header patterns for sanitizing HTTP headers
	sensitiveHeaders = []string{
		"authorization",
		"x-service-token",
		"x-api-key",
		"cookie",
		"set-cookie",
		"proxy-authorization",
	}
)

// SanitizeString removes or masks sensitive information from a string
func SanitizeString(input string) string {
	if input == "" {
		return input
	}

	result := input
	for _, pattern := range sensitivePatterns {
		result = pattern.Pattern.ReplaceAllString(result, pattern.Mask)
	}

	return result
}

// SanitizeError sanitizes error messages before logging
func SanitizeError(err error) string {
	if err == nil {
		return ""
	}
	return SanitizeString(err.Error())
}

// SanitizeMap sanitizes a map of key-value pairs (useful for logging context)
func SanitizeMap(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}

	sanitized := make(map[string]interface{}, len(data))
	for key, value := range data {
		lowerKey := strings.ToLower(key)

		// Check if key is sensitive
		isSensitive := false
		for _, sensitiveKey := range []string{
			"password", "passwd", "pwd", "secret", "token", "key", "auth",
			"authorization", "credential", "private", "api_key", "apikey",
		} {
			if strings.Contains(lowerKey, sensitiveKey) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized[key] = "[REDACTED]"
		} else {
			// Sanitize string values
			if strVal, ok := value.(string); ok {
				sanitized[key] = SanitizeString(strVal)
			} else {
				sanitized[key] = value
			}
		}
	}

	return sanitized
}

// SanitizeHeaders sanitizes HTTP headers for logging
func SanitizeHeaders(headers map[string][]string) map[string][]string {
	if headers == nil {
		return nil
	}

	sanitized := make(map[string][]string, len(headers))
	for key, values := range headers {
		lowerKey := strings.ToLower(key)

		// Check if header is sensitive
		isSensitive := false
		for _, sensitiveHeader := range sensitiveHeaders {
			if lowerKey == sensitiveHeader || strings.Contains(lowerKey, sensitiveHeader) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized[key] = []string{"[REDACTED]"}
		} else {
			// Sanitize each value
			sanitizedValues := make([]string, len(values))
			for i, val := range values {
				sanitizedValues[i] = SanitizeString(val)
			}
			sanitized[key] = sanitizedValues
		}
	}

	return sanitized
}

// AddSensitivePattern adds a custom sensitive pattern to the sanitizer
func AddSensitivePattern(name string, pattern *regexp.Regexp, mask string) {
	sensitivePatterns = append(sensitivePatterns, SensitivePattern{
		Name:    name,
		Pattern: pattern,
		Mask:    mask,
	})
}

// IsSensitiveKey checks if a key name suggests sensitive data
func IsSensitiveKey(key string) bool {
	lowerKey := strings.ToLower(key)
	sensitiveKeywords := []string{
		"password", "passwd", "pwd", "secret", "token", "key", "auth",
		"authorization", "credential", "private", "api_key", "apikey",
		"client_secret", "access_token", "refresh_token",
	}

	for _, keyword := range sensitiveKeywords {
		if strings.Contains(lowerKey, keyword) {
			return true
		}
	}

	return false
}
