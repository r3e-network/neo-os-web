# PlatformGame Migration Completeness

Generated: 2026-07-24T12:30:00.294Z

## Summary

- Attached apps: 11
- Attached apps with shared manifest binding: 11/11
- Attached apps using app.platformGame directly: 0/11
- Attached apps routed through the framework adapter: 11/11
- Attached apps routed to PlatformGame: 11/11
- Attached apps still using an unadapted legacy runtime: 0
- Runtime migrations complete: 0/11
- Attached apps with complete funded lifecycle evidence: 0/11
- Attached apps with current read-only live state evidence: 9/11
- Zero-drain candidates runtime-ready: 0/5
- Future local-only candidates awaiting a reviewed engine track: 5
- Boundary: The 11 absorption-cohort apps and five future-local-only candidates are separate tracks. An engine attachment, shared manifest binding, and framework route do not prove funded runtime completion. Completion additionally requires removal of direct clone-shaped calls plus a funded start/finalize/settle/recovery/withdraw testnet lifecycle.

## Attached Apps

| App | Binding | Runtime adapter | Descriptor/live | Live state | Complete | Blockers |
| --- | --- | --- | ---: | --- | --- | --- |
| miniapp-aim-master | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-color-clash | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-curve-arrow | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-flappy-dash | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-game-2048 | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-jump-rush | shared:platform-game | framework-platform-game-adapter | 9/0 | blocked (0/9) | no | testnet_descriptor_values_match_local, funded_testnet_lifecycle_proven |
| miniapp-merge-kingdom | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-pet-potion | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-sheep-solitaire | shared:platform-game | framework-platform-game-adapter | 9/3 | blocked (3/9) | no | testnet_descriptor_values_match_local, funded_testnet_lifecycle_proven |
| miniapp-snake-bounty | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |
| miniapp-sudoku | shared:platform-game | framework-platform-game-adapter | 9/9 | ready (9/9) | no | funded_testnet_lifecycle_proven |

## Zero-Drain Candidates

| App | Scope | Standalone contract | Binding | Runtime adapter | Attached | Ready | Blockers |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| miniapp-arrow-escape | future-local-only | 0 | none:- | none | not-attached | no | shared_platform_game_binding, absorption_descriptor_present, testnet_engine_attachment_present, testnet_descriptor_values_match_local, platform_game_runtime_routed, funded_testnet_lifecycle_proven |
| miniapp-bead-workshop | future-local-only | 0 | none:- | none | not-attached | no | shared_platform_game_binding, absorption_descriptor_present, testnet_engine_attachment_present, testnet_descriptor_values_match_local, platform_game_runtime_routed, funded_testnet_lifecycle_proven |
| miniapp-fruit-funnel | future-local-only | 0 | none:- | none | not-attached | no | shared_platform_game_binding, absorption_descriptor_present, testnet_engine_attachment_present, testnet_descriptor_values_match_local, platform_game_runtime_routed, funded_testnet_lifecycle_proven |
| miniapp-screw-sort | future-local-only | 0 | none:- | none | not-attached | no | shared_platform_game_binding, absorption_descriptor_present, testnet_engine_attachment_present, testnet_descriptor_values_match_local, platform_game_runtime_routed, funded_testnet_lifecycle_proven |
| miniapp-zhuada-e | future-local-only | 0 | none:- | none | not-attached | no | shared_platform_game_binding, absorption_descriptor_present, testnet_engine_attachment_present, testnet_descriptor_values_match_local, platform_game_runtime_routed, funded_testnet_lifecycle_proven |

## Required Next Gate

1. Keep every attached app free of direct clone-shaped chain calls; route lifecycle writes through `app.game.reward` and use `app.platformGame` only for typed shared snapshots.
2. Keep exact appId-first ABI arguments, prepaid-credit economics, Finalizing/Solved polling, tenant event filtering, and restart recovery locked in framework tests.
3. Keep future-local-only candidates contractless until a product release decision, reviewed descriptor, Morpheus engine wrapper, and framework route exist; only then consider attachment or shared binding.
4. Run a funded testnet start/finalize/settle/withdraw lifecycle before claiming any runtime migration complete.
