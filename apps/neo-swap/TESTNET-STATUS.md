# Neo Swap network status

Last reviewed: 2026-07-12

## Current gate: quote-only

- `neo-manifest.json` declares no app or swap-router contract.
- The public Morpheus quote path is enabled through the shared canonical network registry.
- Wallet balance reads are optional and use raw NEP-17 base units.
- Swap submission is fail-closed because no production settlement binding exists.
- `payments` is disabled in the runtime manifest, and the public manifest exposes read-only blockchain permission only.

This pass does not claim a live mainnet or testnet swap. A route cannot be enabled until its contract, operation, output-depth semantics and confirmation event have completed the product-readiness matrix below.

## Required before settlement

- Deploy and review the router implementation, then record its network-specific script hash.
- Confirm the operation and argument order against the deployed contract manifest.
- Define a `SwapExecuted` validator that proves the event belongs to the exact txid, wallet, input asset, output asset, input amount and enforced minimum output.
- Verify executable route output, price impact, liquidity depth, fees, deadline behavior and integer minimum-output enforcement.
- Exercise positive, expired, stale-quote, insufficient-liquidity, insufficient-output, rejection and refresh-recovery cases.
- Add the router to the app manifest/registry and enable payment/invoke permission only after those checks pass.
- Complete a chosen-browser wallet pass covering quote refresh, account/network switching, confirmation, event-backed completion, rejected transactions and persisted recovery.

## Read-only RPC snapshot

Direct JSON-RPC reads at 2026-07-12 09:13 CST confirmed:

- Mainnet RPC reported magic `860833102`; `MorpheusDataFeed` is deployed at `0x03013f49c42a14546c8bbe58f9d434c3517fccab` with NEF checksum `250860605`.
- Testnet RPC reported magic `894710606`; `MorpheusDataFeed` is deployed at `0x9bea75cf702f6afc09125aa6d22f082bfd2ee064` with NEF checksum `2123305412`.
- `getLatest(String)` returned `HALT` for every inspected record with no VM exception.
- `AGG:NEO-USD` and `AGG:GAS-USD` were zero-valued placeholders on both networks, so the app correctly uses the explicit provider fallback.
- Mainnet provider records were `NEO 1.960000` at on-chain record time `2026-07-12 09:06:41 CST` and `GAS 1.062300` at `09:11:51 CST`; both were inside the ten-minute window at capture time.
- Testnet provider records were `NEO 1.959000` with a fresh on-chain record at `09:12:39 CST`, and `GAS 1.039600` with record time `2026-07-10 16:32:38 CST` (about `40.7` hours old).
- The testnet NEO/GAS cross-rate therefore correctly resolves as stale because the older GAS leg exceeds the freshness window. Its March upstream-source timestamps remain display metadata and do not override the on-chain write-time rule.

No browser, wallet signature or transaction was used for this snapshot.
