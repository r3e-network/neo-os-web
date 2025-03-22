# Functions Service API Specification

## Overview
The Functions Service API allows users to create, manage, and execute JavaScript functions within the TEE environment.

## Function Object Schema

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "source_code": "string",
  "version": "integer",
  "created_at": "datetime",
  "updated_at": "datetime",
  "status": "string", // "active", "inactive", "error"
  "secrets": ["string"], // List of secret names used by this function
  "timeout": "integer", // Maximum execution time in seconds
  "memory": "integer", // Memory limit in MB
  "execution_count": "integer", // Number of times this function has been executed
  "last_execution": "datetime" // Time of the last execution
}
```

## Function Execution Result Schema

```json
{
  "execution_id": "string",
  "function_id": "string",
  "status": "string", // "success", "error"
  "start_time": "datetime",
  "end_time": "datetime",
  "duration": "integer", // milliseconds
  "result": "any", // Function return value
  "error": "string", // Error message if status is "error"
  "logs": ["string"] // Function console logs
}
```

## Endpoints

### List Functions

```
GET /v1/functions
```

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status ("active", "inactive", "error")
- `search`: Search by name or description

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "func_123abc",
      "name": "Calculate Average Price",
      "description": "Calculates average token price from multiple sources",
      "version": 1,
      "created_at": "2023-05-01T10:00:00Z",
      "updated_at": "2023-05-01T10:00:00Z",
      "status": "active",
      "execution_count": 150,
      "last_execution": "2023-05-10T15:30:00Z"
    },
    // ...
  ],
  "pagination": {
    "total": 35,
    "page": 1,
    "limit": 20,
    "pages": 2
  },
  "error": null
}
```

### Get Function Details

```
GET /v1/functions/{id}
```

Path Parameters:
- `id`: Function ID

Response:
```json
{
  "success": true,
  "data": {
    "id": "func_123abc",
    "name": "Calculate Average Price",
    "description": "Calculates average token price from multiple sources",
    "source_code": "function calculate(sources) { /* ... */ }",
    "version": 1,
    "created_at": "2023-05-01T10:00:00Z",
    "updated_at": "2023-05-01T10:00:00Z",
    "status": "active",
    "secrets": ["api_key1", "api_key2"],
    "timeout": 30,
    "memory": 128,
    "execution_count": 150,
    "last_execution": "2023-05-10T15:30:00Z"
  },
  "error": null
}
```

### Create Function

```
POST /v1/functions
```

Request Body:
```json
{
  "name": "Calculate Average Price",
  "description": "Calculates average token price from multiple sources",
  "source_code": "function calculate(sources) { /* ... */ }",
  "secrets": ["api_key1", "api_key2"],
  "timeout": 30,
  "memory": 128
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "func_123abc",
    "name": "Calculate Average Price",
    "description": "Calculates average token price from multiple sources",
    "source_code": "function calculate(sources) { /* ... */ }",
    "version": 1,
    "created_at": "2023-05-01T10:00:00Z",
    "updated_at": "2023-05-01T10:00:00Z",
    "status": "active",
    "secrets": ["api_key1", "api_key2"],
    "timeout": 30,
    "memory": 128,
    "execution_count": 0,
    "last_execution": null
  },
  "error": null
}
```

### Update Function

```
PUT /v1/functions/{id}
```

Path Parameters:
- `id`: Function ID

Request Body:
```json
{
  "name": "Calculate Average Price",
  "description": "Calculates average token price from multiple sources with weighted algorithm",
  "source_code": "function calculate(sources) { /* ... updated code ... */ }",
  "secrets": ["api_key1", "api_key2", "api_key3"],
  "timeout": 60,
  "memory": 256
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "func_123abc",
    "name": "Calculate Average Price",
    "description": "Calculates average token price from multiple sources with weighted algorithm",
    "source_code": "function calculate(sources) { /* ... updated code ... */ }",
    "version": 2,
    "created_at": "2023-05-01T10:00:00Z",
    "updated_at": "2023-05-15T14:30:00Z",
    "status": "active",
    "secrets": ["api_key1", "api_key2", "api_key3"],
    "timeout": 60,
    "memory": 256,
    "execution_count": 150,
    "last_execution": "2023-05-10T15:30:00Z"
  },
  "error": null
}
```

