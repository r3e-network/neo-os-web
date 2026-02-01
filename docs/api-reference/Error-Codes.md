# Error Codes

> Comprehensive error codes and handling guide

## Error Response Format

All API errors follow a consistent format:

```json
{
    "success": false,
    "error": {
        "code": "AUTH_INVALID_KEY",
        "message": "Invalid API key",
        "details": {
            "field": "authorization",
            "hint": "Check that your API key is correct"
        }
    },
    "request_id": "req_abc123"
}
```

## HTTP Status Codes

| Status | Meaning               | When Used                |
| ------ | --------------------- | ------------------------ |
| 200    | OK                    | Successful request       |
| 400    | Bad Request           | Invalid parameters       |
| 401    | Unauthorized          | Missing/invalid auth     |
| 403    | Forbidden             | Insufficient permissions |
| 404    | Not Found             | Resource doesn't exist   |
| 429    | Too Many Requests     | Rate limit exceeded      |
| 500    | Internal Server Error | Server-side error        |
| 503    | Service Unavailable   | Service temporarily down |

## Authentication Errors (1xxx)

| Code | Message                  | Solution     |
| ---- | ------------------------ | ------------ |
| 1001 | Invalid API key          | Check key    |
| 1002 | Key expired              | Rotate key   |
| 1003 | Insufficient permissions | Update scope |

## Rate Limit Errors (2xxx)

| Code | Message              | Solution       |
| ---- | -------------------- | -------------- |
| 2001 | Rate limit exceeded  | Wait and retry |
| 2002 | Daily quota exceeded | Upgrade plan   |

## Validation Errors (3xxx)

| Code | Message                | Solution    |
| ---- | ---------------------- | ----------- |
| 3001 | Invalid parameter      | Check input |
| 3002 | Missing required field | Add field   |

## Service Errors (5xxx)

| Code | Message             | Solution           |
| ---- | ------------------- | ------------------ |
| 5001 | Service unavailable | Retry later        |
| 5002 | Timeout             | Retry with backoff |

## Next Steps

- [Rate Limits](./Rate-Limits.md)

## Error Handling Example

```typescript
async function apiCall(endpoint: string) {
    try {
        const response = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
            const error = await response.json();
            handleError(error);
            return;
        }

        return await response.json();
    } catch (e) {
        console.error("Network error:", e);
    }
}

function handleError(error: ApiError) {
    switch (error.error.code) {
        case "AUTH_INVALID_KEY":
            // Re-authenticate
            break;
        case "RATE_LIMIT_EXCEEDED":
            // Wait and retry
            break;
        case "SERVICE_UNAVAILABLE":
            // Retry with backoff
            break;
        default:
            console.error("Unknown error:", error);
    }
}
```
