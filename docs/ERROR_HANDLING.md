# Error Handling Strategy

This document outlines the error handling strategy for the Neo N3 Service Layer.

## Overview

The Service Layer implements a structured error handling approach with consistent error types, error codes, and detailed error messages. This ensures that errors are:

1. **Informative**: Errors provide clear information about what went wrong.
2. **Actionable**: Errors suggest possible solutions or next steps.
3. **Consistent**: Errors follow a consistent format across all services.
4. **Traceable**: Errors include context that helps with debugging.
5. **Secure**: Errors don't leak sensitive information.

## Error Structure

All API responses follow a consistent structure for error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Specific field that caused the error (if applicable)",
      "reason": "Detailed reason for the error"
    },
    "requestId": "unique-request-id"
  }
}
```

- **code**: A unique string identifier for the error type
- **message**: A human-readable description of the error
- **details**: Additional information about the error (optional)
- **requestId**: A unique identifier for the request to help with troubleshooting

## Error Categories

Errors are categorized into different types based on their nature:

### 1. Input Validation Errors (400 Bad Request)

Errors related to invalid input from the client:

- **INVALID_PARAMETER**: A request parameter has an invalid value
- **MISSING_PARAMETER**: A required parameter is missing
- **INVALID_FORMAT**: The format of a parameter is invalid (e.g., JSON syntax error)
- **INVALID_STATE**: The request is invalid in the current state

### 2. Authentication and Authorization Errors (401/403)

Errors related to authentication and authorization:

- **UNAUTHORIZED**: Authentication is required
- **INVALID_CREDENTIALS**: Invalid credentials provided
- **TOKEN_EXPIRED**: The authentication token has expired
- **PERMISSION_DENIED**: The user doesn't have permission to perform the action

### 3. Resource Errors (404/409)

Errors related to resources:

- **RESOURCE_NOT_FOUND**: The requested resource was not found
- **RESOURCE_ALREADY_EXISTS**: Attempt to create a resource that already exists
- **RESOURCE_CONFLICT**: Conflict with the current state of the resource

### 4. Service Errors (500/503)

Internal server errors:

- **INTERNAL_ERROR**: Generic internal server error
- **DATABASE_ERROR**: Error communicating with the database
- **BLOCKCHAIN_ERROR**: Error communicating with the blockchain
- **SERVICE_UNAVAILABLE**: The service is temporarily unavailable
- **RATE_LIMIT_EXCEEDED**: Too many requests
- **API_DEPRECATED**: The API version is deprecated and will be sunset
- **API_VERSION_UNSUPPORTED**: The requested API version is not supported

### 5. TEE-Specific Errors

Errors specific to the TEE environment:

- **EXECUTION_TIMEOUT**: Function execution timed out
- **MEMORY_LIMIT_EXCEEDED**: Function exceeded memory limit
- **SANDBOX_VIOLATION**: Function attempted to violate the sandbox
- **SECRET_ACCESS_DENIED**: Function attempted to access unauthorized secrets
- **FUNCTION_COMPILE_ERROR**: Function code failed to compile
- **FUNCTION_RUNTIME_ERROR**: Function execution failed at runtime

### 6. Blockchain-Specific Errors

Errors specific to blockchain operations:

- **TX_VERIFICATION_FAILED**: Transaction verification failed
- **CONTRACT_EXECUTION_FAILED**: Smart contract execution failed
- **INSUFFICIENT_GAS**: Insufficient gas for transaction
- **NETWORK_FEE_TOO_LOW**: Network fee is too low

## Implementation Details

### Error Types in Go

Error types are defined in the `pkg/errors` package. Each error type implements the standard `error` interface and includes additional fields.

```go
type ServiceError struct {
    Code     string
    Message  string
    Details  map[string]interface{}
    HTTPCode int
}
```

### Error Handling in API Handlers

API handlers should:

1. Validate input parameters early
2. Catch all errors and convert them to appropriate `ServiceError` types
3. Log detailed error information for internal debugging
4. Return consistent error responses to clients

### Error Logging

Error logging follows a consistent pattern with contextual information:

```go
logger.WithFields(log.Fields{
    "component": "function-service",
    "operation": "ExecuteFunction",
    "functionId": functionID,
    "requestId": requestID,
}).Error("Failed to execute function: " + err.Error())
```

### Client Error Handling

Clients should be prepared to handle all defined error types. Client libraries should:

1. Parse error responses into appropriate error types
2. Provide helper methods for common error handling scenarios (e.g., retrying on certain errors)
3. Include request IDs in error messages to help with troubleshooting

## Error Code Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PARAMETER` | 400 | A request parameter has an invalid value |
| `MISSING_PARAMETER` | 400 | A required parameter is missing |
| `INVALID_FORMAT` | 400 | The format of a parameter is invalid |
| `INVALID_STATE` | 400 | The request is invalid in the current state |
| `UNAUTHORIZED` | 401 | Authentication is required |
| `INVALID_CREDENTIALS` | 401 | Invalid credentials provided |
| `TOKEN_EXPIRED` | 401 | The authentication token has expired |
| `PERMISSION_DENIED` | 403 | The user doesn't have permission to perform the action |
| `RESOURCE_NOT_FOUND` | 404 | The requested resource was not found |
| `RESOURCE_ALREADY_EXISTS` | 409 | Attempt to create a resource that already exists |
| `RESOURCE_CONFLICT` | 409 | Conflict with the current state of the resource |
| `INTERNAL_ERROR` | 500 | Generic internal server error |
| `DATABASE_ERROR` | 500 | Error communicating with the database |
| `BLOCKCHAIN_ERROR` | 500 | Error communicating with the blockchain |
| `SERVICE_UNAVAILABLE` | 503 | The service is temporarily unavailable |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `API_DEPRECATED` | 400 | The API version is deprecated and will be sunset |
| `API_VERSION_UNSUPPORTED` | 400 | The requested API version is not supported |
| `EXECUTION_TIMEOUT` | 408 | Function execution timed out |
| `MEMORY_LIMIT_EXCEEDED` | 400 | Function exceeded memory limit |
| `SANDBOX_VIOLATION` | 400 | Function attempted to violate the sandbox |
| `SECRET_ACCESS_DENIED` | 403 | Function attempted to access unauthorized secrets |
| `FUNCTION_COMPILE_ERROR` | 400 | Function code failed to compile |
| `FUNCTION_RUNTIME_ERROR` | 500 | Function execution failed at runtime |
| `TX_VERIFICATION_FAILED` | 400 | Transaction verification failed |
| `CONTRACT_EXECUTION_FAILED` | 400 | Smart contract execution failed |
| `INSUFFICIENT_GAS` | 400 | Insufficient gas for transaction |
| `NETWORK_FEE_TOO_LOW` | 400 | Network fee is too low | 