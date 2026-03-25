# MiniAppDailyCheckIn

`MiniAppDailyCheckIn` is the on-chain reward engine behind **Daily Check-in**.

## Current Product Rules

- Users can check in once per UTC day.
- Day 7 awards `1 GAS`.
- Day 14 awards `2 GAS`.
- After day 14, the streak cycle resets to `0` and starts over.
- Loyalty badges continue to accumulate across cycles.
- `ValidateUserOrAbstractAccount(user)` allows direct wallet calls or AA-backed execution.

## Contract Role

The contract is responsible for:

- tracking current streak, highest streak, total check-ins, and reward balances
- consuming direct prepaid GAS credit for the live check-in flow
- paying rewards into the user's unclaimed balance
- resetting the streak after the 14-day cycle completes
- emitting milestone and badge events for indexing / UI

It does **not** handle wallet onboarding or fee sponsorship itself. Those flows are provided by the external AA stack.

## Core Methods

- `CheckIn(UInt160 user)`
  Manual entry point that consumes direct prepaid GAS credit already recorded for the user.
- `ClaimRewards(UInt160 user)`
  Claims accumulated unclaimed GAS rewards.
- `GetCheckinStatus(UInt160 user)`
  Returns current streak state, whether the user can check in now, and the next reward day.
- `GetUserStats(UInt160 user)`
  Returns streak, highest streak, reward balances, resets, and total participation.
- `GetPlatformStats()`
  Returns total users, total check-ins, total rewards, check-in fee, 7-day reward, 14-day reward, and the reset cycle length.
- `OnNEP17Payment(UInt160 from, BigInteger amount, object data)`
  Records prepaid GAS credit and, when the memo is `miniapp-dailycheckin:checkin`, can execute the check-in immediately in the same transfer path.

## Reward Constants

- `CHECK_IN_FEE = 0.001 GAS`
- `FIRST_REWARD = 1 GAS`
- `SUBSEQUENT_REWARD = 2 GAS`
- `STREAK_RESET_DAYS = 14`

## Badge Model

Badges are intended to reflect ongoing loyalty, not just one uninterrupted streak:

- first check-in
- first 7-day cycle completion
- first 14-day cycle completion
- longer-term habit milestones by total check-ins
- comeback badge after recovering from a reset

## Integration Notes

- The canonical app id is `miniapp-dailycheckin`.
- Frontend, manifest, and host definitions are expected to use the same reward schedule:
  `day 7 -> 1 GAS`, `day 14 -> 2 GAS`, `then reset`.
- The primary frontend path is direct `GAS.transfer(...)` into the contract.
- AA session keys are the preferred execution path for the production UX.

## Known Boundaries

- This contract does not mint the actual NFT metadata itself; it emits badge state that the wider platform can index and present.
- This contract does not auto-claim rewards; claims are explicit user or AA actions.
