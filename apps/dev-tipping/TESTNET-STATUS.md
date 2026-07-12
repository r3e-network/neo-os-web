# Dev Tipping network status

This point-in-time TestNet observation is retained for historical evidence. The current network acceptance boundary and production recovery behavior are documented in `NETWORK_STATUS.md`.

Read-only verification date: 2026-07-11.

## Published contract

`MiniAppTipJar` is present at `0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec` on both Neo N3 MainNet and TestNet.

| Check | MainNet | TestNet |
| --- | --- | --- |
| Network magic | `860833102` | `894710606` |
| Manifest name | `MiniAppTipJar` | `MiniAppTipJar` |
| NEF checksum | `2483335541` | `2483335541` |
| Update counter | `0` | `0` |
| `minTip()` | `100000` | `100000` |
| `totalDevelopers()` | `0` | `2` |
| `totalDonated()` | `0` | `30000000` |
| `tipsCount()` | `0` | `1` |

TestNet developer `#2` read back with `totalReceived=30000000`, `tipCount=1`, and `balance=0` at verification time. Those values are a point-in-time observation, not seed data compiled into the UI.

## Acceptance boundary

- Contract hash, checksum, update counter, method signatures, event signatures, `minTip`, and registry reads were verified with read-only RPC calls.
- No wallet transaction, deployment, contract update, key access, or token transfer was performed.
- The UI now fails closed when contract attestation, wallet network detection, credit read, GAS balance read, or recipient readback is unavailable.
- A new funded TestNet write was not executed in this pass. Exact event/readback recovery is covered by deterministic tests, but a funded wallet smoke remains an external acceptance step.
