# Rate Limiting Implementation

This document describes the rate limiting implementation for the Service Layer API.

## Overview

Rate limiting is a critical security feature that protects the API from abuse, denial-of-service attacks, and ensures fair usage. Our implementation uses a token bucket algorithm that allows for flexible rate limiting based on client identity (IP address, API key, or user ID).

## Configuration

Rate limiting is configured in the `config.yaml` file under the `server.rate_limit` section:

```yaml
server:
  rate_limit:
    enabled: true
    requests_per_ip: 100     # Rate limit for IP-based clients (per minute)
    requests_per_key: 1000   # Rate limit for API key-based clients (per minute)
    burst_ip: 20             # Burst capacity for IP-based clients
    burst_key: 100           # Burst capacity for API key-based clients
    time_window_sec: 60      # Time window in seconds
```

## Implementation Details

The rate limiter uses a dynamic approach that applies different limits based on client identity:

1. For authenticated users, the rate limit is based on the user ID and uses the `requests_per_key` and `burst_key` settings.
2. For clients with API keys, the rate limit is based on the API key and uses the `requests_per_key` and `burst_key` settings.
3. For unauthenticated clients, the rate limit is based on the IP address and uses the `requests_per_ip` and `burst_ip` settings.

The implementation uses the token bucket algorithm from the `golang.org/x/time/rate` package, which provides:

- Smooth rate limiting over time
- Ability to handle burst traffic
- Efficient memory usage by cleaning up unused buckets

## Response Headers

The rate limiter adds the following headers to API responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the time window
- `X-RateLimit-Remaining`: Number of requests remaining in the current time window
- `X-RateLimit-Reset`: Time when the rate limit will reset (Unix timestamp)

## Error Response

When a client exceeds the rate limit, the API returns a 429 (Too Many Requests) response with a JSON error:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 100,
      "reset_in_seconds": 30
    }
  }
}
```

## Metrics

The rate limiter collects the following metrics for monitoring:

- `rate_limit_exceeded_total`: Counter of rate limit exceeded events
- `rate_limit_remaining`: Gauge of remaining tokens for key rate limiters

## Future Improvements

Planned improvements to the rate limiting system:

1. **API Key Rotation**: Implement automatic rotation of API keys to enhance security
2. **Rate Limit by Endpoint**: Apply different rate limits based on endpoint sensitivity
3. **Rate Limit Override**: Allow for dynamic adjustment of rate limits for specific users