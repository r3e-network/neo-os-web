# Neo N3 Mini-App Platform (Architectural Blueprint)

This document is the **canonical blueprint** the repository is converging to.
It enumerates the tooling choices and the hard constraints:

- **Settlement: GAS only**
- **Governance: NEO only**
- **Confidential services: MarbleRun + EGo (SGX TEE)**
- **Gateway: Supabase (Auth + DB + Edge)**
- **Frontend host: Vercel + Next.js + micro-frontends**
- **Datafeed: high frequency, push on ≥ 0.1% deviation**

## Repo Notes (Current Implementation)

This repo follows the blueprint with a few intentional implementation notes:

- **VRF service**: there is **no dedicated `vrf-service`** directory. Randomness
  is provided via **`neocompute`** scripts inside the enclave and can be anchored
  on-chain via `RandomnessLog`.
- **Service naming**: runtime service IDs are kept stable (`neofeeds`,
  `neocompute`, etc.). See `docs/platform-mapping.md` for the mapping to the
  blueprint names (`datafeed-service`, `compute-service`, ...).
- **Edge ↔ TEE mTLS**: the target design is to connect Supabase Edge → enclave
  services over mTLS. The Deno scaffolds include optional mTLS support via
  `Deno.createHttpClient`, and the enclave server TLS can be configured to trust
  an extra client CA via `MARBLE_EXTRA_CLIENT_CA`.

For the expanded Chinese spec (including the “VRF via compute” note), see:

- `docs/neo-miniapp-platform-full.md`

