# MiniAppLastSurvivor

`MiniAppLastSurvivor` powers **LastSurvivor**.

## Current Product Rules

- the round starts with a `24 hour` countdown
- every key purchase resets the timer back to `24 hours`
- each purchase increases the jackpot pot
- the last buyer when the timer expires wins the round prize

## Contract Role

The contract is responsible for:

- maintaining the active round, last buyer, timer, and jackpot pot
- pricing keys with the configured dynamic formula
- recording player participation and badge progress
- settling the winner when the countdown expires
- exposing round and player statistics for the frontend

## Core Methods

- `startNewRound()`
- `buyKeys(UInt160 player, BigInteger keyCount)`
- `checkAndEndRound()`
- `getGameStatus()`
- `getRoundDetails(BigInteger roundId)`
- `getPlayerStatsDetails(UInt160 player)`

## Important Clarification

Earlier contract docs in this repo described a `1 hour` initial timer with `+30 seconds` per key.
That is no longer the intended flagship product.
The current rules are now aligned to the selected market definition:

- full `24 hour` round start
- full `24 hour` reset on every contribution

## Integration Notes

- canonical app id: `miniapp-last-survivor`
- frontend, manifest, and host definitions should all describe the same 24-hour reset mechanic
- settlement still relies on platform payout / accounting around the emitted round events
