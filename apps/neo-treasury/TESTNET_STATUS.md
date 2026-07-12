# Neo Treasury Testnet Status

Verified read-only on 2026-07-12. No private key was used and no transaction was broadcast in this pass.

## Deployment status

- App-specific treasury contract: **not configured**.
- `neo-manifest.json` `contracts`: empty by design.
- Execution model: direct connected-wallet invocation of Neo native NEO/GAS contracts.
- Proposal, quorum, admin role, timelock, and proposal expiry ABI: **not available**.

## Live native-contract ABI

Read from `https://testnet1.neo.coz.io:443` with `getcontractstate`:

| Contract | Hash | Required safe read | Required write | Required event |
| --- | --- | --- | --- | --- |
| `NeoToken` (`NEO`, 0 decimals) | `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5` | `balanceOf(Hash160) -> Integer` | `transfer(Hash160, Hash160, Integer, Any) -> Boolean` | `Transfer(Hash160, Hash160, Integer)` |
| `GasToken` (`GAS`, 8 decimals) | `0xd2a4cff31913016155e38e474a2c06d08be276cf` | `balanceOf(Hash160) -> Integer` | `transfer(Hash160, Hash160, Integer, Any) -> Boolean` | `Transfer(Hash160, Hash160, Integer)` |

Both `balanceOf` methods reported `safe: true`; both `transfer` methods reported `safe: false`. Live `symbol`/`decimals` reads returned `NEO`/`0` and `GAS`/`8` with `HALT`. The same hashes, values, and method/event shapes were also read from `https://mainnet2.neo.coz.io:443`.

## Frontend settlement contract

The Testnet transfer path is production-fail-closed around these invariants:

1. Selected app network and wallet-reported network must both be Neo N3 Testnet.
2. Token hash is derived only from the selected `NEO` or `GAS` asset.
3. Sender is derived only from the connected wallet; recipient and amount are normalized before signing.
4. The broadcast txid and the complete intent binding are persisted at the `onTransactionSent` boundary.
5. N3Index `nep17_transfers` must contain an exact row for txid, Testnet, native token hash, sender, recipient, and base-unit amount.
6. Both sender and recipient native `balanceOf` states must be consistent with the saved pre-transfer baseline before the UI uses confirmed-success language. One-sided movement remains `readback-pending`.
7. Missing index data, unavailable reads, mismatches, and readback lag remain recoverable pending/error states. Recovery never rebroadcasts.

## Remaining live proof

A funded Testnet wallet broadcast was intentionally not performed in this pass. The next live acceptance check should send a minimal amount to a separately controlled Testnet recipient, then capture the exact indexed transfer row and both post-transfer balances. Until that evidence exists, this file proves ABI/read readiness and fail-closed frontend behavior, not a completed funded transfer.
