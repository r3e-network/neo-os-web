// Package middleware provides HTTP middleware for the service layer.
package middleware

import (
	"crypto/rsa"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/errors"
	internalhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/security"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/serviceauth"
)

// =============================================================================
// Service Auth Middleware
// =============================================================================

// ServiceAuthMiddleware provides service-to-service JWT authentication.
type ServiceAuthMiddleware struct {
	publicKey       *rsa.PublicKey
	logger          *logging.Logger
	allowedServices map[string]bool
	requireUserID   bool
	skipPaths       map[string]bool
	mu              sync.RWMutex
	validatedTokens map[string]*cachedToken // In-memory cache for validated tokens
	stopCleanup     chan struct{}           // Channel to stop background cleanup
	cleanupOnce     sync.Once               // Ensures cleanup goroutine starts only once
	stopOnce        sync.Once               // Ensures stopCleanup channel is closed only once
}

// cachedToken stores validated token info with expiry.
type cachedToken struct {
	claims    *serviceauth.ServiceClaims
	expiresAt time.Time
}

// ServiceAuthConfig configures the service authentication middleware.
type ServiceAuthConfig struct {
	PublicKey       *rsa.PublicKey
	Logger          *logging.Logger
	AllowedServices []string
	RequireUserID   bool
	SkipPaths       []string
}

// NewServiceAuthMiddleware creates a new service authentication middleware.
func NewServiceAuthMiddleware(cfg ServiceAuthConfig) *ServiceAuthMiddleware {
	allowed := make(map[string]bool)
	for _, svc := range cfg.AllowedServices {
		allowed[svc] = true
	}

	skip := make(map[string]bool)
	for _, path := range cfg.SkipPaths {
		skip[path] = true
	}

	logger := cfg.Logger
	if logger == nil {
		logger = logging.New("serviceauth", "info", "json")
	}

	m := &ServiceAuthMiddleware{
		publicKey:       cfg.PublicKey,
		logger:          logger,
		allowedServices: allowed,
		requireUserID:   cfg.RequireUserID,
		skipPaths:       skip,
		validatedTokens: make(map[string]*cachedToken),
		stopCleanup:     make(chan struct{}),
	}

	// Start background cleanup goroutine
	m.startBackgroundCleanup()

	return m
}

// Handler returns the middleware handler function.
func (m *ServiceAuthMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip authentication for certain paths
		if m.skipPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		// Validate service token
		serviceToken := r.Header.Get(serviceauth.ServiceTokenHeader)
		if serviceToken == "" {
			m.respondError(w, r, errors.Unauthorized("Missing service token"))
			return
		}

		// Validate and extract claims
		claims, err := m.validateServiceToken(serviceToken)
		if err != nil {
			m.logger.WithContext(r.Context()).WithError(err).Warn("Service token validation failed")
			m.respondError(w, r, err)
			return
		}

		// Check if service is allowed
		if !m.isServiceAllowed(claims.ServiceID) {
			m.logger.WithContext(r.Context()).WithFields(map[string]interface{}{
				"service_id": claims.ServiceID,
			}).Warn("Service not in allowed list")
			m.respondError(w, r, errors.Forbidden("Service not authorized"))
			return
		}

		// Validate X-User-ID header if required
		userID := r.Header.Get(serviceauth.UserIDHeader)
		if m.requireUserID && userID == "" {
			m.respondError(w, r, errors.Unauthorized("Missing X-User-ID header"))
			return
		}

		// Validate X-User-ID format (UUID format check)
		if userID != "" && !isValidUserID(userID) {
			m.respondError(w, r, errors.InvalidFormat("X-User-ID", "UUID format required"))
			return
		}

		// Add service ID and user ID to context
		ctx := serviceauth.WithServiceID(r.Context(), claims.ServiceID)
		if userID != "" {
			ctx = serviceauth.WithUserID(ctx, userID)
		}

		// Log successful authentication
		m.logger.WithContext(ctx).WithFields(map[string]interface{}{
			"service_id": claims.ServiceID,
			"user_id":    userID,
		}).Debug("Service authentication successful")

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// validateServiceToken validates a service JWT token.
func (m *ServiceAuthMiddleware) validateServiceToken(tokenString string) (*serviceauth.ServiceClaims, error) {
	if m.publicKey == nil {
		return nil, errors.Internal("service authentication is not configured", nil)
	}

	// Check cache first
	if cached := m.getCachedToken(tokenString); cached != nil {
		return cached, nil
	}

	// Parse and validate token
	token, err := jwt.ParseWithClaims(tokenString, &serviceauth.ServiceClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method is RS256
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, errors.InvalidToken(nil).WithDetails("method", token.Header["alg"])
		}
		return m.publicKey, nil
	})

	if err != nil {
		return nil, errors.InvalidToken(err)
	}

	if !token.Valid {
		return nil, errors.InvalidToken(nil)
	}

	claims, ok := token.Claims.(*serviceauth.ServiceClaims)
	if !ok {
		return nil, errors.InvalidToken(nil).WithDetails("reason", "invalid claims type")
	}

	if claims.ServiceID == "" {
		return nil, errors.InvalidToken(nil).WithDetails("reason", "missing service_id claim")
	}

	// Defense in depth: ensure token was minted by our service-layer issuer.
	if claims.Issuer != "service-layer" {
		return nil, errors.InvalidToken(nil).WithDetails("reason", "invalid issuer")
	}
	// Keep Subject consistent with the service identity.
	if claims.Subject != "" && claims.Subject != claims.ServiceID {
		return nil, errors.InvalidToken(nil).WithDetails("reason", "subject/service mismatch")
	}

	// Cache the validated token
	m.cacheToken(tokenString, claims)

	return claims, nil
}

