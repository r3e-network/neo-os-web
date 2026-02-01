# Rate Limits

> API rate limiting and quota management

## Overview

Rate limits protect the platform from abuse and ensure fair usage across all applications. Limits are applied at multiple levels for comprehensive protection.

### Rate Limit Levels

| Level       | Scope              | Purpose                    |
| ----------- | ------------------ | -------------------------- |
| **Global**  | Per IP address     | DDoS protection            |
| **API Key** | Per API key        | Fair usage per application |
| **User**    | Per wallet address | Per-user quotas            |

## Limit Tiers

| Tier       | Requests/min | Daily Quota | Burst  |
| ---------- | ------------ | ----------- | ------ |
| Free       | 60           | 1,000       | 10     |
| Developer  | 300          | 10,000      | 50     |
| Production | 1,000        | 100,000     | 200    |
| Enterprise | Custom       | Custom      | Custom |

## Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1704931200
X-RateLimit-Retry-After: 60
```

| Header                  | Description                    |
| ----------------------- | ------------------------------ |
| X-RateLimit-Limit       | Max requests per window        |
| X-RateLimit-Remaining   | Requests left in window        |
| X-RateLimit-Reset       | Unix timestamp of window reset |
| X-RateLimit-Retry-After | Seconds until retry allowed    |

## Endpoint-Specific Limits

Some endpoints have additional limits:

| Endpoint      | Limit  | Window |
| ------------- | ------ | ------ |
| `/random`     | 10/min | 1 min  |
| `/payments`   | 30/min | 1 min  |
| `/governance` | 5/min  | 1 min  |
| `/secrets`    | 20/min | 1 min  |

## Handling Rate Limits

### Retry Strategy

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        const response = await fetch(url, options);

        if (response.status === 429) {
            const retryAfter = response.headers.get("X-RateLimit-Retry-After");
            await sleep(parseInt(retryAfter) * 1000);
            continue;
        }

        return response;
    }
    throw new Error("Max retries exceeded");
}
```

### Exponential Backoff

```javascript
async function exponentialBackoff(fn, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.status !== 429) throw error;
            const delay = Math.pow(2, i) * 1000;
            await sleep(delay);
        }
    }
}
```

## Best Practices

1. **Cache responses** - Reduce unnecessary requests
2. **Batch operations** - Combine multiple requests
3. **Monitor headers** - Track remaining quota
4. **Implement backoff** - Handle 429 gracefully
5. **Use webhooks** - For real-time updates instead of polling

## Quota Management

Check your current quota:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.neo.org/v1/quota
```

Response:

```json
{
    "tier": "developer",
    "requests": {
        "used": 150,
        "limit": 300,
        "reset": "2026-01-11T01:00:00Z"
    },
    "daily": {
        "used": 5000,
        "limit": 10000,
        "reset": "2026-01-12T00:00:00Z"
    }
}
```

## Next Steps

- [Error Codes](./Error-Codes.md)
- [REST API](./REST-API.md)
