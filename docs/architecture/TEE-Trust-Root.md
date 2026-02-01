# TEE Trust Root

> Hardware-backed security foundation for the Neo Service Layer

## Overview

The TEE (Trusted Execution Environment) Trust Root provides cryptographic guarantees that services run authentic, unmodified code inside secure enclaves. This forms the foundation of the platform's security model.

### Key Guarantees

| Guarantee           | Description                                       |
| ------------------- | ------------------------------------------------- |
| **Confidentiality** | Data remains encrypted even in memory             |
| **Integrity**       | Code execution cannot be tampered with            |
| **Authenticity**    | Remote parties can verify genuine execution       |
| **Isolation**       | Enclaves are isolated from host OS and hypervisor |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   MarbleRun Mesh                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐│
│  │ VRF Svc │  │DataFeed │  │ Oracle  │  │ GasBank ││
│  │ (SGX)   │  │ (SGX)   │  │ (SGX)   │  │ (SGX)   ││
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘│
│       │            │            │            │      │
│       └────────────┴─────┬──────┴────────────┘      │
│                          │                          │
│                    ┌─────┴─────┐                    │
│                    │  Master   │                    │
│                    │   Key     │                    │
│                    └───────────┘                    │
└─────────────────────────────────────────────────────┘
```

## Key Components

### Intel SGX Enclaves

- Hardware-isolated execution
- Encrypted memory
- Remote attestation

### MarbleRun Coordinator

- Service mesh for TEE workloads
- mTLS between services
- Manifest-based deployment

### Master Key Derivation

- Single root of trust
- Deterministic key hierarchy
- Attestation-bound secrets

## Attestation Flow

1. **Enclave starts** → Generates quote
2. **Quote verified** → By Intel Attestation Service
3. **Certificate issued** → For mTLS identity
4. **Hash anchored** → On Neo N3 blockchain

## Verification

```bash
# Verify service attestation
neo-cli verify-attestation --service vrf --hash 0x...
```

## Security Properties

| Property        | Guarantee                  |
| --------------- | -------------------------- |
| Confidentiality | Data encrypted in memory   |
| Integrity       | Code cannot be modified    |
| Authenticity    | Proof of genuine execution |

## Next Steps

- [ServiceOS Layer](./ServiceOS-Layer.md)
- [Security Model](./Security-Model.md)

## Intel SGX Technical Details

### Enclave Memory Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Enclave Page Cache (EPC)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │    Code     │  │    Data     │  │    Heap     │          │
│  │  (Sealed)   │  │ (Encrypted) │  │ (Protected) │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                             │
│  Memory Encryption Engine (MEE) - AES-128-CTR               │
└─────────────────────────────────────────────────────────────┘
```

### MRENCLAVE & MRSIGNER

| Measurement | Description                              |
| ----------- | ---------------------------------------- |
| `MRENCLAVE` | Hash of enclave code and initial data    |
| `MRSIGNER`  | Hash of signing key (developer identity) |

### Attestation Quote Structure

```json
{
    "version": 3,
    "sign_type": "EPID",
    "epid_group_id": "...",
    "qe_svn": 7,
    "pce_svn": 10,
    "basename": "...",
    "report_body": {
        "cpu_svn": "...",
        "mr_enclave": "0x7a8b9c...",
        "mr_signer": "0x1d2e3f...",
        "isv_prod_id": 1,
        "isv_svn": 1,
        "report_data": "..."
    }
}
```

## Threat Model

### Protected Against

| Threat            | Protection                      |
| ----------------- | ------------------------------- |
| Malicious host OS | Hardware isolation              |
| Memory snooping   | Memory encryption               |
| Code tampering    | Measurement verification        |
| Replay attacks    | Monotonic counters              |
| Man-in-the-middle | mTLS with attested certificates |

### Not Protected Against

| Threat               | Mitigation                    |
| -------------------- | ----------------------------- |
| Side-channel attacks | Constant-time implementations |
| Denial of service    | Rate limiting, redundancy     |
| Physical access      | Tamper-evident hardware       |
