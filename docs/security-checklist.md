# Security Checklist (MiniApp Platform)

This checklist is the minimum baseline for a Neo N3 MiniApp Platform with TEE-backed services.

## Asset Constraints

- Payments / settlement: **GAS only**
- Governance: **bNEO only**
- Explicitly reject: native NEO and any other assets for payment/governance paths.

## Defense in Depth (Four Layers)

1. **SDK (host-enforced)**: manifest permissions + sandbox + CSP + postMessage allowlist.
2. **Edge (Supabase)**: auth, nonce/replay protection, rate limits, caps, routing.
3. **TEE Services**: mTLS identity, allowlists, signature/attestation production, secret custody.
4. **Contracts**: final checks (authorized signer/TEE account, monotonic counters, anti-replay).

## TEE / Attestation

- MarbleRun-managed mTLS for service-to-service traffic.
- Enforce strict identity mode in production: no plaintext HTTP inside the mesh.
- Persist attestation hashes on-chain for audit (`PriceFeed`, `RandomnessLog`).

## Transaction Policy (tx-proxy)

- Allowlist contracts + methods + argument shapes.
- Per-app/per-user spending caps (GAS) and governance caps (NEO).
- Anti-replay via request IDs and nonce tracking (Edge + contract).
- Structured audit logs stored outside enclave (no secrets).

## Datafeed Safety

- Threshold publish: >= 0.1% change; hysteresis 0.08%.
- Min publish interval: 2–5s; max per-symbol publish rate (e.g., 30/min).
- Outlier detection: multi-source confirmation for large deltas.
- Round IDs monotonic on-chain.

## Host Isolation

- Strict CSP: no `eval`, no arbitrary script origins.
- `postMessage` origin allowlist.
- Prefer `iframe` sandbox attributes when embedding untrusted apps.
