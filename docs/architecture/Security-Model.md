# Security Model

> Defense-in-depth security architecture

## Overview

The Neo Service Layer implements a four-layer security model ensuring no single point of failure. Each layer provides independent security guarantees.

### Security Principles

| Principle            | Implementation                      |
| -------------------- | ----------------------------------- |
| **Defense in Depth** | Four independent security layers    |
| **Least Privilege**  | Minimal permissions per component   |
| **Zero Trust**       | Verify every request, trust nothing |
| **Fail Secure**      | Default deny on any failure         |

## Four Layers

```
┌─────────────────────────────────────┐
│  Layer 1: SDK (Host-Enforced)       │
│  - Manifest permissions             │
│  - Sandbox isolation                │
│  - CSP headers                      │
├─────────────────────────────────────┤
│  Layer 2: Edge (Supabase)           │
│  - Authentication                   │
│  - Rate limiting                    │
│  - Nonce/replay protection          │
├─────────────────────────────────────┤
│  Layer 3: TEE Services              │
│  - mTLS identity                    │
│  - Attestation                      │
│  - Secret custody                   │
├─────────────────────────────────────┤
│  Layer 4: Smart Contracts           │
│  - Authorized signer checks         │
│  - Monotonic counters               │
│  - Anti-replay                      │
└─────────────────────────────────────┘
```

## Asset Constraints

| Asset | Payments    | Governance  |
| ----- | ----------- | ----------- |
| GAS   | ✅ Allowed  | ❌ Rejected |
| NEO   | ❌ Rejected | ✅ Allowed  |
| Other | ❌ Rejected | ❌ Rejected |

## Anti-Replay Protection

- Request IDs tracked at Edge
- Nonce validation in contracts
- Monotonic counters on-chain

## Audit Trail

All requests are logged with:

- Timestamp
- Request ID
- Wallet address
- Action performed
- Result status

## Next Steps

- [TEE Trust Root](./TEE-Trust-Root.md)
- [Capabilities System](./Capabilities-System.md)

## Attack Vectors & Mitigations

| Attack Vector       | Layer    | Mitigation                      |
| ------------------- | -------- | ------------------------------- |
| XSS/Injection       | SDK      | CSP headers, input sanitization |
| Replay attacks      | Edge     | Nonce tracking, request IDs     |
| Man-in-the-middle   | TEE      | mTLS, certificate pinning       |
| Unauthorized access | Contract | Signer verification             |
| Rate abuse          | Edge     | Per-user/app rate limiting      |
| Data tampering      | TEE      | Hardware isolation, attestation |

## Security Checklist

### For MiniApp Developers

- [ ] Declare only required permissions in manifest
- [ ] Validate all user inputs
- [ ] Use HTTPS for all external requests
- [ ] Handle errors without exposing internals
- [ ] Test with security scanning tools

### For Platform Operators

- [ ] Regular security audits
- [ ] Monitor for anomalous patterns
- [ ] Keep TEE firmware updated
- [ ] Rotate signing keys periodically
- [ ] Maintain incident response plan
