# Unbreakable Vault production status

Version: `1.3.0`  
Verification date: 2026-07-12

## Product result

- The illustrated vault and break ritual are the primary surface; creation,
  top-up, owned-vault lists, and reclaim stay in the secondary drawer.
- Mainnet is honestly read-only while the deployed contract has no PaymentHub.
  Testnet uses the verified two-step GAS prepay and contract-action ABI.
- Plaintext secrets are never persisted. Interrupted payment and action stages
  use network, contract, wallet, amount, txid, exact event, and authoritative
  vault readback before a result can become confirmed.
- A payment-only recovery never sends the GAS transfer again. An interrupted
  attempt requires the player to re-enter the deliberately unpersisted secret.
- Failed or unavailable chain evidence remains recoverable or blocked; it is
  never rendered as a zero-value success.
- Create, attempt, top-up, reclaim, and recovery share one operation lock. A
  changed wallet, network, vault, or reviewed input aborts before broadcast.
- A returned action txid is journaled even when a wallet adapter omits its
  callback, so payment-stage recovery cannot replay the business action.
- A post-broadcast storage failure keeps the exact in-memory journal. The UI
  restores and verifies durable readback before any network recovery continues.
- Catalog read failure retains the last verified list and is visibly distinct
  from a verified empty contract.
- Malformed catalog totals, vault counters, timestamps, booleans, difficulty,
  or status values are rejected instead of becoming plausible zeros or active
  vaults. Catalog IDs remain exact beyond JavaScript Number precision.
- Initial create and attempt calls normalize wallet addresses through the
  canonical Hash160 argument builder; recovery reuses the exact stored script
  hash. A malformed pause-state read blocks a write instead of being treated as
  an unpaused contract.
- CREATE recovery accepts only a canonical 32-byte SHA-256 Base64 digest and
  bounded title/description fields before any saved operation can be resumed.
- Catalog banner and icon now derive from the same warm glass-vault resource as
  the playable surface instead of a generic letter mark.

## Verification evidence

- Focused logic, PlayArea, and production suite: 46/46 tests passed.
- Companion i18n, lightweight Open UI, and official-token suites: 93/93 tests
  passed.
- TypeScript, scoped ESLint, and the dedicated frontend structure gate passed.
- Production build passed with 1,856 modules. App JS is 233.30 kB raw / 69.28
  kB gzip; CSS is 118.04 kB / 20.75 kB; UI vendor is 33.34 kB / 11.77 kB.
  Moving the surface to
  `OpenUiLite` removed the former 188.24 kB UI JavaScript and 136.83 kB UI CSS
  vendor payloads.
- Static preview HTTP verification returned 200 for all 15/15 emitted files.
- The rebuilt dist is byte-identical to the host copy. The generated host
  catalog remains 77/77 unique app IDs with exactly one Unbreakable Vault
  `1.3.0` entry using the product-specific WebP icon and banner.
- The primary scene, derived banner, and derived icon were inspected locally at
  source resolution for crop, contrast, and product relevance.
- Deployment, ABI, read-only RPC, and recovery boundaries are recorded in
  [NETWORK_STATUS.md](./NETWORK_STATUS.md). Asset custody and derivatives are
  recorded in [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).

No browser automation, wallet signature, transaction broadcast, deployment,
funded account, secret, or git staging was used in this verification pass.
