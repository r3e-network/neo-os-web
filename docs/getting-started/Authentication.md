# Authentication

> Secure authentication methods for the Neo Service Layer

## Overview

The Neo Service Layer uses a multi-layer authentication model:

| Layer          | Method                | Use Case                    |
| -------------- | --------------------- | --------------------------- |
| User Identity  | Wallet Signature      | MiniApp user authentication |
| Service Access | API Key + JWT         | Backend integrations        |
| Hardware Trust | TEE Attestation       | Enclave verification        |
| Social Login   | OAuth (Google/GitHub) | Optional user convenience   |

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Authentication Flow                              │
└─────────────────────────────────────────────────────────────────────────┘

  User                MiniApp              Edge Layer            TEE
   │                    │                      │                  │
   │  1. Connect Wallet │                      │                  │
   │───────────────────▶│                      │                  │
   │                    │                      │                  │
   │  2. Sign Challenge │                      │                  │
   │◀───────────────────│                      │                  │
   │                    │                      │                  │
   │  3. Return Signature                      │                  │
   │───────────────────▶│                      │                  │
   │                    │  4. Verify Signature │                  │
   │                    │─────────────────────▶│                  │
   │                    │                      │                  │
   │                    │  5. Issue JWT Token  │                  │
   │                    │◀─────────────────────│                  │
   │                    │                      │                  │
   │                    │  6. API Request + JWT│                  │
   │                    │─────────────────────▶│                  │
   │                    │                      │  7. Forward      │
   │                    │                      │─────────────────▶│
   │                    │                      │                  │
   │                    │  8. Response         │                  │
   │                    │◀─────────────────────│◀─────────────────│
   │                    │                      │                  │
```

## Wallet Authentication

### How It Works

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Wallet  │────▶│  Sign    │────▶│  Verify  │
│  (User)  │     │  Message │     │  (Edge)  │
└──────────┘     └──────────┘     └──────────┘
```

### Implementation

```typescript
import { waitForSDK } from "@neo/uniapp-sdk";

const sdk = await waitForSDK();

// Get connected wallet address
const address = await sdk.wallet.getAddress();

// The SDK handles signature verification automatically
```

### Supported Wallets

| Wallet  | Status       | Notes            |
| ------- | ------------ | ---------------- |
| NeoLine | ✅ Supported | Chrome extension |
| O3      | ✅ Supported | Mobile & Desktop |
| Neon    | ✅ Supported | Desktop wallet   |
| OneGate | ✅ Supported | Mobile wallet    |

## API Key Authentication

For server-side integrations, use API keys:

```bash
curl -X GET "https://api.neo.org/v1/price/GAS-USD" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

See [API Keys](./API-Keys.md) for key management.

## Session Management

Sessions are managed automatically by the SDK:

- **Duration**: 24 hours default
- **Refresh**: Automatic before expiry
- **Storage**: Secure, encrypted local storage

## Security Best Practices

1. **Never expose API keys** in client-side code
2. **Validate signatures** on your backend
3. **Use HTTPS** for all API calls
4. **Rotate keys** regularly

## JWT Token Structure

The JWT token issued after authentication contains:

```json
{
    "header": {
        "alg": "ES256",
        "typ": "JWT"
    },
    "payload": {
        "sub": "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
        "iss": "neo-service-layer",
        "aud": "miniapp",
        "exp": 1704931200,
        "iat": 1704844800,
        "app_id": "my-miniapp",
        "permissions": ["payments", "datafeed", "rng"]
    }
}
```

| Field         | Description               |
| ------------- | ------------------------- |
| `sub`         | User's Neo wallet address |
| `iss`         | Token issuer              |
| `aud`         | Intended audience         |
| `exp`         | Expiration timestamp      |
| `iat`         | Issued at timestamp       |
| `app_id`      | MiniApp identifier        |
| `permissions` | Granted capabilities      |

## Authentication Errors

| Error Code        | Description             | Solution               |
| ----------------- | ----------------------- | ---------------------- |
| `AUTH_INVALID`    | Invalid signature       | Re-authenticate user   |
| `AUTH_EXPIRED`    | Token expired           | Refresh token          |
| `AUTH_NO_WALLET`  | Wallet not connected    | Prompt user to connect |
| `AUTH_REJECTED`   | User rejected signature | Show friendly message  |
| `AUTH_RATE_LIMIT` | Too many auth attempts  | Wait before retry      |

## Next Steps

- [API Keys](./API-Keys.md) - Manage credentials
- [Security Model](../architecture/Security-Model.md) - Deep dive
