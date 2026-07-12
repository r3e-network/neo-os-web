# Neo Message Production Status

Version **1.2.0** promotes the existing sealed-mail visual design to an honest,
recoverable Neo X message product.

## Completed

- Mail-desk-first responsive UI with real project imagery, bright foregrounds,
  compact controls, reduced-motion support, and secondary-detail containment.
- Correct private-open labelling for recipient-only messages.
- BigInt-safe mailbox ordering and all-or-preserve list refresh semantics.
- Exact mainnet-only network gating, account-transition mailbox clearing, and
  independently paged inbox/outbox lists with every loaded row reachable.
- Exact `MessageSent` event extraction followed by authoritative contract
  readback before success.
- Durable post-broadcast recovery with wallet, receipt status, event topic, and
  contract-state checks, including exact transaction/from/to/log binding.
- Fresh-key fail-closed message sealing, bounded validated private-open cache,
  verified reveal-request events, and handled dispatch failures.
- Host CORS bridge for oracle key retrieval and recipient reveal from the
  sandboxed MiniApp frame.
- Stateful manifest declaration, production boundary documentation, and
  targeted tests for UI, cache semantics, recovery, and host API behavior.

## Runtime boundary

The application code and read-only runtime gates are production-prepared for
the declared Neo X mainnet deployment. Runtime availability is still external:
a failed key or reveal request remains a clear retryable failure and is never
converted into an empty value or successful message state. A fresh, non-secret
wallet-backed send/private-open/timed-reveal lifecycle remains a release-owner
gate because this pass was explicitly read-only.

## Verification evidence (2026-07-11)

- App logic: 19/19 tests passed for ABI decoding, compose rules, message states
  and durable delivery recovery.
- Shared UI/cache: 30/30 tests passed for the mail-desk surface, action wiring,
  device-local plaintext semantics and storage failure behavior.
- Shared EVM account/broadcast boundary: 9/9 tests passed, including the
  pre-broadcast active-account lock used by Neo Message.
- Companion integration, operation-state, i18n, and stateful-manifest gates:
  103/103 tests passed. The stateful-manifest gate was run from its required
  `apps/shared` working directory.
- Host oracle bridge: 10/10 API tests passed for public-key and recipient-reveal
  routes.
- TypeScript and ESLint passed for the app, focused shared tests and host API
  bridge.
- Production build: 1,850 modules transformed in 4.80 seconds; app entry
  208.16 kB (63.43 kB gzip), with React, UI, platform SDK and crypto separated
  into vendor chunks.
- Runtime artwork and its repository lineage are recorded in
  `ASSET_PROVENANCE.md`.
- HTTP/MIME smoke: every one of the 16 emitted production files returned HTTP
  200 with the expected content type; the root route also returned HTML 200.
- Source/dist fidelity: all eight public assets plus `neo-manifest.json` are
  byte-identical in `dist/`; the built Open Graph image points at the warm
  sealed-mail desk.
- Read-only live evidence: chain ID `0xba93`, 4,303-byte contract runtime,
  canonical empty mailbox reads, operational Morpheus status, 32-byte public
  key, and previously revealed time-locked message `#4` all verified.
- dApp support gate: 77/77 manifests checked with zero failures.
- Host integration intentionally remains pending in this lane: host assets and
  catalog still contain version `1.1.0` and the legacy banner until the parent
  integration pass copies this dist and regenerates the catalog.
- Git index remained empty; no files were staged or committed.
