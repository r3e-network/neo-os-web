# Neo N3 Service Layer API Overview

## Introduction
This document outlines the RESTful API for the Neo N3 Service Layer, providing access to functions execution, secrets management, contract automation, price feeds, and more.

## API Conventions

### Base URL
```
https://api.servicelayer.neo.org/v1
```

### Authentication
All API requests require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer {token}
```

### Request Format
All requests should be in JSON format with the appropriate Content-Type header:

```
Content-Type: application/json
```

### Response Format
All responses will be in JSON format with the following structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Or in case of an error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

### Pagination
For endpoints that return lists, pagination is supported with the following query parameters:

- `page`: Page number (starts at 1)
- `limit`: Number of items per page (default 20, max 100)

Response includes pagination metadata:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  },
  "error": null
}
```

## API Endpoints Summary

### Authentication
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh authentication token

### Functions
- `GET /functions` - List all functions
- `GET /functions/{id}` - Get function details
- `POST /functions` - Create a new function
- `PUT /functions/{id}` - Update a function
- `DELETE /functions/{id}` - Delete a function
- `POST /functions/{id}/execute` - Execute a function immediately
- `GET /functions/{id}/logs` - Get function execution logs

### Secrets
- `GET /secrets` - List all secrets (names only)
- `GET /secrets/{name}` - Get secret metadata (not the value)
- `POST /secrets` - Create a new secret
- `PUT /secrets/{name}` - Update a secret
- `DELETE /secrets/{name}` - Delete a secret

### Contract Automation
- `GET /triggers` - List all triggers
- `GET /triggers/{id}` - Get trigger details
- `POST /triggers` - Create a new trigger
- `PUT /triggers/{id}` - Update a trigger
- `DELETE /triggers/{id}` - Delete a trigger
- `GET /triggers/{id}/history` - Get trigger execution history

### Gas Bank
- `GET /gasbank/balance` - Get gas balance
- `POST /gasbank/deposit` - Deposit gas
- `POST /gasbank/withdraw` - Withdraw gas
- `GET /gasbank/transactions` - Get transaction history

### Price Feed
- `GET /pricefeeds` - List all price feeds
- `GET /pricefeeds/{id}` - Get price feed details
- `POST /pricefeeds` - Create a new price feed
- `PUT /pricefeeds/{id}` - Update a price feed
- `DELETE /pricefeeds/{id}` - Delete a price feed
- `GET /pricefeeds/{id}/history` - Get price history

### Random Number
- `POST /random` - Generate a random number
- `GET /random/{id}` - Get random number details
- `GET /random/{id}/verify` - Get verification proof

### Oracle
- `GET /oracles` - List all oracle configurations
- `GET /oracles/{id}` - Get oracle configuration details
- `POST /oracles` - Create a new oracle configuration
- `PUT /oracles/{id}` - Update an oracle configuration
- `DELETE /oracles/{id}` - Delete an oracle configuration
- `GET /oracles/{id}/data` - Get latest oracle data

### System
- `GET /health` - Service health check
- `GET /metrics` - Service metrics (admin only)

## Rate Limits
The API enforces rate limits to ensure fair usage:

- Authentication endpoints: 10 requests per minute
- Read endpoints: 60 requests per minute
- Write endpoints: 30 requests per minute
- Execute endpoints: 20 requests per minute

Exceeding these limits will result in a 429 Too Many Requests response.