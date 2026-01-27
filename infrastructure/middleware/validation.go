// Package middleware provides HTTP middleware for the service layer.
package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/R3E-Network/service_layer/infrastructure/httputil"
)

// ValidationConfig holds configuration for input validation.
type ValidationConfig struct {
	MaxBodySize     int64
	AllowedMethods  []string
	RequiredHeaders []string
	ContentTypes    []string
}

// DefaultValidationConfig returns sensible defaults for validation.
func DefaultValidationConfig() ValidationConfig {
	return ValidationConfig{
		MaxBodySize:    8 << 20, // 8MB
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		ContentTypes:   []string{"application/json", "application/x-www-form-urlencoded"},
	}
}

// ValidationMiddleware validates incoming requests.
type ValidationMiddleware struct {
	config ValidationConfig
}

// NewValidationMiddleware creates a new validation middleware.
func NewValidationMiddleware(config ValidationConfig) *ValidationMiddleware {
	return &ValidationMiddleware{config: config}
}

// Handler returns the validation middleware handler.
func (m *ValidationMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Validate HTTP method
		if len(m.config.AllowedMethods) > 0 {
			allowed := false
			for _, method := range m.config.AllowedMethods {
				if r.Method == method {
					allowed = true
					break
				}
			}
			if !allowed {
				httputil.WriteErrorResponse(w, r, http.StatusMethodNotAllowed,
					"METHOD_NOT_ALLOWED", "method not allowed", nil)
				return
			}
		}

		// Validate required headers
		for _, header := range m.config.RequiredHeaders {
			if r.Header.Get(header) == "" {
				httputil.WriteErrorResponse(w, r, http.StatusBadRequest,
					"MISSING_HEADER", "missing required header: "+header, nil)
				return
			}
		}

		// Validate Content-Type for requests with body
		if r.ContentLength > 0 && len(m.config.ContentTypes) > 0 {
			contentType := r.Header.Get("Content-Type")
			valid := false
			for _, ct := range m.config.ContentTypes {
				if strings.HasPrefix(contentType, ct) {
					valid = true
					break
				}
			}
			if !valid {
				httputil.WriteErrorResponse(w, r, http.StatusUnsupportedMediaType,
					"UNSUPPORTED_MEDIA_TYPE", "unsupported content type", nil)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// SanitizeInput removes potentially dangerous characters from input.
func SanitizeInput(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")
	// Trim whitespace
	input = strings.TrimSpace(input)
	return input
}

// ValidateJSON validates JSON input and returns parsed data.
func ValidateJSON(body io.Reader, maxSize int64, v interface{}) error {
	decoder := json.NewDecoder(io.LimitReader(body, maxSize))
	decoder.DisallowUnknownFields()
	return decoder.Decode(v)
}

// Common validation patterns
var (
	EmailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	UUIDRegex     = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	HexRegex      = regexp.MustCompile(`^(0x)?[0-9a-fA-F]+$`)
	AlphaNumRegex = regexp.MustCompile(`^[a-zA-Z0-9]+$`)
)

// IsValidEmail checks if the input is a valid email address.
func IsValidEmail(email string) bool {
	return EmailRegex.MatchString(email)
}

// IsValidUUID checks if the input is a valid UUID.
func IsValidUUID(uuid string) bool {
	return UUIDRegex.MatchString(uuid)
}

// IsValidHex checks if the input is valid hexadecimal.
func IsValidHex(hex string) bool {
	return HexRegex.MatchString(hex)
}
