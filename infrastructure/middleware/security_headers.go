// Package middleware provides HTTP middleware for the service layer.
package middleware

import (
	"net/http"
)

// SecurityHeadersMiddleware adds security headers to responses.
type SecurityHeadersMiddleware struct {
	headers map[string]string
}

// DefaultSecurityHeaders returns recommended security headers.
func DefaultSecurityHeaders() map[string]string {
	return map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"X-XSS-Protection":          "1; mode=block",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Content-Security-Policy":   "default-src 'self'",
		"Permissions-Policy":        "geolocation=(), microphone=(), camera=()",
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
		"Cache-Control":             "no-store, no-cache, must-revalidate",
		"Pragma":                    "no-cache",
	}
}

// NewSecurityHeadersMiddleware creates security headers middleware.
func NewSecurityHeadersMiddleware(headers map[string]string) *SecurityHeadersMiddleware {
	if headers == nil {
		headers = DefaultSecurityHeaders()
	}
	return &SecurityHeadersMiddleware{headers: headers}
}

// Handler returns the security headers middleware handler.
func (m *SecurityHeadersMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for key, value := range m.headers {
			w.Header().Set(key, value)
		}
		next.ServeHTTP(w, r)
	})
}
