# Supabase Edge (Gateway)

This folder contains **Supabase Edge Functions** scaffolds for the MiniApp
platform. The intended architecture is a **thin gateway**:

- Auth via **Supabase Auth (GoTrue)**.
- Stateless request validation + rate limiting.
- Enforce platform rules:
  - **payments/settlement = GAS only**
  - **governance = NEO only**
- Forward sensitive requests to the **TEE services** over **mTLS** (attested TLS
  inside MarbleRun).

## Functions

See `platform/edge/functions/`:

- `pay-gas`: returns a PaymentHub `Pay` invocation (GAS-only).
- `vote-neo`: returns a Governance `Vote` invocation (NEO-only).
- `rng-request`: runs RNG via `neocompute` (no dedicated `vrf-service` in this repo).
- `datafeed-price`: read proxy to `neofeeds`.

Supabase deploys functions under:

- `/functions/v1/<function-name>`

## mTLS to TEE

The shared helper `platform/edge/functions/_shared/tee.ts` supports optional
mTLS when these env vars are present:

- `TEE_MTLS_CERT_PEM`: client certificate chain (PEM)
- `TEE_MTLS_KEY_PEM`: client private key (PEM)
- `TEE_MTLS_ROOT_CA_PEM`: trusted server root (PEM; MarbleRun root CA)

Alternatively `MARBLERUN_ROOT_CA_PEM` can be used as the root CA name.

