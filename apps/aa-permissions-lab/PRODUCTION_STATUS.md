# AA Permissions production status

Version: `2.0.0`

## Product result

- The primary surface is a live account permission passport and lifecycle,
  not a large hash form. Account/target fields and raw technical data remain in
  secondary settings.
- The interface is warm, bright, high-contrast, responsive, and uses the
  existing product-specific permission-console artwork.
- Exactly one contextual action is promoted: inspect, connect owner, install,
  propose, wait, confirm, or recover. Cancel appears only for a pending lane.
- Verifier and hook are distinct lanes with accurate first-install and
  replacement behavior.

## Runtime result

- Reads are bound to the launch network and canonical network-specific AA Core.
- A snapshot is accepted only when all seven reads decode and pending flags
  agree with their millisecond unlock times. Failure clears prior state.
- Every write rechecks the exact wallet network and freshly reads the registered
  backup owner. A changed account hash invalidates the previous snapshot.
- Broadcast transaction IDs are persisted with network, core, account, owner,
  operation, lane, target, previous binding, event, and timestamp.
- Broadcast is never reported as confirmed without exact event/state evidence.
  Recovery checks the saved transaction and never replays it.
- A saved transaction is cleared as failed only when `getapplicationlog`
  proves VM FAULT; an unavailable log remains recoverable.
- Storage failure locks writes before signing; a post-broadcast storage failure
  leaves the transaction ID visible in the current session.

## Acceptance boundary

Both canonical deployments, ABIs, and representative read-only account states
were verified on 2026-07-11; see [NETWORK_STATUS.md](./NETWORK_STATUS.md).
No browser/screenshot comparison, wallet signature, funded Testnet transaction,
deployment, or contract update was authorized for this lane, so those are not
claimed.

## Verification evidence

- Focused logic, composable, integration, and PlayArea suite: `25/25` tests passed in one serial worker.
- TypeScript and ESLint passed for the app, four focused test files, and directly affected structure/style gates.
- AA Permissions structure and launch-network gates: `2/2` passed.
- Production build: Vite `7.3.2`, `1,845` modules transformed in `2.80s`.
- App entry: `211.83 kB` (`63.30 kB` gzip); UI vendor: `33.16 kB` (`11.76 kB` gzip); CSS: `101.71 kB` (`18.63 kB` gzip).
- Non-browser HTTP smoke: all `15/15` emitted files returned `200`; entry HTML, JSON manifest, and WebP artwork returned the expected MIME types.
- Source/dist manifest, permission artwork, logo, and banner are byte-identical. Manifest SHA-256: `a31a2bc4d249a678435e28800944684331197948bb2350c98dc8be4208d5240d`.
- The Git index remained untouched; no file was staged or committed.
