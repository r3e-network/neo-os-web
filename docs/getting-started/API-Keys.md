# API Keys

> Managing API keys and credentials for the Neo Service Layer

## Overview

API keys authenticate server-side applications with the Neo Service Layer. They provide:

| Feature         | Description                        |
| --------------- | ---------------------------------- |
| **Identity**    | Uniquely identify your application |
| **Rate Limits** | Per-key quotas and throttling      |
| **Audit Trail** | Complete request logging           |
| **Permissions** | Granular access control            |
| **Analytics**   | Usage metrics and monitoring       |

## Key Format

API keys follow a structured format:

```
sk_[environment]_[random_string]

Examples:
- sk_live_a1b2c3d4e5f6g7h8i9j0    (Production)
- sk_test_x9y8z7w6v5u4t3s2r1q0    (Development)
```

| Prefix    | Environment | Description             |
| --------- | ----------- | ----------------------- |
| `sk_live` | Production  | Real transactions       |
| `sk_test` | Development | Sandbox, no real assets |

## Key Types

| Type            | Use Case              | Rate Limit   |
| --------------- | --------------------- | ------------ |
| **Development** | Testing & development | 100 req/min  |
| **Production**  | Live applications     | 1000 req/min |
| **Enterprise**  | High-volume apps      | Custom       |

## Creating API Keys

### Via Dashboard

1. Log in to [dashboard.neo.org](https://dashboard.neo.org)
2. Navigate to **Settings** → **API Keys**
3. Click **Create New Key**
4. Select key type and permissions
5. Copy and securely store your key

### Via CLI

```bash
neo-cli api-key create --name "my-app" --type production
```

## Using API Keys

### HTTP Header

```bash
curl -X GET "https://api.neo.org/v1/feeds" \
  -H "Authorization: Bearer sk_live_xxxxx"
```

### SDK Configuration

```typescript
import { createClient } from "@neo/sdk";

const client = createClient({
    apiKey: process.env.NEO_API_KEY,
});
```

## Security Best Practices

1. **Never commit keys** to version control
2. **Use environment variables** for storage
3. **Rotate keys** every 90 days
4. **Use separate keys** for dev/prod

## Key Rotation

```bash
# Generate new key
neo-cli api-key rotate --id key_xxxxx

# Old key remains valid for 24 hours
```

## Revoking Keys

```bash
neo-cli api-key revoke --id key_xxxxx
```

## Next Steps

- [REST API](../api-reference/REST-API.md) - API reference
- [Rate Limits](../api-reference/Rate-Limits.md) - Quota details

## Key Permissions (Scopes)

Each API key can be configured with specific permissions:

| Scope        | Description                  | Risk Level |
| ------------ | ---------------------------- | ---------- |
| `read`       | Read-only access to all data | Low        |
| `datafeed`   | Access price feeds           | Low        |
| `randomness` | Generate random numbers      | Low        |
| `payments`   | Execute GAS payments         | High       |
| `governance` | Vote with NEO                | High       |
| `secrets`    | Manage secrets               | Medium     |
| `admin`      | Full administrative access   | Critical   |

## Monitoring Usage

Check your API key usage:

```bash
curl -X GET "https://api.neo.org/v1/quota" \
  -H "Authorization: Bearer sk_live_xxxxx"
```

Response:

```json
{
    "key_id": "key_xxxxx",
    "tier": "production",
    "usage": {
        "requests_today": 5432,
        "requests_limit": 100000,
        "reset_at": "2026-01-12T00:00:00Z"
    }
}
```

## API Key Errors

| Error Code         | Description         | Solution             |
| ------------------ | ------------------- | -------------------- |
| `KEY_INVALID`      | Key not found       | Check key format     |
| `KEY_EXPIRED`      | Key has expired     | Generate new key     |
| `KEY_REVOKED`      | Key was revoked     | Contact support      |
| `KEY_RATE_LIMITED` | Rate limit exceeded | Wait or upgrade tier |
| `KEY_SCOPE_DENIED` | Missing permission  | Add required scope   |