// getCachedToken retrieves a cached token if valid.
func (m *ServiceAuthMiddleware) getCachedToken(tokenString string) *serviceauth.ServiceClaims {
	m.mu.RLock()
	cached, ok := m.validatedTokens[tokenString]
	if !ok {
		m.mu.RUnlock()
		return nil
	}

	// Check if cache entry has expired
	if time.Now().After(cached.expiresAt) {
		m.mu.RUnlock()
		m.mu.Lock()
		// Re-check under write lock before deleting.
		if current, ok := m.validatedTokens[tokenString]; ok && time.Now().After(current.expiresAt) {
			delete(m.validatedTokens, tokenString)
		}
		m.mu.Unlock()
		return nil
	}

	m.mu.RUnlock()
	return cached.claims
}

// cacheToken stores a validated token in cache.
func (m *ServiceAuthMiddleware) cacheToken(tokenString string, claims *serviceauth.ServiceClaims) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Cache for 5 minutes or until token expiry, whichever is sooner
	cacheExpiry := time.Now().Add(5 * time.Minute)
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(cacheExpiry) {
		cacheExpiry = claims.ExpiresAt.Time
	}

	m.validatedTokens[tokenString] = &cachedToken{
		claims:    claims,
		expiresAt: cacheExpiry,
	}

	// Cleanup old entries if cache is too large
	if len(m.validatedTokens) > 1000 {
		m.cleanupCache()
	}
}

// cleanupCache removes expired entries from the cache.
func (m *ServiceAuthMiddleware) cleanupCache() {
	now := time.Now()
	for key, cached := range m.validatedTokens {
		if now.After(cached.expiresAt) {
			delete(m.validatedTokens, key)
		}
	}
}

// startBackgroundCleanup starts a background goroutine to periodically clean up expired tokens.
// This ensures that the cache doesn't grow unbounded and that expired tokens are removed promptly.
func (m *ServiceAuthMiddleware) startBackgroundCleanup() {
	m.cleanupOnce.Do(func() {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					if m.logger != nil {
						m.logger.WithFields(map[string]interface{}{
							"panic": r,
						}).Error("Service auth token cache cleanup panicked")
					}
				}
			}()
			ticker := time.NewTicker(2 * time.Minute)
			defer ticker.Stop()

			for {
				select {
				case <-ticker.C:
					m.mu.Lock()
					m.cleanupCache()
					cacheSize := len(m.validatedTokens)
					m.mu.Unlock()

					if m.logger != nil {
						m.logger.WithFields(map[string]interface{}{
							"cache_size": cacheSize,
						}).Debug("Token cache cleanup completed")
					}

				case <-m.stopCleanup:
					if m.logger != nil {
						m.logger.WithFields(map[string]interface{}{}).Info("Token cache cleanup goroutine stopped")
					}
					return
				}
			}
		}()
	})
}

