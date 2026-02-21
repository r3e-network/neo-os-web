# Global Signer Attestation (Current)

This repository uses a **TEE-managed signer** for all platform “service-layer writes”
(datafeed anchoring, randomness anchoring, automation execution marks, etc.).

## Components

- **MarbleRun**: attestation + secret distribution + mTLS identities inside the enclave mesh.
- **EGo**: enclave runtime for services.
- **GlobalSigner** (`infrastructure/globalsigner`): holds the active signing key (inside the enclave) and exposes:
  - `/attestation` (public key + metadata)
  - `/sign` (raw signing; key never leaves enclave)
- **TxProxy** (`services/txproxy`): allowlisted transaction signing + broadcast using the enclave signer.

## On-chain Authorization Model (MiniApp Platform)

Platform contracts use the **Updater** pattern:

- `PriceFeed.setUpdater(<signer>)`
- `RandomnessLog.setUpdater(<signer>)`
- `AutomationAnchor.setUpdater(<signer>)`

Only the Updater account can write these contracts’ state. The Updater should be the
enclave-managed signer (GlobalSigner/TxProxy) in production.

## Attestation & Audit

The platform relies on **attested TLS** (MarbleRun-issued) for service identity and integrity.
For a public audit trail, platform contracts store an `attestation_hash` field in writes:

- `PriceFeed.update(..., attestationHash, ...)`
- `RandomnessLog.record(..., attestationHash, ...)`

This repo’s services compute and submit an attestation hash for each anchored write.

## Local Development (Neo Express)

Use the deploy helpers to set Updater to the local `tee` wallet:

```bash
make -C deploy setup
make -C deploy run-neoexpress
make -C deploy deploy
make -C deploy init
```
