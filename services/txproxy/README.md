# Tx Proxy Service (`txproxy`)

This module provides a TEE-hosted **transaction proxy** responsible for:

- allowlisted contract invocation (method-level allowlist),
- signing using the enclave's `TEESigner` (typically backed by `globalsigner`),
- broadcasting to Neo N3 via `infrastructure/chain`,
- best-effort anti-replay for request IDs.

Code layout:

- `txproxy/marble`: enclave service implementation (HTTP API)

