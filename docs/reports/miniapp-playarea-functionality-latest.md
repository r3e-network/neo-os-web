# MiniApp PlayArea Functionality Audit

Generated: 2026-07-08T06:27:43.370Z

## Summary

- Total active miniapps: 72
- UI workflow surface present: 72
- Needs follow-up: 0

## Platform Surface Coverage

- custom native playarea: 20
- oracle console playarea: 6
- profiled host + embedded real dApp: 46

## Business Effect Evidence

- api_intent: 1
- local_preview: 1
- wallet_intent: 70

## Host Action Effect

- api_intent: 1
- local_preview: 60
- wallet_intent: 11

## Gaps

- No catalog-level PlayArea functionality gaps detected by this audit.

## App Matrix

| App | Surface | Built | Standalone | Controls | Actions | Business Effect | Host Action | Evidence | Status |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| miniapp-aa-account-lab | profiled host + embedded real dApp | yes | yes | 5 | 7 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-market-hub | profiled host + embedded real dApp | yes | yes | 8 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-permissions-lab | profiled host + embedded real dApp | yes | yes | 8 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-relay-console | profiled host + embedded real dApp | yes | yes | 3 | 11 | wallet_intent | api_intent | built-static-dapp, standalone-playarea, host-embeds-real-dapp, host-managed-api-operation, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-session-key-lab | profiled host + embedded real dApp | yes | yes | 10 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aim-master | profiled host + embedded real dApp | yes | yes | 6 | 26 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-asset-factory | profiled host + embedded real dApp | yes | yes | 32 | 24 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-automation-copilot | profiled host + embedded real dApp | yes | yes | 1 | 5 | api_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, automation-api-workflow, action-handlers, interactive-controls | usable-surface-present |
| miniapp-breakupcontract | profiled host + embedded real dApp | yes | yes | 9 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-burn-league | profiled host + embedded real dApp | yes | yes | 9 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-color-clash | profiled host + embedded real dApp | yes | yes | 10 | 21 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-council-governance | custom native playarea | yes | yes | 14 | 22 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, live-api-call, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-curve-arrow | profiled host + embedded real dApp | yes | yes | 3 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-custom-anchor | custom native playarea | yes | yes | 12 | 36 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dailycheckin | custom native playarea | yes | yes | 4 | 8 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dev-tipping | profiled host + embedded real dApp | yes | yes | 10 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dice-game | custom native playarea | yes | yes | 8 | 22 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-event-ticket-pass | profiled host + embedded real dApp | yes | yes | 13 | 21 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-explorer | custom native playarea | yes | yes | 3 | 20 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, registered-actions, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-flappy-dash | profiled host + embedded real dApp | yes | yes | 11 | 35 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-flashloan | profiled host + embedded real dApp | yes | yes | 8 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-fogplay | custom native playarea | yes | yes | 5 | 25 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-forever-album | custom native playarea | yes | yes | 11 | 22 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, native-action-board, wallet-write-intent, file-upload, action-handlers, interactive-controls | usable-surface-present |
| miniapp-game-2048 | profiled host + embedded real dApp | yes | yes | 9 | 29 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gas-lucky-pool | custom native playarea | yes | yes | 14 | 35 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, live-api-call, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gas-sponsor | profiled host + embedded real dApp | yes | yes | 1 | 1 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gasbox | custom native playarea | yes | yes | 5 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gov-merc | profiled host + embedded real dApp | yes | yes | 12 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-graveyard | profiled host + embedded real dApp | yes | yes | 14 | 25 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-jump-rush | profiled host + embedded real dApp | yes | yes | 6 | 31 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, live-api-call, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-last-survivor | custom native playarea | yes | yes | 7 | 25 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-memorial-shrine | profiled host + embedded real dApp | yes | yes | 6 | 9 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-merge-kingdom | profiled host + embedded real dApp | yes | yes | 8 | 25 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-milestone-escrow | profiled host + embedded real dApp | yes | yes | 11 | 13 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-miniapp-factory | profiled host + embedded real dApp | yes | yes | 32 | 24 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-convert | profiled host + embedded real dApp | yes | yes | 1 | 3 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, client-crypto-workflow, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-message | profiled host + embedded real dApp | yes | yes | 5 | 10 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-multisig | profiled host + embedded real dApp | yes | yes | 14 | 22 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-ns | profiled host + embedded real dApp | yes | yes | 6 | 14 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, live-api-call, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-pay | custom native playarea | yes | yes | 13 | 20 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-pay-shared-example | profiled host + embedded real dApp | yes | yes | 8 | 13 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-sign-anything | profiled host + embedded real dApp | yes | yes | 7 | 10 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-signature-workflow, wallet-write-intent, file-upload, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-swap | profiled host + embedded real dApp | yes | yes | 10 | 22 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-treasury | profiled host + embedded real dApp | yes | yes | 1 | 7 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, chain-read-workflow, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-x-bridge | custom native playarea | yes | yes | 11 | 11 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neodid-passport | profiled host + embedded real dApp | yes | yes | 6 | 8 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, identity-resolve-workflow, wallet-signature-workflow, action-handlers, interactive-controls | usable-surface-present |
| miniapp-nft-factory | profiled host + embedded real dApp | yes | yes | 32 | 24 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-onchaintarot | custom native playarea | yes | yes | 9 | 38 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-compute-lab | oracle console playarea | yes | yes | 15 | 18 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-http-console | oracle console playarea | yes | yes | 15 | 18 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-neodid-console | oracle console playarea | yes | yes | 9 | 11 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-price-console | oracle console playarea | yes | yes | 10 | 9 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-seal-console | oracle console playarea | yes | yes | 9 | 10 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-vrf-console | oracle console playarea | yes | yes | 18 | 23 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-pet-potion | profiled host + embedded real dApp | yes | yes | 8 | 28 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-private-transfer | custom native playarea | yes | yes | 5 | 5 | wallet_intent | wallet_intent | built-static-dapp, standalone-playarea, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-profitanchor | custom native playarea | yes | yes | 11 | 25 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-profitanchor-admin | custom native playarea | yes | yes | 11 | 21 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-quadratic-funding | profiled host + embedded real dApp | yes | yes | 14 | 21 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-recovery-guardian | profiled host + embedded real dApp | yes | yes | 9 | 15 | local_preview | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-redenvelope | custom native playarea | yes | yes | 18 | 35 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-self-loan | custom native playarea | yes | yes | 9 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-sheep-solitaire | profiled host + embedded real dApp | yes | yes | 10 | 40 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, live-api-call, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-snake-bounty | profiled host + embedded real dApp | yes | yes | 6 | 27 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-soulbound-certificate | profiled host + embedded real dApp | yes | yes | 9 | 15 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |
| miniapp-sudoku | profiled host + embedded real dApp | yes | yes | 9 | 30 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-time-capsule | profiled host + embedded real dApp | yes | yes | 8 | 16 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-timestamp-proof | profiled host + embedded real dApp | yes | yes | 5 | 8 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-trustanchor | custom native playarea | yes | yes | 11 | 25 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-trustanchor-admin | custom native playarea | yes | yes | 11 | 21 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-unbreakablevault | profiled host + embedded real dApp | yes | yes | 12 | 20 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, host-embeds-real-dapp, wallet-write-intent, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-wallet-health | profiled host + embedded real dApp | yes | yes | 2 | 7 | wallet_intent | local_preview | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, wallet-write-intent, action-handlers, interactive-controls | usable-surface-present |

> Scope: this audit verifies that every catalog miniapp has a built standalone dApp, a host surface, and detectable UI workflow evidence from source, manifest operations, or native playarea logic. `local_preview` means the app only opens or updates a local workspace. `local_business_logic` means the user can complete the app's business workflow locally without a chain transaction, such as client-side cryptography. `chain_read` means the user can complete a read-only blockchain workflow with live RPC/API reads and no wallet transaction. `api_intent` means the app or host action is backed by a platform API proxy or host-mediated service gateway. `wallet_intent` means a wallet or transaction intent path is present. This does not replace live mainnet/testnet signer execution or post-state verification for flows that require funded wallets or admin authority.
