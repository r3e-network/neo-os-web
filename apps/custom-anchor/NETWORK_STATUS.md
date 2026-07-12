# Network status

Read-only RPC verification performed on 2026-07-12 against `https://api.n3index.dev/{network}` using `getcontractstate`.

| Network | PlatformAnchor | Update counter | Manifest | Result |
| --- | --- | ---: | --- | --- |
| Neo N3 MainNet | `0x02beeef6f65c6989a121c0a0e6b23190333edb98` | 2 | `PlatformAnchor` | hash, methods, and events verified |
| Neo N3 TestNet | `0xab079b4f9a0a2471d136392e25eb8e99898dcad0` | 0 | `PlatformAnchor` | hash, methods, and events verified |

Both deployments expose the app-used methods:

- `registerCustomAnchorApp(String, Integer, Hash160)`
- `registerAgents(String, Array, Array, Array)`
- `withdraw(String, Hash160, Integer)`
- `claimRewards(String, Hash160)`
- `withdrawCredit(Hash160, String, Integer)`
- `getAppMode`, `getAppAdmin`, `getTotalStaked`, `getRewardReserve`, `getRewardPerNeo`, `getAgentCount`, `getAgentAccount`, `getAgentCandidate`, `getUserStake`, `getPendingRewards`, and `getCredit`

Both deployments expose `AnchorAppRegistered`, `AnchorAgentRegistered`, `AnchorStakeChanged`, and `AnchorRewardsClaimed` with the parameter order used by recovery verification.

The TestNet AA core used by registration is `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` (`UnifiedSmartWalletV3`, update counter 4 at verification time). Its live ABI exposes `registerAccounts`, `getBackupOwner`, and `AccountRegistered(accountId, backupOwner, verifier, hookId)`.

All checks in this pass were read-only. No transaction was signed or broadcast.
