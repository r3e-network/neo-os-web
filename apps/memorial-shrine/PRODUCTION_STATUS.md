# Memorial Shrine production status

Last verified: 2026-07-12 (Asia/Shanghai)

Status: frontend recovery and confirmation integrity are implemented; the app
is not yet fully production-ready.

## Product surface

- The memorial garden, portrait, offering dock, and memorial card are the
  primary interaction. Creation details, history, and pending transaction
  recovery remain in the secondary drawer.
- `memorial-garden.webp` and `shrine-scene-art.webp` remain the warm, bright
  visual baseline. No replacement or unverified external asset was introduced
  in this pass.
- The PlayStage exposes one primary action. The secondary mode switch and
  drawer do not duplicate manifest tabs, stats, sidebars, or operation panels.
- Missing or failed RPC reads remain distinct from a genuinely empty garden.
  Draft validation covers field limits, valid HTTPS/IPFS photo references,
  optional year ranges, and chronological order.

## Write confirmation

- Broadcast persistence records exact intent, network, contract, wallet,
  wallet hash, and transaction ID through `onTransactionSent`.
- A storage round-trip preflight runs before any wallet request. Refresh restores
  the pending write without replaying it.
- `FAULT`, unknown/unavailable, exact-event mismatch, and authoritative-readback
  pending are distinct. Success requires `HALT`, the exact expected event, and
  matching contract getters.
- Motion is driven by real preparing, broadcast, checking, and readback phases;
  the hook contains no fake transaction timer.

## Release gates

- **MainNet tribute is unavailable:** the deployed contract's `paymentHub`
  getter returned null/unconfigured in the read-only snapshot. The frontend
  blocks this path before wallet interaction. A configured and verified hub is
  required before MainNet tribute can ship.
- **Asset provenance is incomplete:** the retained garden and shrine artwork
  predate this pass, but no per-file author/source/license record was found.
  Production distribution requires owner clearance or documented replacement.
- No funded TestNet/MainNet transaction was signed, broadcast, or deployed in
  this pass. A funded signer acceptance run remains required for final release.

## Verification record

- Read-only MainNet and TestNet contract state, ABI, status getters, counts, and
  offering prices were checked against the public N3Index RPC endpoints. See
  [NETWORK_STATUS.md](./NETWORK_STATUS.md).
- Focused tests, app TypeScript, scoped lint, the app-specific frontend
  structure gate, production build, and static HTTP checks are the required
  local release checks for this pass. Final counts belong in the task handoff,
  because they can change independently of this status document.
- Browser automation, screenshots, wallet signing, transaction broadcasting,
  and deployment were intentionally outside this pass.

## Local verification

- Focused logic, PlayArea, draft, and production suite: `43/43` tests passed;
  the app-specific structure gate also passed.
- TypeScript, scoped ESLint, and whitespace validation passed.
- Production build: 1,848 modules; app entry 218.81 kB (66.52 kB gzip), with
  React, UI, platform SDK, and crypto split into vendor chunks.
- Static HTTP verification: all `16/16` emitted files returned HTTP 200.
- Verified `dist/` was copied to the host miniapp directory and is byte-identical.
- Host catalog: 77 entries, 77 unique app IDs, one `miniapp-memorial-shrine` at version `1.1.0`.
