# Security Fixes Usage Examples

This document provides practical examples of how to use the security fixes implemented in the service layer.

## 1. Using ServiceAuthMiddleware with Background Cleanup

### Basic Setup

```go
package main

import (
    "context"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

func main() {
    logger := logging.NewFromEnv("my-service")

    // Load RSA public key for token verification
    publicKeyPEM, err := os.ReadFile("/path/to/public.pem")
    if err != nil {
        logger.WithError(err).Fatal("Failed to load public key")
    }

    publicKey, err := middleware.ParseRSAPublicKeyFromPEM(publicKeyPEM)
    if err != nil {
        logger.WithError(err).Fatal("Failed to parse public key")
    }

    // Create service auth middleware with automatic cleanup
    authMiddleware := middleware.NewServiceAuthMiddleware(middleware.ServiceAuthConfig{
        PublicKey:       publicKey,
        Logger:          logger,
        AllowedServices: []string{"gateway", "worker", "scheduler"},
        RequireUserID:   true,
        SkipPaths:       []string{"/health", "/metrics"},
    })

    // Important: Stop cleanup goroutine on shutdown
    defer authMiddleware.StopCleanup()

    // Create HTTP server
    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", handleData)

    // Apply middleware
    handler := authMiddleware.Handler(mux)

    server := &http.Server{
        Addr:    ":8080",
        Handler: handler,
    }

    // Graceful shutdown
    go func() {
        sigChan := make(chan os.Signal, 1)
        signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
        <-sigChan

        logger.Info("Shutting down server...")

        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()

        if err := server.Shutdown(ctx); err != nil {
            logger.WithError(err).Error("Server shutdown error")
        }
    }()

    logger.Infof("Server starting on %s", server.Addr)
    if err := server.ListenAndServe(); err != http.ErrServerClosed {
        logger.WithError(err).Fatal("Server error")
    }
}

func handleData(w http.ResponseWriter, r *http.Request) {
    // Your handler logic
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}
```

### Key Rotation Scenario

```go
// When rotating service keys, invalidate the token cache
func rotateServiceKeys(authMiddleware *middleware.ServiceAuthMiddleware) error {
    // 1. Load new public key
    newPublicKeyPEM, err := os.ReadFile("/path/to/new_public.pem")
    if err != nil {
        return err
    }

    newPublicKey, err := middleware.ParseRSAPublicKeyFromPEM(newPublicKeyPEM)
    if err != nil {
        return err
    }

    // 2. Invalidate all cached tokens
    authMiddleware.InvalidateCache()

    // 3. Update the public key (you'll need to add a method for this)
    // or create a new middleware instance

    return nil
}
```

## 2. Using Secret Sanitization

### Sanitizing Error Messages

```go
package handlers

import (
    "fmt"
    "net/http"

    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/security"
    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

func handleRequest(w http.ResponseWriter, r *http.Request, logger *logging.Logger) {
    token := r.Header.Get("Authorization")

    // Simulate an error that might contain sensitive data
    err := fmt.Errorf("authentication failed with token: %s", token)

    // WRONG: Logging raw error (may expose token)
    // logger.WithError(err).Error("Request failed")

    // CORRECT: Sanitize error before logging
    sanitizedErr := security.SanitizeError(err)
    logger.WithFields(map[string]interface{}{
        "path":   r.URL.Path,
        "method": r.Method,
    }).Errorf("Request failed: %s", sanitizedErr)

    // CORRECT: Sanitize error message for client response
    sanitizedMsg := security.SanitizeString(err.Error())
    http.Error(w, sanitizedMsg, http.StatusUnauthorized)
}
```

### Sanitizing Log Context

```go
func logRequestContext(r *http.Request, logger *logging.Logger) {
    // Collect request metadata
    metadata := map[string]interface{}{
        "path":          r.URL.Path,
        "method":        r.Method,
        "user_agent":    r.UserAgent(),
        "authorization": r.Header.Get("Authorization"),
        "api_key":       r.Header.Get("X-API-Key"),
        "client_ip":     r.RemoteAddr,
    }

    // WRONG: Logging raw metadata (may expose secrets)
    // logger.WithFields(metadata).Info("Request received")

    // CORRECT: Sanitize metadata before logging
    sanitizedMetadata := security.SanitizeMap(metadata)
    logger.WithFields(sanitizedMetadata).Info("Request received")
}
```