### Delete Function

```
DELETE /v1/functions/{id}
```

Path Parameters:
- `id`: Function ID

Response:
```json
{
  "success": true,
  "data": {
    "id": "func_123abc",
    "deleted": true
  },
  "error": null
}
```

### Execute Function

```
POST /v1/functions/{id}/execute
```

Path Parameters:
- `id`: Function ID

Request Body:
```json
{
  "params": {
    "token": "NEO",
    "sources": ["source1", "source2"]
  },
  "async": false
}
```

Response (synchronous execution):
```json
{
  "success": true,
  "data": {
    "execution_id": "exec_456def",
    "function_id": "func_123abc",
    "status": "success",
    "start_time": "2023-05-15T15:00:00Z",
    "end_time": "2023-05-15T15:00:02Z",
    "duration": 2000,
    "result": {
      "average_price": 42.5,
      "sources_used": 2
    },
    "logs": [
      "Processing source1: 40",
      "Processing source2: 45"
    ]
  },
  "error": null
}
```

Response (asynchronous execution):
```json
{
  "success": true,
  "data": {
    "execution_id": "exec_456def",
    "function_id": "func_123abc",
    "status": "running"
  },
  "error": null
}
```

### Get Function Execution Status

```
GET /v1/functions/executions/{execution_id}
```

Path Parameters:
- `execution_id`: Execution ID

Response:
```json
{
  "success": true,
  "data": {
    "execution_id": "exec_456def",
    "function_id": "func_123abc",
    "status": "success",
    "start_time": "2023-05-15T15:00:00Z",
    "end_time": "2023-05-15T15:00:02Z",
    "duration": 2000,
    "result": {
      "average_price": 42.5,
      "sources_used": 2
    },
    "logs": [
      "Processing source1: 40",
      "Processing source2: 45"
    ]
  },
  "error": null
}
```

### Get Function Execution History

```
GET /v1/functions/{id}/executions
```

Path Parameters:
- `id`: Function ID

Query Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: Filter by status ("success", "error", "running")
- `start_date`: Filter by start date (ISO 8601)
- `end_date`: Filter by end date (ISO 8601)

Response:
```json
{
  "success": true,
  "data": [
    {
      "execution_id": "exec_456def",
      "function_id": "func_123abc",
      "status": "success",
      "start_time": "2023-05-15T15:00:00Z",
      "end_time": "2023-05-15T15:00:02Z",
      "duration": 2000,
      "result": {
        "average_price": 42.5,
        "sources_used": 2
      }
    },
    // ...
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  },
  "error": null
}
```

### Get Function Logs

```
GET /v1/functions/{id}/logs
```

Path Parameters:
- `id`: Function ID

Query Parameters:
- `execution_id`: Filter by execution ID
- `start_date`: Filter by start date (ISO 8601)
- `end_date`: Filter by end date (ISO 8601)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 100, max: 1000)

Response:
```json
{
  "success": true,
  "data": {
    "function_id": "func_123abc",
    "logs": [
      {
        "execution_id": "exec_456def",
        "timestamp": "2023-05-15T15:00:01Z",
        "level": "info",
        "message": "Processing source1: 40"
      },
      {
        "execution_id": "exec_456def",
        "timestamp": "2023-05-15T15:00:01Z",
        "level": "info",
        "message": "Processing source2: 45"
      },
      // ...
    ]
  },
  "pagination": {
    "total": 300,
    "page": 1,
    "limit": 100,
    "pages": 3
  },
  "error": null
}
```

## Error Codes

- `FUNCTION_NOT_FOUND`: The specified function does not exist
- `EXECUTION_NOT_FOUND`: The specified execution does not exist
- `VALIDATION_ERROR`: The request validation failed
- `SYNTAX_ERROR`: The function source code has syntax errors
- `EXECUTION_TIMEOUT`: The function execution timed out
- `MEMORY_EXCEEDED`: The function exceeded its memory limit
- `SECRET_NOT_FOUND`: A required secret was not found
- `PERMISSION_DENIED`: The user does not have permission for this operation
- `INTERNAL_ERROR`: An internal server error occurred