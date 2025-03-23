# Service Layer API Documentation

This directory contains the OpenAPI (Swagger) documentation for the Service Layer API.

## Overview

The Service Layer API provides access to all services:

- **Authentication**: User management and authentication
- **Functions**: JavaScript function execution in TEE
- **Secrets**: Secure secret management with envelope encryption
- **Gas Bank**: Gas management for blockchain operations
- **Automation**: Automated task execution and triggers
- **Oracle**: External data integration
- **Price Feed**: Blockchain price feed service
- **System**: System status and monitoring

## Files

- `openapi.yaml`: Complete OpenAPI specification that combines all service endpoints
- `auth_endpoints.yaml`: Authentication service endpoints
- `functions_endpoints.yaml`: Functions service endpoints
- `secrets_endpoints.yaml`: Secret Management service endpoints

## Using the API Documentation

### Online Documentation

The API documentation is available at:

- Production: `https://api.service-layer.io/docs`
- Staging: `https://staging-api.service-layer.io/docs`
- Local development: `http://localhost:8080/docs`

### Generating Documentation

You can generate a static HTML version of the documentation using:

```bash
npm install -g redoc-cli
redoc-cli bundle openapi.yaml -o api-docs.html
```

Or using Swagger UI:

```bash
docker run -p 8082:8080 -e SWAGGER_JSON=/api/openapi.yaml -v $(pwd):/api swaggerapi/swagger-ui
```

Then browse to `http://localhost:8082`

## Authentication

The API supports two authentication methods:

1. **JWT Bearer Token**: Obtain a token by calling `/auth/login` and include it in the `Authorization` header:
   ```
   Authorization: Bearer <your-token>
   ```

2. **API Key**: Include your API key in the `X-API-Key` header:
   ```
   X-API-Key: <your-api-key>
   ```

## Error Handling

All API endpoints use a consistent error format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Resource created
- `400`: Bad request (invalid input)
- `401`: Unauthorized (authentication failed)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `409`: Conflict (resource already exists)
- `429`: Too many requests (rate limit exceeded)
- `500`: Internal server error

## Rate Limiting

API requests are subject to rate limiting:
- Authentication endpoints: 10 requests per minute
- Other endpoints: 60 requests per minute for authenticated users

Rate limit headers are included in API responses:
- `X-RateLimit-Limit`: Maximum requests allowed in the current period
- `X-RateLimit-Remaining`: Remaining requests in the current period
- `X-RateLimit-Reset`: Time when the rate limit will reset (Unix timestamp)

## Examples

### Authentication

```bash
# Login
curl -X POST https://api.service-layer.io/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username_or_email": "user@example.com", "password": "password123"}'

# Response
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

### Creating a Function

```bash
# Create function
curl -X POST https://api.service-layer.io/v1/functions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calculator",
    "description": "Simple calculator function",
    "source_code": "function main(params) { return { result: params.a + params.b }; }",
    "secrets_access": []
  }'

# Response
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 42,
    "name": "calculator",
    "description": "Simple calculator function",
    "source_code": "function main(params) { return { result: params.a + params.b }; }",
    "secrets_access": [],
    "trigger_type": "manual",
    "created_at": "2023-08-15T12:34:56Z",
    "updated_at": "2023-08-15T12:34:56Z"
  }
}
```

### Executing a Function

```bash
# Execute function
curl -X POST https://api.service-layer.io/v1/functions/1/execute \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "a": 5,
      "b": 10
    }
  }'

# Response
{
  "success": true,
  "data": {
    "result": 15,
    "duration": 45
  }
}
```