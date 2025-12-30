# Security Package

This package provides security utilities for the service layer, including secret sanitization and secure logging.

## Features

### 1. Secret Sanitization

The `sanitize.go` module provides functions to remove or mask sensitive information from strings, errors, maps, and HTTP headers before logging or returning to clients.

#### Supported Patterns

- JWT Tokens
- Bearer Tokens
- API Keys
- Private Keys
- Passwords
- Secrets
- Authorization Headers
- Credit Cards
- Email Addresses (partial)

#### Usage Examples

```go
import "github.com/R3E-Network/service_layer/infrastructure/security"

// Sanitize a string
input := "Authorization: Bearer secret_token_12345"
sanitized := security.SanitizeString(input)
// Output: "Authorization: Bearer [REDACTED_TOKEN]"

// Sanitize an error
err := errors.New("token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig is invalid")
sanitizedErr := security.SanitizeError(err)
// Output: "token [REDACTED_JWT] is invalid"

// Sanitize a map (useful for logging context)
data := map[string]interface{}{
    "username": "john_doe",
    "password": "secret123",
    "api_key":  "sk_test_123456",
}
sanitized := security.SanitizeMap(data)
// Output: {"username": "john_doe", "password": "[REDACTED]", "api_key": "[REDACTED]"}

// Sanitize HTTP headers
headers := map[string][]string{
    "Content-Type":    {"application/json"},
    "Authorization":   {"Bearer secret_token"},
    "X-Service-Token": {"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig"},
}
sanitized := security.SanitizeHeaders(headers)
// Authorization and X-Service-Token will be redacted
```

### 2. Custom Patterns

You can add custom sensitive patterns:

```go
import "regexp"

pattern := regexp.MustCompile(`custom-secret-[A-Za-z0-9]+`)
security.AddSensitivePattern("Custom Secret", pattern, "[REDACTED_CUSTOM]")
```

### 3. Key Detection

Check if a key name suggests sensitive data:

```go
if security.IsSensitiveKey("api_key") {
    // Handle sensitive data
}
```

## Integration with Middleware

The security package is integrated with the service authentication middleware to automatically sanitize error messages and logs.

### ServiceAuthMiddleware

The `ServiceAuthMiddleware` now includes:

1. **Background Token Cache Cleanup**: Automatically removes expired tokens every 2 minutes
2. **Manual Cache Invalidation**: Call `InvalidateCache()` when keys are rotated
3. **Graceful Shutdown**: Call `StopCleanup()` to stop the background goroutine
4. **Secret Sanitization**: All error messages and logs are sanitized before output

#### Example Usage

```go
import (
    "github.com/R3E-Network/service_layer/infrastructure/middleware"
    "github.com/R3E-Network/service_layer/infrastructure/logging"
)

// Create middleware
authMiddleware := middleware.NewServiceAuthMiddleware(middleware.ServiceAuthConfig{
    PublicKey:       publicKey,
    Logger:          logger,
    AllowedServices: []string{"service1", "service2"},
    RequireUserID:   true,
    SkipPaths:       []string{"/health", "/metrics"},
})

// Use in HTTP server
handler := authMiddleware.Handler(yourHandler)

// On key rotation, invalidate cache
authMiddleware.InvalidateCache()

// On shutdown, stop cleanup goroutine
defer authMiddleware.StopCleanup()
```

## Best Practices

1. **Always sanitize before logging**: Use `SanitizeError()` or `SanitizeString()` before logging any error messages
2. **Sanitize user-facing errors**: Use `SanitizeString()` on error messages returned to clients
3. **Sanitize context data**: Use `SanitizeMap()` when logging request context or metadata
4. **Invalidate cache on key rotation**: Call `InvalidateCache()` when rotating service keys
5. **Graceful shutdown**: Always call `StopCleanup()` during application shutdown

## Testing

Run tests with:

```bash
go test ./infrastructure/security/...
```

## Security Considerations

- The sanitization patterns are designed to catch common sensitive data patterns
- Custom patterns can be added for application-specific secrets
- Sanitization is performed on a best-effort basis and should not be the only security measure
- Always use proper secret management systems (e.g., HashiCorp Vault, AWS Secrets Manager)
- Never log raw request/response bodies without sanitization
