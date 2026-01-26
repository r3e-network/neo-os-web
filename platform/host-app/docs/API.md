# API Documentation

## Overview

Neo MiniApp Platform API provides RESTful endpoints for managing MiniApps, user data, and platform features. All responses are in JSON format.

## Base URL

**Production:** `https://miniapp.neo.org/api`
**Testnet:** `https://testnet.miniapp.neo.org/api`
**Development:** `http://localhost:3000/api`

## Authentication

Most endpoints require a wallet address for user identification. Pass the wallet address as a query parameter:

```
?wallet=NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq
```

For protected endpoints, include the Authorization header:

```
Authorization: Bearer <api_token>
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable error message"
    }
}
```

## Error Codes

| Code             | HTTP Status | Description                       |
| ---------------- | ----------- | --------------------------------- |
| `INVALID_WALLET` | 400         | Invalid wallet address format     |
| `NOT_FOUND`      | 404         | Resource not found                |
| `UNAUTHORIZED`   | 401         | Missing or invalid authentication |
| `FORBIDDEN`      | 403         | Insufficient permissions          |
| `RATE_LIMITED`   | 429         | Too many requests                 |
| `SERVER_ERROR`   | 500         | Internal server error             |

---

## Endpoints

### Collections

Manage user's saved MiniApp collections.

#### Get User Collections

```http
GET /api/collections?wallet={address}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "collections": [
            {
                "app_id": "miniapp-lottery",
                "added_at": "2024-01-15T10:30:00Z"
            }
        ]
    }
}
```

#### Add to Collection

```http
POST /api/collections
Content-Type: application/json

{
  "wallet": "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
  "app_id": "miniapp-lottery"
}
```

#### Remove from Collection

```http
DELETE /api/collections/{appId}?wallet={address}
```

---

### Preferences

Manage user preferences and settings.

#### Get Preferences

```http
GET /api/preferences?wallet={address}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "theme": "dark",
        "locale": "en",
        "notifications": true
    }
}
```

#### Update Preferences

```http
PUT /api/preferences?wallet={address}
Content-Type: application/json

{
  "theme": "light",
  "locale": "zh"
}
```

---

### Versions

Manage MiniApp version history.

#### Get App Versions

```http
GET /api/versions/{appId}
```

**Response:**

```json
{
    "success": true,
    "data": {
        "versions": [
            {
                "version": "1.2.0",
                "released_at": "2024-01-10T00:00:00Z",
                "changelog": "Bug fixes and performance improvements"
            }
        ]
    }
}
```

---

### Reports

Generate and retrieve usage reports.

#### Get Usage Reports

```http
GET /api/reports?wallet={address}&period={day|week|month}
```

#### Generate Report

```http
POST /api/reports?wallet={address}
Content-Type: application/json

{
  "type": "usage",
  "period": "month"
}
```

---

### Rankings

Get MiniApp rankings and leaderboards.

#### Get Rankings

```http
GET /api/rankings?type={hot|new|trending}&limit={number}
```

**Parameters:**

- `type` - Ranking type: `hot`, `new`, or `trending`
- `limit` - Number of results (default: 20, max: 100)

**Response:**

```json
{
    "success": true,
    "data": {
        "rankings": [
            {
                "rank": 1,
                "app_id": "miniapp-lottery",
                "name": "Neo Lottery",
                "score": 9850
            }
        ]
    }
}
```

---

## Rate Limiting

API requests are rate limited to ensure fair usage:

- **Anonymous:** 60 requests/minute
- **Authenticated:** 300 requests/minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1704067200
```

## SDK Integration

For MiniApp developers, use the official SDK:

```typescript
import { waitForSDK } from "@r3e/uniapp-sdk";

const sdk = await waitForSDK();

// Access platform services
const price = await sdk.datafeed.getPrice("NEO");
```

See [SDK Documentation](/docs/SDK.md) for more details.
