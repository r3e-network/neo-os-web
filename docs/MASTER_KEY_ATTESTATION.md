# External Attestation & Signer Boundary (Current)

This repository does not run the canonical TEE signer stack itself anymore.

Current ownership:

- `neo-morpheus-oracle`
  - Oracle worker attestation
  - Oracle callback signing
  - paymaster attestation
  - external confidential compute / VRF proofs

- `neo-abstract-account`
  - AA relay and verifier-side signing / validation UX

The MiniApp platform consumes those external attested systems through:

- configured URLs
- canonical contract hashes
- updater / callback allowlists
- attestation-bearing responses recorded in validation reports

## What this repo still owns

- MiniApp contracts that verify direct callbacks from Morpheus Oracle
- platform docs that record the current attested endpoints and validation outcomes
- deployment helpers for platform-owned contracts

## What this repo should not claim

- that it is the source of truth for the enclave signer
- that it runs the canonical Oracle / AA confidential runtime
- that service-layer writes originate from an in-repo Nitro mesh

## Operational Rule

When signer, attestation, callback, or paymaster behavior changes:

1. validate in `neo-morpheus-oracle` or `neo-abstract-account`
2. update the canonical addresses / domains consumed here
3. refresh the MiniApp platform integration docs and validation reports
