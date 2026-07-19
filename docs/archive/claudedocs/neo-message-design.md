# Neo Message — encrypted + time-locked messaging (design + reality)

Goal: (1) message encrypted so **only the target account** reads plaintext (after connecting their
wallet), and (2) **future/time-locked** messages whose plaintext is only revealed on-chain at a
scheduled time. Both lean on Morpheus oracle services.

## What already exists and works (reusable)
- **Client X25519-HKDF-SHA256-AES-256-GCM encryption** — `apps/shared/utils/morpheus-confidential-envelope.ts` (`encryptTextWithOraclePublicKey`). Standard ECIES to any 32-byte X25519 pubkey.
- **Oracle pubkey + TEE decrypt** — worker `/oracle/public-key` (X25519 pub) and `/oracle/query` decrypt the envelope **inside the Nitro enclave** (`workers/nitro-worker/src/oracle/crypto.js`). LIVE.
- **Encrypted-secret storage** — Supabase `morpheus_encrypted_secrets` with requester/callback binding + one-time claim. LIVE (but Supabase quota has been an operational risk).
- **Templates** — `private-transfer` (seal→store→TEE), `time-capsule` (unlock-time reveal vault), wallet `signMessage` (auth). All working.

## Two hard constraints (these shape the design)
1. **Neo N3 wallets cannot decrypt.** NeoLine/OneGate expose secp256r1 *signing* only — no X25519/`eth_decrypt`
   primitive. So a message **cannot** be decrypted client-side by a Neo-account recipient. The only way "only
   the target can read" works across Neo N3 **and** Neo X is **oracle-mediated**: encrypt to the oracle's
   X25519 key, and the **Nitro enclave** decrypts and releases plaintext **only** to a recipient who proves
   account ownership (wallet `signMessage`). Trust model: the attested TEE can technically see plaintext
   (its key is sealed via AWS Secrets Manager). True end-to-end (oracle never sees it) is only possible on
   **Neo X / MetaMask** via `eth_decrypt` — EVM-only, and that API is deprecated.
2. **The time-locked on-chain reveal lane is partially degraded.** Automation registration/scheduling works
   (Supabase, one-shot/interval/price triggers), but the path that **decrypts in the TEE and posts plaintext
   on-chain at the scheduled time is not wired** (`automation.js` never calls the oracle decrypt; no on-chain
   reveal). Delivering feature (2) means building that path + a reveal contract + depending on the
   (quota-sensitive) Supabase automation store.

## Proposed architecture (oracle-mediated)
**New oracle worker endpoints** (`workers/nitro-worker`):
- `POST /oracle/message` — store a sealed envelope bound to `{recipient, sender, unlock_time?}`; return `id`.
- `GET /oracle/message/inbox` — list message ids/metadata for an authenticated recipient.
- `POST /oracle/message/read` — recipient sends a wallet-signed proof; enclave verifies signer == bound
  recipient, decrypts, returns plaintext (one app session only).

**New contract `MiniAppMessage`** (NeoVM + EVM): `send(recipientHash, envelopeRef, unlockTime, feeGAS)`,
`reveal(id, plaintext, oracleSig)` (time-lock), recipient-witness gating, events for inbox discovery.

**New miniapp `apps/neo-message`** (copy `time-capsule` structure): compose tab (recipient + body +
optional "reveal on" date) → encrypt → store → record on-chain; inbox tab (recipient connects wallet →
lists messages → read decrypts via the oracle); a public "revealed" view for time-locked messages.

**Feature 1 (recipient-only)** uses `/oracle/message` + read-with-auth. Achievable now (moderate).
**Feature 2 (time-locked)** additionally needs the automation→TEE-decrypt→on-chain-reveal lane revived +
the reveal contract. Larger; depends on the degraded automation lane + Supabase.

## Decisions needed before building
- Encryption/trust model: **oracle-mediated TEE** (works on Neo N3 + Neo X; TEE can see plaintext) vs
  **wallet-native E2E** (Neo X/MetaMask only; oracle never sees plaintext).
- Scope/sequencing: build **recipient-only first** (achievable), then time-lock; or both together
  (time-lock requires reviving degraded infra); or scaffold + design-review first.
