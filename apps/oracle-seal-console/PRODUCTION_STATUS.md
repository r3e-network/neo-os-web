# Oracle Seal Console production status

Status date: 2026-07-11.

## Implemented product surface

- Warm, bright, resource-led seal studio built on the existing `PlayStage` and OpenUiLite design system.
- The real seal-chamber artwork and prepare → seal → receipt journey occupy the main stage; the JSON editor, route, full receipt, and diagnostics remain in a secondary drawer.
- The former large type cards are compact purpose lanes, and mobile order shows the seal object before the configuration summary.
- One primary action changes honestly between new seal, exact-ciphertext retry, stored-receipt cleanup, and unreadable-record cleanup.
- MainNet/TestNet selection is bound before the framework seal client is created.
- A read-only same-origin capability check must confirm the server-side store
  credential and project binding for the selected network before any new
  plaintext is encrypted.
- Fresh endpoint key, raw 32-byte X25519 length, pinned algorithm, pinned Oracle contract, and independent direct-RPC contract evidence are required without prompting for a wallet.
- Non-empty JSON-object, 64 KiB plaintext, 64-level nesting, finite/safe
  numeric values, 256 KiB ciphertext-envelope, route-length, safe-timestamp,
  and exact-reference validation.
- Browser-local framework-v2 encryption and real SHA-256 ciphertext fingerprinting.
- Framework-v2 recovery accepts only the exact six-field ciphertext envelope;
  injected plaintext or unknown envelope fields cannot enter a retry.
- Recovery storage is probed before a new seal. Pending writes, receipt-history writes, and deletes must survive exact readback before the UI treats them as durable.
- The exact ciphertext is saved before the first external store request; a silently dropped journal prevents that request entirely.
- Retry recomputes the ciphertext fingerprint and never fetches a key, parses source JSON, or encrypts a second object.
- A returned storage receipt is journaled as `stored` before local cleanup. Interrupted cleanup becomes a local-only finalization action and never an ordinary second POST.
- Malformed recovery records are blocked from sending and require explicit two-step cleanup.
- One cross-action coordinator joins duplicate readiness reads and rejects conflicting seal/retry/cleanup actions, preventing stale observable results.
- Rejected action promises are consumed by the component after the shared
  status layer reports the failure, avoiding unhandled browser rejections.
- Stored receipts are validated, deduplicated by ciphertext fingerprint, and capped at eight device-local records.
- The copy states that a storage reference is not a transaction, execution result, TEE attestation, ZK proof, settlement, or account-ownership proof.
- The generic platform operation form remains empty; the native workbench is the only interaction surface.
- Legacy handcrafted launcher SVGs were removed. Active visual resources are WebP/AVIF and interface glyphs are Lucide.

## Verification evidence

- Five Oracle Seal test files: **29/29 passed**.
- Oracle Seal plus the shared preview-kernel boundary: **44/44 passed** across six files.
- Host confidential-store transport and capability tests: **5/5 passed**;
  host TypeScript validation also passed.
- Full shared Vitest run: **4,185/4,198 passed**. The 13 failures are outside Oracle Seal and belong to concurrently edited Custom Anchor, Oracle Compute Lab, Daily Check-in, Gasbox, Last Survivor, Timestamp Proof, Zhuada-e catalog coverage, and global game/background assertions. No Oracle Seal test failed in the full run.
- `npx tsc -p apps/oracle-seal-console/tsconfig.json --noEmit`: passed.
- Scoped ESLint over app source and all relevant shared tests: passed with zero warnings.
- Dedicated frontend structure test: **1/1 passed**.
- Stateful manifest truth test: **18/18 passed** when run from the shared-test root.
- Production build: passed; **1,846 modules transformed**.
  - app JavaScript: **216.44 kB raw / 64.77 kB gzip**;
  - app CSS: **105.38 kB raw / 19.18 kB gzip**;
  - UI vendor: **33.63 kB raw / 11.89 kB gzip**;
  - platform SDK: **93.80 kB raw / 30.37 kB gzip**.
- Non-browser static HTTP preview: all **14/14 emitted files returned HTTP
  200**; the preview root adds one successful route. Coverage includes index
  HTML, manifest, all emitted JS/CSS chunks, launcher assets, and both
  repository stage assets.
- Served manifest reported version `2.0.0`, `stateless: false`, and zero operation-panel operations.
- Asset hashes matched [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md); the production dist contains no SVG launcher files.
- The verified production dist is byte-identical to the host copy. The generated
  catalog remains 77 entries with unique app IDs and slugs.

The Sass build emitted only upstream `@douyinfe/semi-theme-default` deprecation warnings for legacy `@import`; there was no app build error.

## Deliberately unperformed in this lane

- browser, Playwright, screenshot, or computer-use validation;
- deployment of the Next host or external Morpheus services;
- wallet connection, signature, funded transaction, or contract update;
- live confidential-store POST, secret-bearing request, or ciphertext readback;
- git stage, commit, reset, or push.

## Current release condition

The MiniApp frontend, local protocol, host store transport, and error recovery
are release-candidate complete in source. External production enablement
remains conditional: deploy the current public-key/store routes, configure the
server-only store token and project slug for each enabled network, and execute
one authorized non-sensitive store/receipt lifecycle. Until the read-only
capability reports ready, the app keeps new encryption disabled. No local
preview, zero reference, fake transaction, assumed readback, or assumed
attestation substitutes for those missing service guarantees.
