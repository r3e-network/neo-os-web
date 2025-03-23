# Error Handling Strategy

This document outlines the comprehensive error handling strategy for the Service Layer. Consistent error handling is crucial for providing a reliable API and making troubleshooting easier for both developers and API consumers.

## Error Types

We will implement a hierarchy of error types to represent different categories of errors:

### Base Error Types

1. **ServiceError**: Base error type for all service errors
   - Contains common fields like error code, message, and HTTP status code
   - Provides methods for serializing to JSON for API responses

2. **ValidationError**: Errors related to invalid input or parameters
   - Field-specific validation errors
   - Format validation errors
   - Type validation errors

3. **AuthorizationError**: Errors related to permissions and access
   - Authentication failures
   - Permission denied errors
   - Token validation errors

4. **ResourceError**: Errors related to resources
   - Not found errors
   - Already exists errors
   - Conflict errors

5. **SystemError**: Errors related to system operations
   - Database errors
   - External service errors
   - Configuration errors

6. **BlockchainError**: Errors related to blockchain operations
   - Transaction errors
   - Contract errors
   - Network errors

7. **FunctionError**: Errors related to function execution
   - Compilation errors
   - Runtime errors
   - Timeout errors
   - Memory limit errors

### Error Codes

Each error will have a unique error code following this format:

```
[CATEGORY]_[SUBCATEGORY]_[SPECIFIC_ERROR]
```

Examples:
- `AUTH_TOKEN_EXPIRED`
- `VALIDATION_PARAMETER_INVALID`
- `RESOURCE_FUNCTION_NOT_FOUND`
- `SYSTEM_DATABASE_CONNECTION_FAILED`
- `BLOCKCHAIN_TRANSACTION_FAILED`
- `FUNCTION_EXECUTION_TIMEOUT`

## Error Response Format

All API errors will use a consistent JSON format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error-specific details
    },
    "help_url": "https://docs.service-layer.io/errors/ERROR_CODE"
  }
}
```

### Example Error Responses

#### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_PARAMETER_INVALID",
    "message": "One or more parameters are invalid",
    "details": {
      "fields": {
        "name": "Name must be at least 3 characters",
        "timeout": "Timeout must be a positive integer"
      }
    },
    "help_url": "https://docs.service-layer.io/errors/VALIDATION_PARAMETER_INVALID"
  }
}
```

#### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Authentication token has expired",
    "details": {
      "expired_at": "2023-08-01T12:00:00Z"
    },
    "help_url": "https://docs.service-layer.io/errors/AUTH_TOKEN_EXPIRED"
  }
}
```

## Error Logging

### Log Levels

Errors will be logged with appropriate severity levels:

- **DEBUG**: Detailed information for debugging
- **INFO**: General operational information
- **WARN**: Warning conditions that might lead to errors
- **ERROR**: Error conditions that affect operation but don't crash the service
- **FATAL**: Severe errors that cause the service to crash

### Log Format

All error logs will include:

1. Timestamp
2. Error code
3. Error message
4. Stack trace (for development and staging environments)
5. Request ID for correlation
6. User ID (if authenticated)
7. Additional context-specific information

Example log entry:
```
[2023-08-01T12:34:56Z] [ERROR] [REQUEST_ID=abc123] [USER_ID=42] [CODE=FUNCTION_EXECUTION_TIMEOUT] 
Function execution timed out after 30s. Function ID: 123, Name: "price_aggregator"
Stack trace: ...
```

## Error Handling Implementation

### Go Code Structure

```go
// errors/errors.go
package errors

import (
    "fmt"
    "net/http"
)

// ServiceError is the base error type for the service
type ServiceError struct {
    Code       string                 `json:"code"`
    Message    string                 `json:"message"`
    Details    map[string]interface{} `json:"details,omitempty"`
    HelpURL    string                 `json:"help_url,omitempty"`
    HTTPStatus int                    `json:"-"`
}

func (e *ServiceError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// New creates a new ServiceError
func New(code string, message string, httpStatus int) *ServiceError {
    return &ServiceError{
        Code:       code,
        Message:    message,
        HTTPStatus: httpStatus,
        Details:    make(map[string]interface{}),
    }
}

// WithDetails adds details to the error
func (e *ServiceError) WithDetails(details map[string]interface{}) *ServiceError {
    e.Details = details
    return e
}

// ValidationError creates a new validation error
func ValidationError(message string) *ServiceError {
    return New("VALIDATION_ERROR", message, http.StatusBadRequest)
}

// AuthenticationError creates a new authentication error
func AuthenticationError(message string) *ServiceError {
    return New("AUTH_ERROR", message, http.StatusUnauthorized)
}

// ResourceNotFoundError creates a new resource not found error
func ResourceNotFoundError(resourceType string, id interface{}) *ServiceError {
    return New(
        fmt.Sprintf("RESOURCE_%s_NOT_FOUND", resourceType),
        fmt.Sprintf("%s with ID %v not found", resourceType, id),
        http.StatusNotFound,
    )
}

// ... additional error factory functions
```

### Error Middleware

We will implement middleware for consistent error handling across all API endpoints:

```go
// middleware/error_handler.go
package middleware

import (
    "github.com/R3E-Network/service_layer/internal/errors"
    "github.com/gin-gonic/gin"
)

// ErrorHandler middleware for handling errors
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()

        // Check if there were any errors
        if len(c.Errors) > 0 {
            // Get the last error
            err := c.Errors.Last().Err

            // Convert to ServiceError if it's not already
            var svcErr *errors.ServiceError
            if e, ok := err.(*errors.ServiceError); ok {
                svcErr = e
            } else {
                // Default to internal server error for unknown errors
                svcErr = errors.InternalServerError(err.Error())
            }

            // Add help URL if not set
            if svcErr.HelpURL == "" {
                svcErr.HelpURL = fmt.Sprintf("https://docs.service-layer.io/errors/%s", svcErr.Code)
            }

            // Respond with error
            c.JSON(svcErr.HTTPStatus, gin.H{
                "success": false,
                "error": svcErr,
            })
            c.Abort()
        }
    }
}
```

## Centralized Error Documentation

We will create comprehensive error documentation:

1. **Error Catalog**: A centralized catalog of all error codes with explanations and solutions
2. **Error Help Pages**: Individual help pages for each error code with detailed troubleshooting steps
3. **API Reference Integration**: Error examples in the API documentation

## Implementation Plan

### Phase 1: Error Types and Basic Implementation

1. Define core error types
2. Implement base error struct and methods
3. Create factory functions for common errors
4. Add middleware for consistent API responses

### Phase 2: Service-Specific Errors

1. Implement function-specific errors
2. Implement blockchain-specific errors
3. Implement authentication-specific errors
4. Implement other service-specific errors

### Phase 3: Documentation and Tooling

1. Create error code catalog
2. Implement help URL generation
3. Add error examples to API documentation
4. Create error handling guidelines for developers

### Phase 4: Advanced Features

1. Add request ID correlation
2. Implement structured logging for errors
3. Create error reporting and analytics
4. Implement error rate monitoring and alerting