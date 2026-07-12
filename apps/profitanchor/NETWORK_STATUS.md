# ProfitAnchor Network Status

Read-only verification date: 2026-07-12

| Network | RPC | PlatformAnchor | Contract name | App mode | Paused | Agent count |
| --- | --- | --- | --- | --- | --- | --- |
| Neo N3 mainnet | `https://mainnet2.neo.coz.io:443` | `0x02beeef6f65c6989a121c0a0e6b23190333edb98` | `PlatformAnchor` | `2` | `false` | `21` |
| Neo N3 testnet | `https://testnet1.neo.coz.io:443` | `0xab079b4f9a0a2471d136392e25eb8e99898dcad0` | `PlatformAnchor` | `2` | `false` | `21` |

Both contracts returned `HALT` for `getAppMode`, `isAppPaused`, and
`getAnchorStats`. The live ABI exposes the exact user methods consumed here:
`getUserStake`, `getPendingRewards`, `getCredit`, `withdraw`, and
`claimRewards`, plus `AnchorStakeChanged` and `AnchorRewardsClaimed` events.

This verification was read-only. It did not invoke a wallet, submit a funded
transaction, update a contract, or deploy anything.
