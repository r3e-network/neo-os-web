# VRF / Randomness Service (`neorand`)

This module provides a TEE-hosted **verifiable randomness** endpoint for the service layer.

Design goals:

- One clear responsibility: **generate verifiable randomness**.
- Key custody handled by **GlobalSigner** when configured (preferred).
- Optional on-chain anchoring via the `RandomnessLog` platform contract.

Code layout:

- `vrf/marble`: enclave service implementation (HTTP API + signing + optional chain anchoring)

