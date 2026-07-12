# Developer Tipping network status

Status reviewed in code on 2026-07-12. No live RPC request, wallet prompt, transaction, funded action, deployment, or contract update was performed in this pass.

## Published binding baseline

The prior read-only verification recorded `MiniAppTipJar` at `0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec` on Neo N3 MainNet and TestNet.

| Binding | MainNet | TestNet |
| --- | --- | --- |
| Network magic | `860833102` | `894710606` |
| Manifest name | `MiniAppTipJar` | `MiniAppTipJar` |
| NEF checksum | `2483335541` | `2483335541` |
| Update counter | `0` | `0` |
| `minTip()` | `100000` | `100000` |

The point-in-time registry observations from 2026-07-11 remain documented in `TESTNET-STATUS.md`; they are not compiled into the interface as seed data.

## Runtime behavior

- Walletless discovery still verifies the active network, contract hash, checksum, update counter, ABI, minimum tip, and bounded registry count before showing chain data as ready.
- Every write snapshots the connected account, network, contract, and exact user input, then rechecks the binding immediately before broadcast and after asynchronous verification reads.
- Only exact `0x`-prefixed 64-byte transaction IDs are journaled.
- A broadcast is kept pending until its expected event and authoritative state readback agree. `FAULT`, HALT without an indexed event, readback lag, stale receipts, and confirmed stranded credit remain distinct states.
- A stale receipt is still queried for its exact event and VM outcome; age never
  turns a recoverable transaction into a permanently unresolvable local state.
- The receipt record is a durable fallback guard if the primary pending key is
  unavailable, and cleanup must pass an exact deletion readback before another
  wallet write can start.
- MainNet and TestNet recovery journals are isolated by network, contract, and sender.

## Remaining external acceptance

A funded TestNet wallet smoke is still an external acceptance step. It must cover register, partial-credit tip, full-credit tip, developer withdrawal, credit withdrawal, wallet/network switching, and refresh recovery without reusing a production account secret in the repository.
