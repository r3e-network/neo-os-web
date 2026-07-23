# Timestamp Proof production status

Last reviewed: 2026-07-23

## Product flow

The production surface is a proof desk, not a generic form. The proof sheet and its source material are the dominant object; local hashing and saving are the single primary action. Receipt verification, network selection, recent records, full digests, and optional anchoring live in the secondary workspace.

The current flow supports:

1. creating a SHA-256 proof locally, with exact storage write/readback before success;
2. re-opening the device record by id, digest, or original content;
3. copying a portable JSON reference and inspecting that reference without falsely calling its claimed time public evidence;
4. optionally submitting a zero-GAS self-transfer to the exact Neo N3 GAS contract on an explicitly detected Mainnet or Testnet wallet network;
5. persisting a pre-submit retry lock and then the exact `0x` + 64-hex transaction id as `pending` before any confirmation claim;
6. recovering pending receipts without replaying the write;
7. promoting to `anchored` only after the application log is `HALT`, the GAS `Transfer` is an exact zero-value self-transfer, the raw transaction script contains the matching `timestamp-proof:<sha256>` marker, and an on-chain block time is available;
8. preserving `FAULT`, binding mismatch, pending, RPC-unavailable, corrupt-journal, and storage-unavailable states as distinct outcomes.

The source also contains a PlatformSocial Notary path with the same durable
pre-submit and pending-receipt journal. It is enabled only by an explicit
`platform-social` shared-engine manifest binding. The current production
manifest has no such binding and the retained platform ledger has no
PlatformSocial deployment record, so production behavior remains the zero-GAS
self-transfer path.

Native GAS `Hash160` arguments use the canonical script hash derived from the
wallet address. The raw-address ABI-compatibility lane is not used for this
standard native transfer. A wallet change observed while the network is being
resolved aborts before reservation or invocation.

The local certificate time is the device clock. Only a confirmed anchor's block time is presented as public chain time.

## Recovery guarantees

- A storage adapter that silently drops writes is detected by exact readback.
- A failed journal read is never rendered as a successful zero-proof state.
- A malformed journal is not overwritten by a new empty list.
- A durable `preparing` record blocks blind replay if the page closes while the wallet is submitting.
- The retry lock cannot be cleared while a wallet submission or receipt check is still running.
- If a transaction id is received but its pending receipt cannot be persisted, the exact id remains visible in the open session for copying and the action does not report success.
- An interrupted `preparing` record can be cleared only through an explicit retry-lock action after the user checks wallet history.
- Pending and interrupted proof rows cannot be deleted, and a journal containing either state cannot be cleared, until the recovery state is resolved.
- A stored `anchored` flag is downgraded to `pending` on reload and independently revalidated before the new session presents it as chain-confirmed.
- A transaction id alone is a broadcast receipt, not confirmation.

## Verification completed locally

The scoped suite covers local proof creation, storage readback failures, malformed journals, portable-reference boundaries, strict transaction ids, canonical GAS transfer arguments, malformed event hashes, invalid expected wallets, pending deletion protection, reload revalidation, pending recovery, VM `FAULT`, RPC-unavailable states, missing block time, post-broadcast persistence failure, retry locks, network gating, and the foreground proof-workspace hierarchy.

Verification evidence:

- The retained focused Timestamp Proof baseline was `132/132` across seven files; those historical focused files are not present in this checkout and were not represented as a fresh rerun.
- Current Notary wallet-binding tests passed `2/2`, app TypeScript passed, and the production Vite build completed after the dual-path migration.
- Repository regressions passed: contracts `588/588`, framework `591/591`, deploy scripts `255/255`, and miniapp suites `24/24`.
- Global miniapp dApp support gate: `77/77`, zero failures.
- Production build: Vite `7.3.6`, `3,604` modules transformed; app entry `281.44 kB` (`83.84 kB` gzip), app stylesheet `111.84 kB` (`19.93 kB` gzip).
- Static HTTP smoke: all `17/17` emitted files returned non-empty HTTP 200 responses.
- The proof-desk scene, logo, and legacy banner were opened locally. The active scene is bright and product-relevant; the legacy banner carrying a TestNet-only label remains unselected.
- The reviewed `dist` was copied to the host and remained byte-identical. Catalog verification reports 77 entries, 77 unique app IDs, and exactly one Timestamp Proof row at version `1.1.0` using `proof-desk.webp` as its banner.
- Build warnings are limited to upstream Semi UI Sass `@import` deprecations. Git index remained empty.

## External boundaries

This pass did not open a browser, connect or sign with a wallet, broadcast a transaction, deploy a contract, or run a funded TestNet flow. A release owner still needs to validate the signed Mainnet/Testnet wallet prompt and real-node receipt recovery in the approved browser/device matrix. Visual QA also remains external because this lane explicitly prohibited browser capture.
