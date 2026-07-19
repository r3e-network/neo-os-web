# MiniAppDailyCheckin — public ABI (frontend rewire)

Self-contained, owner-fundable replacement for the deployed daily-checkin contract
whose reward pool could never be funded (its `onNEP17Payment` rejected every
non-checkin memo, it had no fund/tune methods, and its admin was an unknown key).
This one is owned by `NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32` so we control funding +
tuning.

- Contract name: `MiniAppDailyCheckin`
- Owner (hardcoded `[InitialValue]`): `NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32`
  (scriptHash `0x6d0656f6dd91469db1c90cc1e574380613f43738`)
- **Predicted network-independent hash** (Hash160(deployer ++ nef.checksum ++ name)):
  `0xf32d67bbc32ebaf79a6ccb998dd0ab74b002be0b`
  (same on testnet and mainnet — same NEF, same deployer)
- NEF: `contracts/build/MiniAppDailyCheckin.nef` (checksum `170189676`)
- Manifest: `contracts/build/MiniAppDailyCheckin.manifest.json`
- Units: GAS base units (1 GAS = 1e8). "Day" = the contract's own UTC-day unit
  `Runtime.Time(ms) / 86_400_000` — NOT commensurable with a JS calendar day.

The read surface and the check-in / claim flows match
`apps/daily-checkin/src/composables/useCheckin.ts` exactly, so the frontend rewire
is just repointing the contract hash (manifest `contracts.*`) — no code changes
needed. Defaults: `checkInFee` 100_000 (0.001 GAS), `weekReward` 1_000_000
(0.01 GAS), `twoWeekReward` 2_000_000 (0.02 GAS). Owner can retune via
`setRewardConfig`.

## Reads (Safe)

| Method | Returns (Map keys / value) |
|---|---|
| `getCheckInStateForFrontend(user: Hash160)` | `currentStreak, highestStreak, lastCheckinDay, unclaimed, totalCheckins, currentTime, currentDay, twentyFourHours, weekReward, twoWeekReward, resetAfterDays` |
| `getCheckinStatus(user: Hash160)` | `currentUtcDay, lastCheckinDay, canCheckin (bool), timeUntilEligible (ms), streakWillReset (bool), currentStreak, nextRewardDay` |
| `getUserStatsDetails(user: Hash160)` | `streak, highestStreak, lastCheckinDay, unclaimed, claimed, totalCheckins` |
| `getPlatformStats()` | `totalUsers, totalCheckins, totalRewarded, checkInFee, currentUtcDay, nextMidnight (ms), weekReward, twoWeekReward, resetAfterDays` |
| `isPaused()` | `Boolean` |
| `rewardPool()` | `Integer` — total reward-backing GAS held (fees + fundings) |
| `totalUnclaimed()` | `Integer` — protected obligation (sum of all users' unclaimed) |
| `checkInFee()` | `Integer` — configured check-in fee (base units) |

Notes:
- `canCheckin = lastCheckinDay < currentUtcDay`.
- `nextMidnight = (currentUtcDay + 1) * 86_400_000` — a wall-clock ms timestamp the
  UI ticks against `Date.now()`.
- The frontend's reward-pool solvency check uses GAS `balanceOf(contractHash)`;
  the contract is held exactly solvent (balance >= `rewardPool()` >= `totalUnclaimed()`).

## Check-in (deposit-then-act, one tx)

A GAS transfer to the contract carrying memo `miniapp-dailycheckin:checkin` IS the
check-in. The transferred amount must be `>= checkInFee`. `onNEP17Payment` (credit-
only) advances the consecutive-UTC-day streak (resets to 1 if a day was missed),
increments counters, accrues the fee into the pool, and accrues a milestone reward
to the user's `unclaimed` when the streak hits day 7 (`weekReward`) or day 14
(`twoWeekReward`).

- Emits `CheckedIn(user: Hash160, streak: Integer, reward: Integer)`.
  (`reward` is the milestone amount accrued THIS check-in, or 0.)
- Reverts on-chain (do not retry): second check-in same UTC day
  (`already checked in today`), fee below `checkInFee`, paused, invalid memo.

## Claim (direct call)

`claimRewards(user: Hash160) -> Integer` — pays the user's accrued `unclaimed`
balance out of the contract's GAS pool to `user` (user's own witness authorises).
Reverts `no rewards to claim` when nothing is accrued, and `reward pool cannot
cover claim` when the pool is short (so the UI gates claims on pool solvency).

- Emits `RewardsClaimed(user: Hash160, amount: Integer)`.

## Owner-only (the methods the old contract lacked)

| Method | Effect |
|---|---|
| Fund the pool | GAS transfer with memo `miniapp-dailycheckin:fund` → credits the pool. Emits `PoolFunded(from, amount, pool)`. (Anyone may fund; owner normally does.) |
| `setRewardConfig(checkInFee, weekReward, twoWeekReward)` | Retune fee + milestone rewards. Emits `RewardConfigUpdated(fee, week, twoWeek)`. |
| `setPaused(paused: Boolean)` | Pause/unpause check-ins + claims. Emits `PausedChanged(paused)`. |
| `withdrawRevenue(to: Hash160, amount: Integer)` | Sweep only `rewardPool() - totalUnclaimed()` (surplus over the protected obligation); accrued rewards stay claimable. Emits `RevenueWithdrawn(to, amount)`. |

## Memos (exact bytes)

- Check-in: `miniapp-dailycheckin:checkin`
- Fund pool: `miniapp-dailycheckin:fund`
