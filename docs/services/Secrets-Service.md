# Secrets Service

> Secure secret management within TEE enclaves

## Overview

The Secrets Service provides secure storage and access to sensitive data (API keys, private keys, credentials) within Trusted Execution Environment (TEE) enclaves.

| Feature            | Description                 |
| ------------------ | --------------------------- |
| **TEE-Protected**  | Secrets never leave enclave |
| **Access Control** | Per-app permission model    |
| **Audit Logging**  | All access is logged        |
| **Auto Rotation**  | Scheduled key rotation      |

## Key Features

- **TEE-Protected Storage** - Secrets never leave the enclave
- **Access Control** - Per-app permission model
- **Audit Logging** - All access is logged
- **Automatic Rotation** - Scheduled key rotation

## Architecture

```
┌─────────────────────────────────────────┐
│           MiniApp Request               │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Edge (Authentication)           │
│         - Verify API key                │
│         - Check permissions             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         TEE Enclave (SGX)               │
│         - Decrypt secret                │
│         - Return to caller              │
│         - Log access                    │
└─────────────────────────────────────────┘
```

## SDK Usage

### Store a Secret

```javascript
import { useSecrets } from "@neo/sdk";

const { storeSecret } = useSecrets();

await storeSecret({
    key: "my-api-key",
    value: "sk_live_xxx",
    scope: "app", // 'app' | 'user'
});
```

### Retrieve a Secret

```javascript
const { getSecret } = useSecrets();

const apiKey = await getSecret("my-api-key");
```

### Delete a Secret

```javascript
const { deleteSecret } = useSecrets();

await deleteSecret("my-api-key");
```

## Manifest Declaration

Apps must declare secrets capability:

```json
{
    "app_id": "my-app",
    "permissions": {
        "secrets": true
    }
}
```

## Security Model

| Layer   | Protection                    |
| ------- | ----------------------------- |
| SDK     | Permission check              |
| Edge    | Authentication, rate limiting |
| TEE     | Encryption, isolation         |
| Storage | Sealed to enclave             |

## Best Practices

1. **Minimal scope** - Use app-scoped secrets when possible
2. **Rotate regularly** - Enable automatic rotation
3. **Audit access** - Review access logs periodically
4. **Least privilege** - Only request secrets capability if needed

## Next Steps

- [Security Model](../architecture/Security-Model.md)
- [TEE Trust Root](../architecture/TEE-Trust-Root.md)
- [API Keys](../getting-started/API-Keys.md)
