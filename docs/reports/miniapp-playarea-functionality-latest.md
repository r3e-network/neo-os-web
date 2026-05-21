# MiniApp PlayArea Functionality Audit

Generated: 2026-05-21T01:52:43.062Z

## Summary

- Total active miniapps: 60
- Real workflow coverage present: 60
- Needs follow-up: 0

## Platform Surface Coverage

- custom native playarea: 20
- oracle console playarea: 6
- profiled host + embedded real dApp: 34

## Gaps

- No catalog-level PlayArea functionality gaps detected by this audit.

## App Matrix

| App | Surface | Built | Standalone | Controls | Actions | Evidence | Status |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| miniapp-aa-account-lab | profiled host + embedded real dApp | yes | yes | 11 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-market-hub | profiled host + embedded real dApp | yes | yes | 17 | 24 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-permissions-lab | profiled host + embedded real dApp | yes | yes | 8 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-relay-console | profiled host + embedded real dApp | yes | yes | 7 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-aa-session-key-lab | profiled host + embedded real dApp | yes | yes | 10 | 12 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-asset-factory | profiled host + embedded real dApp | yes | yes | 22 | 7 | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-automation-copilot | profiled host + embedded real dApp | yes | yes | 6 | 5 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-breakupcontract | profiled host + embedded real dApp | yes | yes | 9 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-burn-league | profiled host + embedded real dApp | yes | yes | 3 | 5 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-council-governance | custom native playarea | yes | yes | 16 | 18 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, action-handlers, interactive-controls | usable-surface-present |
| miniapp-custom-anchor | custom native playarea | yes | yes | 1 | 15 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dailycheckin | custom native playarea | yes | yes | 5 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dev-tipping | profiled host + embedded real dApp | yes | yes | 9 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-dice-game | custom native playarea | yes | yes | 1 | 4 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-event-ticket-pass | profiled host + embedded real dApp | yes | yes | 4 | 12 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-explorer | custom native playarea | yes | yes | 6 | 16 | built-static-dapp, standalone-playarea, registered-actions, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-flashloan | profiled host + embedded real dApp | yes | yes | 6 | 7 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-fogplay | custom native playarea | yes | yes | 5 | 20 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-forever-album | custom native playarea | yes | yes | 14 | 29 | built-static-dapp, standalone-playarea, registered-actions, native-action-board, file-upload, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gas-lucky-pool | custom native playarea | yes | yes | 2 | 15 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gas-sponsor | profiled host + embedded real dApp | yes | yes | 9 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gasbox | custom native playarea | yes | yes | 3 | 13 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-gov-merc | profiled host + embedded real dApp | yes | yes | 7 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-graveyard | profiled host + embedded real dApp | yes | yes | 5 | 7 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-last-survivor | custom native playarea | yes | yes | 5 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-memorial-shrine | profiled host + embedded real dApp | yes | yes | 15 | 13 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-milestone-escrow | profiled host + embedded real dApp | yes | yes | 8 | 16 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-miniapp-factory | profiled host + embedded real dApp | yes | yes | 22 | 7 | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-convert | profiled host + embedded real dApp | yes | yes | 6 | 12 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-multisig | profiled host + embedded real dApp | yes | yes | 5 | 8 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-ns | profiled host + embedded real dApp | yes | yes | 11 | 21 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-pay | custom native playarea | yes | yes | 10 | 10 | built-static-dapp, standalone-playarea, registered-actions, native-action-board, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-pay-shared-example | profiled host + embedded real dApp | yes | yes | 1 | 3 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-sign-anything | profiled host + embedded real dApp | yes | yes | 6 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-swap | profiled host + embedded real dApp | yes | yes | 10 | 24 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-treasury | profiled host + embedded real dApp | yes | yes | 3 | 5 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, live-api-call, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neo-x-bridge | custom native playarea | yes | yes | 6 | 10 | built-static-dapp, standalone-playarea, registered-actions, native-action-board, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-neodid-passport | profiled host + embedded real dApp | yes | yes | 7 | 9 | built-static-dapp, standalone-playarea, console-tool-form, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-nft-factory | profiled host + embedded real dApp | yes | yes | 22 | 7 | built-static-dapp, standalone-playarea, shared-factory-workflow, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-onchaintarot | custom native playarea | yes | yes | 5 | 19 | built-static-dapp, standalone-playarea, registered-actions, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-compute-lab | oracle console playarea | yes | yes | 8 | 14 | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-http-console | oracle console playarea | yes | yes | 8 | 13 | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-neodid-console | oracle console playarea | yes | yes | 8 | 14 | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-price-console | oracle console playarea | yes | yes | 3 | 11 | built-static-dapp, standalone-playarea, registered-actions, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-seal-console | oracle console playarea | yes | yes | 8 | 14 | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-oracle-vrf-console | oracle console playarea | yes | yes | 8 | 13 | built-static-dapp, standalone-playarea, console-tool-form, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-private-transfer | custom native playarea | yes | yes | 11 | 7 | built-static-dapp, standalone-playarea, native-action-board, live-api-call, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-profitanchor | custom native playarea | yes | yes | 1 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-profitanchor-admin | custom native playarea | yes | yes | 1 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-quadratic-funding | profiled host + embedded real dApp | yes | yes | 25 | 25 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-recovery-guardian | profiled host + embedded real dApp | yes | yes | 20 | 24 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-redenvelope | custom native playarea | yes | yes | 3 | 9 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-self-loan | custom native playarea | yes | yes | 8 | 16 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-soulbound-certificate | profiled host + embedded real dApp | yes | yes | 4 | 16 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-time-capsule | profiled host + embedded real dApp | yes | yes | 8 | 8 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-timestamp-proof | profiled host + embedded real dApp | yes | yes | 3 | 4 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-trustanchor | custom native playarea | yes | yes | 1 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-trustanchor-admin | custom native playarea | yes | yes | 1 | 10 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, manifest-operations, action-handlers, interactive-controls | usable-surface-present |
| miniapp-unbreakablevault | profiled host + embedded real dApp | yes | yes | 11 | 15 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |
| miniapp-wallet-health | profiled host + embedded real dApp | yes | yes | 3 | 4 | built-static-dapp, standalone-playarea, registered-actions, host-embeds-real-dapp, action-handlers, interactive-controls | usable-surface-present |

> Scope: this audit verifies that every catalog miniapp has a built standalone dApp, a host surface, and detectable workflow evidence from source, manifest operations, or native playarea logic. It does not replace live mainnet/testnet signer execution for flows that require funded wallets or admin authority.
