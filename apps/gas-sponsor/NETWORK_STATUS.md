# Gas Sponsor network status

Read-only verification date: 2026-07-11.

| Check | MainNet | TestNet |
| --- | --- | --- |
| Contract | `0x80ea8435a88334b9b80077220097d88c440615f1` | `0x31888679572bf2de61462ff9934b6265d60284f2` |
| Manifest name/version | `MiniAppGasSponsor` / `2.0.0` | `MiniAppGasSponsor` / `2.0.0` |
| Paused | No | No |
| Total pools | 0 | 36 |
| Active pools | 0 | 0 |
| Total sponsored | 0 GAS | 36 GAS |
| Total claimed | 0 GAS | 1.8 GAS |
| Contract GAS balance | 0 GAS | 0 GAS |

The latest inspected TestNet pool (`#36`) is expired with zero remaining balance. The application therefore renders an honest empty live-station state while keeping recent pools inspectable.

Core shared ABI verified on both networks:

- Reads: `getPlatformStats`, `getPoolDetails`, `getSponsorStatsDetails`, `getBeneficiaryStatsDetails`, `getPoolCount`, `getActivePoolCount`, `getUserClaimedFromPool`, `isWhitelisted`.
- Writes: `createPool`, `claimSponsorship`, `withdrawPool`, `topUpPool`, `extendPoolExpiry`.
- Events: `SponsorshipCreated`, `SponsorshipClaimed`, `PoolRefunded`, `PoolExtended`, `PoolDepleted`.

No wallet signing, transaction or deployment was performed during this verification.
