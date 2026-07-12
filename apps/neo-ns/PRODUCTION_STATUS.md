# Neo Name Service production status

Version: 1.1.0

## Completed

- Focused, warm registry desk with one primary naming journey and secondary lifecycle management.
- Existing project-local naming artwork plus shared official NEO/GAS token art.
- Mainnet/testnet/contract binding with mismatch rejection.
- Contract-exact name validation and exact Fixed8 pricing.
- Strict availability, owner, expiry, target, and owned-name hydration.
- Duplicate, malformed, oversized, or property-name-less owned-token rows are rejected before an ambiguous list can reach the UI.
- Reserved-name handling without fabricated owners.
- Registration preflight; renewal quote review; transfer review.
- Public wallet-free search with positive wallet-network detection required for every write.
- Query-generation invalidation prevents stale responses from replacing the latest name.
- Recovery-storage write/read/delete preflight before wallet invocation; copyable pending txids afterward.
- Expired-name labeling, complete owned-name access, and duplicate target-update suppression.
- Durable pending receipt, FAULT handling, retryable recovery, exact event matching, and authoritative readback.
- Read failure preservation: verified lists are retained instead of being replaced by empty/zero placeholders.
- Targeted app and shared NeoNS suites: `49/49` tests passed. NeoNS i18n passed `1/1`, official token art passed `5/5`, TypeScript and ESLint passed, and the AA/NeoNS structure gate passed `3/3`.
- Lightweight native registry controls keep the full Semi UI JavaScript runtime out of the app-owned interaction layer. The final shared-chunk build transforms 1,852 modules in 5.59 seconds; the main bundle is 219.27 kB (67.31 kB gzip), UI JavaScript is 32.40 kB (11.53 kB gzip), and CSS is 106.76 kB (19.36 kB gzip).
- HTTP smoke: all `16/16` emitted files plus the root route returned HTTP 200 (`17/17` requests); all public assets plus the manifest are byte-identical between source and `dist/` (`9/9`).
- Source and emitted manifest SHA-256: `019160d8a4879e852d419ebede69e6056e1ae44e5c9cf2f3b1e74274a29f7ac0`.
- Global dApp support: `77` checked, `0` failures. Parent release synchronization copied the final dist byte-for-byte into the host and regenerated a `77/77` catalog with unique app IDs/slugs, one NeoNS `1.1.0` row, and the real registry scene as its banner.
- Git index remained empty; no files were staged or committed.

## Runtime boundary

- Writes require a user-connected Neo wallet and the network-specific official NNS contract.
- This production pass did not sign or submit any wallet transaction.
- Exact write-path verification is covered with deterministic receipt/readback tests; live funded write testing remains an operator action.
- Existing launcher, logo, and registry-desk rasters were inspected locally. Browser automation and rendered screenshot approval are outside this lane.
- The real registry-desk scene now also owns the catalog banner and social preview instead of the generic launcher composition, and every UI dispatch rejection is handled after the shared toast path.
