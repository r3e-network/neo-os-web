# GasBox network status

Read-only observation date: 2026-07-12

| Check | Neo N3 MainNet | Neo N3 TestNet |
| --- | --- | --- |
| RPC | `https://api.n3index.dev/mainnet` | `https://api.n3index.dev/testnet` |
| Contract | `0x30e9d4a4758827361c3b51a0e8460b067e58b1db` | `0x30e9d4a4758827361c3b51a0e8460b067e58b1db` |
| Contract name | `MiniAppGasBoxV2` | `MiniAppGasBoxV2` |
| Update counter | `0` | `0` |
| Contract id | `610` | `7356` |
| `lastMachineId` | `0` | `0` |
| `lastBetId` | `0` | `0` |
| `pendingBetCount` | `0` | `0` |
| ABI `update` method | missing | missing |
| Write compatibility | blocked | blocked |

The observed ABI includes `commit`, `settle`, `withdraw`, `withdrawPool`, `playCreditOf`, `pendingBetCount`, `getMachine` and `getItem`. It does not include the current local source/build's `update` method. The deployed manifest extra describes settle-block `Runtime.GetRandom`; the repository revision with that same ABI shape is the pre-fixed-beacon implementation. This is the evidence for the frontend compatibility gate.

Zero machines is a valid live empty state. The frontend does not fabricate samples. Browsing and recovery writes remain available; new pulls, publishing, pool top-ups and activation stay disabled.

Recovery condition: deploy the fixed `commitIndex + 1` beacon artifact as a new contract, verify its live identity/ABI, then update both registry and miniapp manifest bindings.

No funded transaction, deployment or contract update was performed for these observations.
