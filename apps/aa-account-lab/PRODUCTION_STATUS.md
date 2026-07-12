# AA Account Lab production status

Reviewed: 2026-07-11

## Product behavior

- Warm, high-contrast account-control scene uses the real
  `account-control-center.webp` product artwork as the primary resource.
- Recovery strategies and the connected owner are first-class objects; raw
  hashes remain in the secondary drawer.
- The UI derives the same registration-bound `AccountId` as AA Core from the
  verifier, verifier parameters, hook, owner, and timelock.
- The canonical Web3Auth path blocks registration until a valid 65-byte
  uncompressed secp256k1 public key is present.
- Wallet, launch network, canonical AA Core, verifier, and backup-owner signer
  are checked before a write.
- A broadcast transaction is persisted immediately and remains pending across
  refreshes. Success requires exact VM, event, and five-field readback evidence.
- VM FAULT clears the failed pending record. Unknown RPC state, mismatched
  evidence, read-node lag, wrong network, or wrong owner remain recoverable and
  never become a false success.
- Mainnet and testnet warnings name the actual active network instead of showing
  fixed mainnet copy.

## Verification

- Focused Vitest: 21/21 passing across composable, registration evidence,
  product integration, and PlayArea behavior.
- TypeScript: `tsc --noEmit --incremental false` passes.
- ESLint: app source and all focused tests pass with no warnings.
- Production build: 1,846 modules; app entry 206.12 kB (63.18 kB gzip),
  OpenUiLite vendor 31.59 kB (11.29 kB gzip), and CSS 105.06 kB
  (18.96 kB gzip).
- Static preview: all 16 files in `dist/` returned HTTP 200, and the copied
  MiniApp OS host directory is byte-identical to the build output.
- Read-only live RPC: mainnet and testnet AA Core manifests expose the exact
  six-argument `registerAccount` ABI and four-field `AccountRegistered` event.
- Contract derivation vector: both networks return
  `0x27c01243fca45e1b821dc3bb45267a579762d530`, matching the shared frontend
  helper for the recorded test vector.

No wallet signing, funded transaction, contract deployment, or state-changing
network action was performed during this product pass.
