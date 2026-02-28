# zNEP17: Zero-Knowledge Privacy Token Protocol (BLS12-381)

## Overview
This document outlines a complete zNEP17 (Zero-Knowledge Privacy Token Protocol based on BLS12-381) architecture for the Neo MiniApps Platform. The service layer introduces a new microservice, `neoprivacy`, employing a completely off-chain Tornado Cash-style credential model to ensure sender and receiver anonymity without relying on on-chain message encryption.

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MiniApp Frontend (Vercel)                        │
│             1. Deposit: Generate local secret & nullifier, submit tx        │
│             2. Offline Transfer: User copies note neo-zk://v1/gas/10/...    │
│             3. Withdraw: WASM ZKP proof generation, submit to Gateway       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS / RPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Supabase Edge Gateway (Thin Gateway)                  │
│                     (Routing, Rate Limit, Auth0)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ mTLS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENCLAVE WORKLOADS (SGX)                         │
│                                                                             │
│  [Existing] - TxProxy      (GlobalSigner signature, whitelist tx relay)     │
│  [Existing] - NeoGasBank   (Gas sponsorship & billing system)               │
│  [New]      - NeoPrivacy   (Listens Deposit, builds Merkle tree, Relay tx)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ SQL
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Supabase (PostgreSQL)                             │
│         (Table: zNEP17_deposits, zNEP17_nullifiers, zNEP17_roots)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Neo N3 Blockchain                               │
│  (Contract: zNEP17.cs - Contains Deposit(), Withdraw() & BLS12-381 Verifier)│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Smart Contract: `zNEP17.cs`
Deployed on Neo N3 as a platform contract.
- **Merkle Roots**: Stores the 100 most recent valid Merkle Roots.
- **Nullifiers**: Set of spent Nullifier Hashes (prevents double spending).
- **Denominations**: Fixed denomination pools (e.g., 10 GAS, 100 GAS) to reduce anonymity set correlation.
- **Methods**: `Deposit`, `Withdraw` (includes BLS12-381 Pairing zero-knowledge verification).

## 2. TEE Microservice: `neoprivacy` (Go)
Runs in SGX as a standard microservice.
- **TreeIndexer**: Polls the blockchain for `DepositEvent`, updates the Poseidon Merkle tree in memory, and synchronizes state with `Supabase` tables (`zNEP17_deposits`, `zNEP17_roots`).
- **Endpoints**:
  - `GET /api/v1/privacy/merkle-path/{commitment}`: Returns path elements and indices for ZKP generation.
  - `POST /api/v1/privacy/relay`: Receives ZKP, checks nullifier, and forwards to `txproxy` for gas-less withdrawal execution. The relayer fee pays the global signer.

## 3. Frontend Integration: SDK & MiniApp Blueprint
- **Deposit Flow**: WASM ZKP logic runs in the client browser (`snarkjs`). Generates a `secret` and `nullifier`, computes the `commitment` via Poseidon hash, and initiates the on-chain deposit. An offline note `neo-zk://v1/gas/10/...` is generated.
- **Withdraw Flow**: The receiver parses the note, fetches the Merkle path from the `neoprivacy` service, generates a Groth16 proof locally, and submits it to the relayer endpoint.

## 4. Advantages
1. **Extreme Security (TEE + ZKP)**: ZKP mathematically proves validity, while SGX hardware isolation prevents MITM IP/request correlation.
2. **Solves the "No Initial Gas" Problem**: `txproxy` (the relayer) pays the transaction fee on behalf of the user, taking a `relayerFee` directly from the withdrawn amount via the contract.
3. **Trustless & Decentralized**: Off-chain credential sharing `neo-zk://` avoids the pitfalls of centralized storage or on-chain message encryption.
