# Error Handling Middleware

This document describes how to use the error handling middleware in the Service Layer.

## Overview

The Service Layer includes middleware components that provide consistent error handling across all API endpoints. These middleware components:

1. Standardize error response format
2. Capture and convert errors to `ServiceError` types
3. Add request IDs for correlation
4. Log errors with contextual information
5. Handle validation errors

## Available Middleware

### ErrorHandler

The `ErrorHandler` middleware captures errors from gin's error chain, converts them to `ServiceError` types, adds request IDs, logs errors, and sends standardized error responses to clients.

### ValidationErrorHandler

The `ValidationErrorHandler` middleware specifically handles validation errors that occur during request binding. It's designed to work with validators like go-playground/validator.

### RequestLogger

The `RequestLogger` middleware logs all incoming requests and their responses with contextual information including:
- Request ID
- HTTP method
- Path
- Query parameters
- Client IP
- User agent
- Response status
- Response size
- Request duration

## Implementation

### Registering Middleware

To use these middleware components, register them with your Gin router:

```go
import (
    "github.com/R3E-Network/service_layer/pkg/middleware"
    "github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
    r := gin.New()
    
    // Register middleware
    r.Use(middleware.RequestLogger())
    r.Use(middleware.ValidationErrorHandler())
    r.Use(middleware.ErrorHandler())
    
    // Define routes...
    
    return r
}
```

### Error Handling in Routes

With the middleware in place, you can use the `ServiceError` types from the `pkg/errors` package to return standardized errors:

```go
import (
    "github.com/R3E-Network/service_layer/pkg/errors"
    "github.com/gin-gonic/gin"
)

func GetUserHandler(c *gin.Context) {
    userID := c.Param("id")
    
    user, err := userService.GetUser(userID)
    if err != nil {
        // If user not found, return a not found error
        if err == userService.ErrUserNotFound {
            c.Error(errors.NewResourceNotFoundError("User", userID))
            return
        }
        
        // For other errors, return an internal error
        c.Error(errors.NewInternalError("Failed to retrieve user"))
        return
    }
    
    c.JSON(200, user)
}
```

### Adding Custom Details to Errors

You can add custom details to errors for additional context:

```go
func ValidateUserHandler(c *gin.Context) {
    var user User
    if err := c.ShouldBindJSON(&user); err != nil {
        validationErr := errors.NewInvalidFormatError("Invalid user data format")
        validationErr.WithDetailField("validationError", err.Error())
        c.Error(validationErr)
        return
    }
    
    // Proceed with valid user...
}
```

## Error Response Format

When an error occurs, the middleware will send a standardized JSON response:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User not found: 123",
    "details": {
      "resourceType": "User",
      "resourceId": "123"
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Request ID Handling

Request IDs are used for correlation across logs and responses. The middleware:

1. Looks for an existing request ID in the `X-Request-ID` header
2. If not found, generates a new UUID 
3. Includes this ID in response headers
4. Adds the ID to error responses and logs

This enables tracing requests through the system for debugging and monitoring.

## Logging

Errors are logged with contextual information to help with debugging:

- Request ID
- Error code
- HTTP status
- Client IP
- Method
- Path
- Query parameters
- User ID (if available)
- Error details

Errors with status codes >= 500 are logged at ERROR level, while client errors (400-level) are logged at INFO level.

## Best Practices

1. **Use Typed Errors**: Always use the appropriate error type from `pkg/errors` package rather than returning generic errors.

2. **Add Context**: Include relevant details when creating errors to help with debugging and provide better information to API consumers.

3. **Be Secure**: Don't include sensitive information in error messages or details that are returned to clients.

4. **Consistent Status Codes**: Let the `ServiceError` types handle the appropriate HTTP status codes rather than setting them manually.

5. **Early Validation**: Validate input parameters early in request handling to fail fast and reduce unnecessary processing. 