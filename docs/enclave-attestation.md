# Enclave Registry and SGX Remote Attestation

This document describes the Enclave Registry system and SGX Remote Attestation integration, which enables users to verify that the Service Layer's cryptographic operations are performed inside genuine Intel SGX enclaves.

## Overview

The Service Layer uses Intel SGX (Software Guard Extensions) to provide hardware-based security guarantees. The Enclave Registry system ensures:

1. **Master Account Authenticity**: The master keypair is generated inside a genuine SGX enclave
2. **Code Integrity**: The enclave runs the expected, unmodified code (verified via MRENCLAVE)
3. **Signer Verification**: The enclave was signed by a trusted party (verified via MRSIGNER)
4. **Script Verification**: Service scripts are verified before execution

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Enclave Attestation Architecture                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    SGX Enclave (Hardware)                        │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Master Key Generation                                   │    │    │
│  │  │  - ECDSA P-256 keypair generated inside enclave         │    │    │
│  │  │  - Private key never leaves enclave                     │    │    │
│  │  │  - Public key hash embedded in SGX Quote ReportData     │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  SGX Quote Generation                                    │    │    │
│  │  │  - MRENCLAVE: SHA256 of enclave code                    │    │    │
│  │  │  - MRSIGNER: SHA256 of signer's public key              │    │    │
│  │  │  - ReportData: SHA256(MasterPublicKey)                  │    │    │
│  │  │  - ISV SVN: Security version number                     │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Go Service Layer                              │    │
│  │  - AttestedRegistry: Manages attested master accounts           │    │
│  │  - VerifiedEngine: Verifies scripts before execution            │    │
│  │  - AttestationVerifier: Validates SGX quotes                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Neo N3 Smart Contracts                        │    │
│  │  - EnclaveRegistry.cs: On-chain attestation storage             │    │
│  │  - Trusted measurements management                              │    │
│  │  - User verification APIs                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### Go Layer

#### AttestedRegistry (`system/enclave/registry/attested_registry.go`)

Extends the base Registry with SGX attestation capabilities:

```go
type AttestedRegistry struct {
    *Registry
    sgxBridge           tee.SGXBridge
    verifier            AttestationVerifier
    trustedMeasurements *TrustedMeasurements
    attestedAccount     *AttestedMasterAccount
}
```

Key methods:
- `InitializeWithAttestation()` - Initialize with SGX quote generation
- `GetAttestationEvidence()` - Get attestation proof for verification
- `VerifyAttestation()` - Verify attestation evidence
- `RefreshAttestation()` - Generate fresh attestation quote

#### VerifiedEngine (`system/enclave/registry/verified_engine.go`)

Wraps script execution with authenticity verification:

```go
type VerifiedEngine struct {
    registry    *Registry
    executor    ScriptExecutor
    strictMode  bool
}
```

Key methods:
- `Execute()` - Execute script with verification
- `VerifyScriptOnly()` - Verify without execution
- `RegisterAndVerifyService()` - Register and verify service

### Smart Contract Layer

#### EnclaveRegistry.cs (`contract/shared/EnclaveRegistry.cs`)

On-chain contract for attestation management:

**Data Structures:**

```csharp
public struct SGXAttestationReport
{
    public ByteString ReportId;       // Unique report identifier
    public ByteString AccountId;      // Associated master account
    public ByteString MrEnclave;      // MRENCLAVE measurement (32 bytes)
    public ByteString MrSigner;       // MRSIGNER measurement (32 bytes)
    public ByteString PublicKeyHash;  // SHA256 of master public key
    public ByteString RawQuote;       // Raw SGX quote for external verification
    public BigInteger IsvProdId;      // ISV Product ID
    public BigInteger IsvSvn;         // ISV Security Version Number
    public bool IsDebug;              // Debug enclave flag
    public bool Verified;             // Verification status
    public BigInteger SubmittedAt;    // Submission timestamp
    public BigInteger VerifiedAt;     // Verification timestamp
}

public struct TrustedMeasurementData
{
    public ByteString MeasurementId;  // Unique identifier
    public ByteString MrEnclave;      // Expected MRENCLAVE
    public ByteString MrSigner;       // Expected MRSIGNER
    public BigInteger MinIsvSvn;      // Minimum ISV SVN
    public bool AllowDebug;           // Allow debug enclaves
    public bool Active;               // Active status
}
```

**Key Methods:**

| Method | Description |
|--------|-------------|
| `SubmitAttestationReport()` | Submit SGX attestation for a master account |
| `VerifyAttestationReport()` | Verify report against trusted measurements |
| `IsAccountAttested()` | Check if account has verified attestation |
| `GetAccountMrEnclave()` | Get MRENCLAVE for user verification |
| `AddTrustedMeasurement()` | Add trusted enclave measurement (admin) |
| `IsMrEnclaveTrusted()` | Check if MRENCLAVE is trusted |