// StopCleanup stops the background cleanup goroutine.
// This should be called when the middleware is no longer needed (e.g., during shutdown).
func (m *ServiceAuthMiddleware) StopCleanup() {
	m.stopOnce.Do(func() {
		close(m.stopCleanup)
	})
}

// InvalidateCache clears all cached tokens.
// This should be called when keys are rotated or when a security event requires cache invalidation.
func (m *ServiceAuthMiddleware) InvalidateCache() {
	m.mu.Lock()
	defer m.mu.Unlock()

	oldSize := len(m.validatedTokens)
	m.validatedTokens = make(map[string]*cachedToken)

	if m.logger != nil {
		m.logger.WithFields(map[string]interface{}{
			"invalidated_count": oldSize,
		}).Info("Token cache invalidated")
	}
}

// isServiceAllowed checks if a service is in the allowed list.
func (m *ServiceAuthMiddleware) isServiceAllowed(serviceID string) bool {
	// If no allowed services configured, allow all
	if len(m.allowedServices) == 0 {
		return true
	}
	return m.allowedServices[serviceID]
}

// respondError sends an error response.
func (m *ServiceAuthMiddleware) respondError(w http.ResponseWriter, r *http.Request, err error) {
	serviceErr := errors.GetServiceError(err)
	if serviceErr == nil {
		serviceErr = errors.Internal("Service authentication failed", err)
	}

	// Sanitize error message and details before sending to client
	sanitizedMessage := security.SanitizeString(serviceErr.Message)
	sanitizedDetails := security.SanitizeMap(serviceErr.Details)

	internalhttputil.WriteErrorResponse(w, r, serviceErr.HTTPStatus, string(serviceErr.Code), sanitizedMessage, sanitizedDetails)

	// Sanitize error for logging
	sanitizedErrMsg := security.SanitizeError(err)
	logFields := map[string]interface{}{
		"path":   r.URL.Path,
		"method": r.Method,
		"status": serviceErr.HTTPStatus,
	}

	m.logger.WithContext(r.Context()).WithFields(logFields).Warnf("Service authentication failed: %s", sanitizedErrMsg)
}

// isValidUserID validates user ID format (UUID).
func isValidUserID(userID string) bool {
	// Basic UUID format validation: 8-4-4-4-12 hex characters
	if len(userID) != 36 {
		return false
	}

	// Check format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	parts := strings.Split(userID, "-")
	if len(parts) != 5 {
		return false
	}

	expectedLengths := []int{8, 4, 4, 4, 12}
	for i, part := range parts {
		if len(part) != expectedLengths[i] {
			return false
		}
		for _, c := range part {
			if !isHexChar(c) {
				return false
			}
		}
	}

	return true
}

// isHexChar checks if a character is a valid hexadecimal character.
func isHexChar(c rune) bool {
	return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

// RequireServiceAuth is a simple middleware that requires service authentication.
// Use this for endpoints that must only be called by authenticated services.
func RequireServiceAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Derive the caller identity from verified mTLS in strict mode, falling back
		// to service-auth context / headers in development. This avoids trusting
		// spoofable headers in production/SGX environments.
		serviceID := internalhttputil.GetServiceID(r)
		if serviceID == "" {
			internalhttputil.WriteErrorResponse(w, r, http.StatusUnauthorized, "AUTH_REQUIRED", "service authentication required", nil)
			return
		}

		// Ensure downstream handlers can read service identity from context even
		// when it originated from mTLS verification.
		ctx := serviceauth.WithServiceID(r.Context(), serviceID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireUserIDHeader is a middleware that requires X-User-ID header.
func RequireUserIDHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get(serviceauth.UserIDHeader)
		if userID == "" {
			internalhttputil.WriteErrorResponse(w, r, http.StatusUnauthorized, "USER_ID_REQUIRED", "X-User-ID header required", nil)
			return
		}
		if !isValidUserID(userID) {
			internalhttputil.WriteErrorResponse(w, r, http.StatusBadRequest, "INVALID_USER_ID", "invalid X-User-ID format", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}