### Sanitizing HTTP Headers

```go
func logHeaders(r *http.Request, logger *logging.Logger) {
    headers := make(map[string][]string)
    for k, v := range r.Header {
        headers[k] = v
    }

    // WRONG: Logging raw headers
    // logger.WithFields(map[string]interface{}{"headers": headers}).Debug("Request headers")

    // CORRECT: Sanitize headers before logging
    sanitizedHeaders := security.SanitizeHeaders(headers)
    logger.WithFields(map[string]interface{}{
        "headers": sanitizedHeaders,
    }).Debug("Request headers")
}
```

## 3. Rate Limiting Integration

### Applying Rate Limiting to Services

```go
package main

import (
    "net/http"
    "time"

    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

func setupMiddleware(logger *logging.Logger) http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", handleData)

    // Create rate limiter: 100 requests per minute, burst of 10
    rateLimiter := middleware.NewRateLimiterWithWindow(
        100,              // limit: 100 requests
        time.Minute,      // window: per minute
        10,               // burst: allow burst of 10
        logger,
    )

    // Start background cleanup for rate limiter
    stopCleanup := rateLimiter.StartCleanup(5 * time.Minute)
    defer stopCleanup()

    // Apply rate limiting middleware
    handler := rateLimiter.Handler(mux)

    return handler
}
```

### Combining Multiple Middleware

```go
func setupSecureService(logger *logging.Logger, publicKey *rsa.PublicKey) http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/data", handleData)

    // 1. Rate limiting (outermost)
    rateLimiter := middleware.NewRateLimiterWithWindow(100, time.Minute, 10, logger)

    // 2. Service authentication
    authMiddleware := middleware.NewServiceAuthMiddleware(middleware.ServiceAuthConfig{
        PublicKey:       publicKey,
        Logger:          logger,
        AllowedServices: []string{"gateway"},
        RequireUserID:   true,
    })

    // 3. Apply middleware in order (rate limit -> auth -> handler)
    handler := rateLimiter.Handler(
        authMiddleware.Handler(mux),
    )

    return handler
}
```

## 4. Custom Sensitive Patterns

### Adding Application-Specific Patterns

```go
package main

import (
    "regexp"

    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/security"
)

func init() {
    // Add custom pattern for internal service IDs
    serviceIDPattern := regexp.MustCompile(`svc_[a-z0-9]{32}`)
    security.AddSensitivePattern("Service ID", serviceIDPattern, "[REDACTED_SERVICE_ID]")

    // Add custom pattern for session tokens
    sessionPattern := regexp.MustCompile(`sess_[A-Za-z0-9]{64}`)
    security.AddSensitivePattern("Session Token", sessionPattern, "[REDACTED_SESSION]")

    // Add custom pattern for database connection strings
    dbConnPattern := regexp.MustCompile(`postgres://[^@]+@[^/]+/[^\s]+`)
    security.AddSensitivePattern("DB Connection", dbConnPattern, "postgres://[REDACTED]")
}
```

## 5. Testing Security Features

### Testing Sanitization

```go
package handlers_test

import (
    "testing"

    "github.com/R3E-Network/neo-miniapps-platform/infrastructure/security"
)

func TestErrorSanitization(t *testing.T) {
    // Test that JWT tokens are redacted
    input := "Failed to authenticate with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig"
    result := security.SanitizeString(input)

    if contains(result, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9") {
        t.Error("JWT token was not redacted")
    }

    if !contains(result, "[REDACTED_JWT]") {
        t.Error("Expected [REDACTED_JWT] in sanitized output")
    }
}

func contains(s, substr string) bool {
    return len(s) >= len(substr) && findSubstring(s, substr)
}
```

## Best Practices Summary

1. **Always call `StopCleanup()`** on `ServiceAuthMiddleware` during shutdown
2. **Invalidate cache** when rotating service keys using `InvalidateCache()`
3. **Sanitize all error messages** before logging or returning to clients
4. **Sanitize context data** when logging request metadata
5. **Apply rate limiting** to all public-facing endpoints
6. **Combine middleware** in the correct order: rate limit -> auth -> handler
7. **Add custom patterns** for application-specific sensitive data
8. **Test sanitization** to ensure secrets are properly redacted