## Verification Flow

### 1. Enclave Initialization

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Enclave   │     │  Go Layer   │     │  Contract   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ Generate Keypair  │                   │
       │ (inside SGX)      │                   │
       │──────────────────>│                   │
       │                   │                   │
       │ Generate Quote    │                   │
       │ (MRENCLAVE +      │                   │
       │  PublicKeyHash)   │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ Register Master   │
       │                   │ Account           │
       │                   │──────────────────>│
       │                   │                   │
       │                   │ Submit Attestation│
       │                   │ Report            │
       │                   │──────────────────>│
       │                   │                   │
```

### 2. User Verification

Users can verify enclave authenticity through multiple methods:

#### On-Chain Verification

```csharp
// Check if account is attested
bool isAttested = EnclaveRegistry.IsAccountAttested(accountId);

// Get MRENCLAVE for independent verification
ByteString mrEnclave = EnclaveRegistry.GetAccountMrEnclave(accountId);

// Check if MRENCLAVE is in trusted list
bool isTrusted = EnclaveRegistry.IsMrEnclaveTrusted(mrEnclave, mrSigner);
```

#### Off-Chain Verification

```go
// Get attestation evidence
evidence, err := registry.GetAttestationEvidence()

// Verify attestation
result, err := registry.VerifyAttestation(ctx, evidence)
if result.Valid {
    fmt.Printf("Enclave verified: MRENCLAVE=%s\n", result.MREnclave)
}

// Independent quote verification via Intel IAS or DCAP
// Users can verify evidence.RawQuote externally
```

## SGX Measurements

### MRENCLAVE

- 32-byte SHA256 hash of enclave code and data
- Changes when enclave code is modified
- Uniquely identifies the exact enclave binary

### MRSIGNER

- 32-byte SHA256 hash of enclave signer's public key
- Identifies who signed the enclave
- Remains constant across enclave updates by same signer

### ISV SVN (Security Version Number)

- Indicates security patch level
- Higher values indicate newer security fixes
- Minimum acceptable SVN can be configured

## Trusted Measurements Management

Administrators configure trusted measurements to define which enclaves are accepted:

```csharp
// Add trusted measurement (admin only)
ByteString measurementId = EnclaveRegistry.AddTrustedMeasurement(
    mrEnclave,      // Expected MRENCLAVE
    mrSigner,       // Expected MRSIGNER
    minIsvSvn: 1,   // Minimum security version
    allowDebug: false,
    description: "Production enclave v1.0"
);
```

## Security Considerations

### Production Deployment

1. **Disable Debug Enclaves**: Set `AllowDebug = false` in trusted measurements
2. **Minimum ISV SVN**: Set appropriate minimum security version
3. **Quote Freshness**: Implement attestation TTL to require periodic re-attestation
4. **Multiple Verifiers**: Use both IAS and DCAP for redundant verification

### Key Binding

The public key hash is embedded in the SGX Quote's ReportData field, cryptographically binding the key to the enclave:

```
ReportData[0:32] = SHA256(MasterPublicKey)
```

This ensures:
- The key was generated inside the attested enclave
- The key cannot be substituted without invalidating the quote
- Users can verify key-to-enclave binding independently

## API Reference

### Go API

```go
// Initialize with attestation
registry, _ := NewAttestedRegistry(&AttestedRegistryConfig{
    SGXBridge:           bridge,
    TrustedMeasurements: &TrustedMeasurements{...},
    RequireAttestation:  true,
})
registry.InitializeWithAttestation(ctx)

// Get attestation evidence
evidence, _ := registry.GetAttestationEvidence()

// Verify attestation
result, _ := registry.VerifyAttestation(ctx, evidence)
```

### Contract API

```csharp
// Submit attestation
ByteString reportId = EnclaveRegistry.SubmitAttestationReport(
    accountId, mrEnclave, mrSigner, publicKeyHash,
    rawQuote, isvProdId, isvSvn, isDebug, signature
);

// Verify attestation (admin)
EnclaveRegistry.VerifyAttestationReport(reportId, measurementId);

// User verification
bool attested = EnclaveRegistry.IsAccountAttested(accountId);
```

## File Locations

| Component | Path |
|-----------|------|
| Attested Registry | `system/enclave/registry/attested_registry.go` |
| Verified Engine | `system/enclave/registry/verified_engine.go` |
| Base Registry | `system/enclave/registry/registry.go` |
| SGX Bridge | `system/tee/sgx_bridge.go` |
| EnclaveRegistry Contract | `contract/shared/EnclaveRegistry.cs` |
| ServiceContractBase | `contract/shared/ServiceContractBase.cs` |

## Related Documentation

- [Contract System Architecture](contract-system.md)
- [Security Hardening](security-hardening.md)
- [Confidential Computing Guide](examples/confidential.md)
