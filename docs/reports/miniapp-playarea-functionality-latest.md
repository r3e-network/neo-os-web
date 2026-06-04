# MiniApp PlayArea Functionality Audit

Generated: 2026-06-02T03:52:34.596Z

## Summary

- Total active miniapps: 60
- UI workflow surface present: 60
- Needs follow-up: 0

## Platform Surface Coverage

- custom native playarea: 20
- oracle console playarea: 6
- profiled host + embedded real dApp: 34

## Business Effect Evidence

- api_intent: 1
- local_business_logic: 1
- wallet_intent: 58

## Host Action Effect

- api_intent: 1
- local_preview: 43
- wallet_intent: 16

## Gaps

- No catalog-level PlayArea functionality gaps detected by this audit.

## App Matrix

| App | Surface | Built | Standalone | Controls | Actions | Business Effect | Host Action | Evidence | Status |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| miniapp-aa-account-lab | profiled host + embedded real dApp | yes | yes | 11 | 9 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-market-hub | profiled host + embedded real dApp | yes | yes | 17 | 24 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-permissions-lab | profiled host + embedded real dApp | yes | yes | 9 | 12 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-relay-console | profiled host + embedded real dApp | yes | yes | 8 | 15 | wallet_intent | api_intent | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, host-managed-api-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-session-key-lab | profiled host + embedded real dApp | yes | yes | 13 | 13 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-asset-factory | profiled host + embedded real dApp | yes | yes | 22 | 7 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-automation-copilot | profiled host + embedded real dApp | yes | yes | 10 | 15 | api_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, automation-api-workflow, action-handlers, interactive-controls | usable-surface-present |
| miniapp-breakupcontract | profiled host + embedded real dApp | yes | yes | 11 | 11 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-burn-league | profiled host + embedded real dApp | yes | yes | 5 | 10 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-council-governance | custom native playarea | yes | yes | 16 | 18 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-custom-anchor | custom native playarea | yes | yes | 7 | 27 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dailycheckin | custom native playarea | yes | yes | 6 | 14 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dev-tipping | profiled host + embedded real dApp | yes | yes | 10 | 10 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, host-funded-wallet-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dice-game | custom native playarea | yes | yes | 5 | 10 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-event-ticket-pass | profiled host + embedded real dApp | yes | yes | 23 | 36 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-explorer | custom native playarea | yes | yes | 6 | 21 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-flashloan | profiled host + embedded real dApp | yes | yes | 8 | 14 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-fogplay | custom native playarea | yes | yes | 6 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-forever-album | custom native playarea | yes | yes | 16 | 32 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, native-action-board, wallet-write-intent, file-upload, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gas-lucky-pool | custom native playarea | yes | yes | 19 | 29 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gas-sponsor | profiled host + embedded real dApp | yes | yes | 9 | 10 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gasbox | custom native playarea | yes | yes | 7 | 24 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gov-merc | profiled host + embedded real dApp | yes | yes | 7 | 9 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-graveyard | profiled host + embedded real dApp | yes | yes | 8 | 19 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-last-survivor | custom native playarea | yes | yes | 7 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-memorial-shrine | profiled host + embedded real dApp | yes | yes | 15 | 15 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, host-funded-wallet-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-milestone-escrow | profiled host + embedded real dApp | yes | yes | 15 | 22 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-miniapp-factory | profiled host + embedded real dApp | yes | yes | 22 | 7 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-convert | profiled host + embedded real dApp | yes | yes | 8 | 17 | local_business_logic | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, client-crypto-workflow, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-multisig | profiled host + embedded real dApp | yes | yes | 13 | 11 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-ns | profiled host + embedded real dApp | yes | yes | 11 | 21 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-pay | custom native playarea | yes | yes | 11 | 16 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, native-action-board, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-pay-shared-example | profiled host + embedded real dApp | yes | yes | 13 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-sign-anything | profiled host + embedded real dApp | yes | yes | 11 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-signature-workflow, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-swap | profiled host + embedded real dApp | yes | yes | 12 | 29 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-treasury | profiled host + embedded real dApp | yes | yes | 9 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, chain-read-workflow, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-x-bridge | custom native playarea | yes | yes | 27 | 21 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, native-action-board, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neodid-passport | profiled host + embedded real dApp | yes | yes | 9 | 11 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, identity-resolve-workflow, wallet-signature-workflow, action-handlers, interactive-controls | usable-surface-present |
| miniapp-nft-factory | profiled host + embedded real dApp | yes | yes | 22 | 7 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-onchaintarot | custom native playarea | yes | yes | 7 | 20 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-compute-lab | oracle console playarea | yes | yes | 15 | 14 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-http-console | oracle console playarea | yes | yes | 15 | 13 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-neodid-console | oracle console playarea | yes | yes | 15 | 14 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-price-console | oracle console playarea | yes | yes | 10 | 11 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-seal-console | oracle console playarea | yes | yes | 15 | 14 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-vrf-console | oracle console playarea | yes | yes | 15 | 13 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-private-transfer | custom native playarea | yes | yes | 12 | 8 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-profitanchor | custom native playarea | yes | yes | 6 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-profitanchor-admin | custom native playarea | yes | yes | 10 | 19 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-quadratic-funding | profiled host + embedded real dApp | yes | yes | 27 | 31 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-recovery-guardian | profiled host + embedded real dApp | yes | yes | 16 | 24 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, host-funded-wallet-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-redenvelope | custom native playarea | yes | yes | 9 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-self-loan | custom native playarea | yes | yes | 8 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-soulbound-certificate | profiled host + embedded real dApp | yes | yes | 25 | 34 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-time-capsule | profiled host + embedded real dApp | yes | yes | 9 | 9 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, host-funded-wallet-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-timestamp-proof | profiled host + embedded real dApp | yes | yes | 10 | 19 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-trustanchor | custom native playarea | yes | yes | 6 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-trustanchor-admin | custom native playarea | yes | yes | 10 | 19 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-unbreakablevault | profiled host + embedded real dApp | yes | yes | 11 | 19 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, host-funded-wallet-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-wallet-health | profiled host + embedded real dApp | yes | yes | 7 | 10 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |

> Scope: this audit verifies that every catalog miniapp has a built standalone dApp, a host surface, and detectable UI workflow evidence from source, manifest operations, or native playarea logic. `local_preview` means the app only opens or updates a local workspace. `local_business_logic` means the user can complete the app's business workflow locally without a chain transaction, such as client-side cryptography. `chain_read` means the user can complete a read-only blockchain workflow with live RPC/API reads and no wallet transaction. `api_intent` means the app or host action is backed by a platform API proxy or host-mediated service gateway. `wallet_intent` means a wallet or transaction intent path is present. This does not replace live mainnet/testnet signer execution or post-state verification for flows that require funded wallets or admin authority.
