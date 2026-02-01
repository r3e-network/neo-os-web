# Capabilities System

> Permission and capability model for MiniApps

## Overview

The Capabilities System controls what actions MiniApps can perform. Each capability must be declared in the app manifest and approved by users. This follows the principle of least privilege.

### Design Principles

| Principle            | Description                         |
| -------------------- | ----------------------------------- |
| **Least Privilege**  | Apps only get permissions they need |
| **Explicit Consent** | Users must approve each capability  |
| **Defense in Depth** | Multiple layers enforce permissions |
| **Audit Trail**      | All capability usage is logged      |

## Capability Types

| Capability   | Description       | Risk Level |
| ------------ | ----------------- | ---------- |
| `payments`   | Send GAS payments | High       |
| `governance` | Vote with NEO     | High       |
| `randomness` | Request VRF       | Low        |
| `datafeed`   | Read price feeds  | Low        |
| `secrets`    | Access secrets    | Medium     |
| `automation` | Schedule tasks    | Medium     |

## Manifest Declaration

```json
{
    "app_id": "my-app",
    "permissions": {
        "payments": true,
        "governance": false,
        "rng": true,
        "datafeed": true
    }
}
```

## Enforcement Layers

1. **SDK** - Blocks undeclared capabilities
2. **Edge** - Validates against manifest
3. **TEE** - Enforces at execution
4. **Contract** - Final on-chain check

## User Consent

Users must approve capabilities before use:

```
┌─────────────────────────────┐
│  App requests permissions:  │
│  ☑ Read price feeds         │
│  ☑ Generate random numbers  │
│  ☐ Send payments            │
│                             │
│  [Approve]  [Deny]          │
└─────────────────────────────┘
```

## Next Steps

- [Security Model](./Security-Model.md)

## Detailed Capability Descriptions

### payments

Allows the app to send GAS payments on behalf of the user.

```typescript
// Requires: payments capability
await sdk.payments.payGAS("recipient", "1.0", "memo");
```

**Limits:**

- Per-transaction: 100 GAS max
- Daily: 1000 GAS max
- Requires user confirmation for each transaction

### governance

Allows the app to vote with the user's NEO tokens.

```typescript
// Requires: governance capability
await sdk.governance.vote("candidate-address", 10);
```

**Limits:**

- Only NEO tokens (not GAS)
- Requires user confirmation

### randomness

Allows the app to request verifiable random numbers.

```typescript
// Requires: randomness capability
const result = await sdk.rng.requestRandom({ min: 1, max: 100 });
```

**Limits:**

- 100 requests per minute
- No user confirmation required

## Capability Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Capability Verification                    │
└─────────────────────────────────────────────────────────────┘

  Request         SDK            Edge           TEE
    │              │              │              │
    │  1. Call     │              │              │
    │─────────────▶│              │              │
    │              │  2. Check    │              │
    │              │  manifest    │              │
    │              │──────────────▶              │
    │              │              │  3. Verify   │
    │              │              │  consent     │
    │              │              │─────────────▶│
    │              │              │              │
    │              │              │  4. Execute  │
    │              │◀─────────────│◀─────────────│
    │◀─────────────│              │              │
```

## Permission Errors

| Error Code              | Description                |
| ----------------------- | -------------------------- |
| `CAPABILITY_UNDECLARED` | Not in manifest            |
| `CAPABILITY_DENIED`     | User denied permission     |
| `CAPABILITY_REVOKED`    | Permission was revoked     |
| `CAPABILITY_LIMIT`      | Rate/amount limit exceeded |
