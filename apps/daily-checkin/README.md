# Daily Check-in — A Verified Neo Streak Ritual

Daily Check-in is a warm, ritual-first Neo MiniApp for protecting one on-chain streak day at a time. The main experience is a sunlit streak plaza, a visible seven-day chapter, a live UTC window, and one context-sensitive action—not a contract-parameter form.

> **Current status:** `MiniAppDailyCheckin` is deployed on Neo N3 mainnet and testnet. The live ABI, configuration, pause state, reward pools, and counters were checked through read-only N3Index RPC on 2026-07-11. No deployment, contract update, funded transaction, account, or secret was used in this production pass. See [NETWORK_STATUS.md](./NETWORK_STATUS.md).

## Daily Ritual

1. **Open the plaza** — Live reward terms and the contract pool load without asking for a wallet.
2. **Connect your Neo wallet** — User eligibility and streak data are bound to that wallet, network, and canonical contract.
3. **Check the UTC window** — Eligibility comes from `getCheckinStatus`; the frontend never guesses from a local calendar date.
4. **Check in once** — A direct-wallet GAS transfer sends the current fee with the exact memo `miniapp-dailycheckin:checkin`. That transfer is the check-in.
5. **Protect the streak** — Consecutive UTC days advance the streak. Missing a UTC day makes the next check-in restart at day 1 while preserving the historical best.
6. **Reach live milestones** — Day 7 accrues 0.01 GAS and day 14 accrues 0.02 GAS under the current deployed configuration. No later reward milestone is currently configured, although the streak can keep growing.
7. **Claim when ready** — `claimRewards` pays the accrued amount from the contract reward pool to the connected wallet.

## Transaction Truth

A wallet prompt, broadcast response, or transaction ID is pending—not success.

Every confirmed success requires both event and chain readback evidence; neither source is sufficient on its own.

- Check-in confirmation requires the exact `CheckedIn(user, streak, reward)` event, the exact GAS `Transfer(user, contract, fee)` event, and authoritative user/platform readback.
- Claim confirmation requires the exact `RewardsClaimed(user, amount)` event, the exact GAS `Transfer(contract, user, amount)` event, and claimed/global reward readback.
- Every pending record is bound to operation, transaction ID, actor, network, canonical contract, GAS contract, and pre-action values.
- `FAULT` is terminal failure. Missing events, indexer lag, readback lag, wallet switching, or network mismatch remains visibly pending and recoverable.
- Failed or malformed reads never become fake zero streaks, empty rewards, “not checked in,” or success.

## Live Contract Terms

| Term | Current value |
| --- | ---: |
| Check-in transfer | 0.001 GAS |
| Day-7 reward | 0.01 GAS |
| Day-14 reward | 0.02 GAS |
| Reset rule | The next check-in restarts at day 1 after a missed UTC day |
| Platform fee beyond check-in transfer | None |

The owner can update the configured fee and milestone amounts. The UI therefore reads and displays current contract terms instead of hard-coding the live values as permanent promises.

## Canonical Deployment

| Network | Contract | Name | NEF checksum |
| --- | --- | --- | ---: |
| Neo N3 Mainnet | `0x25db219a701a2b23130788723fcf9a2e76857235` | `MiniAppDailyCheckin` | `170189676` |
| Neo N3 Testnet | `0x25db219a701a2b23130788723fcf9a2e76857235` | `MiniAppDailyCheckin` | `170189676` |

The app rejects a launch-network, wallet-network, configured-contract, GAS-contract, or pending-actor mismatch before confirming a write.

## Live Interface Used by the MiniApp

Reads:

- `getCheckInStateForFrontend(user)`
- `getCheckinStatus(user)`
- `getUserStatsDetails(user)`
- `getPlatformStats()`
- `isPaused()`
- `rewardPool()`
- `totalUnclaimed()`

Writes:

- GAS `transfer(user, contract, fee, "miniapp-dailycheckin:checkin")`
- `claimRewards(user)`

Confirmation events:

- `CheckedIn(user, streak, reward)`
- `RewardsClaimed(user, amount)`
- GAS `Transfer(from, to, amount)`

## Development Verification

From the repository root:

```bash
npx tsc -p apps/daily-checkin/tsconfig.json --noEmit
npm --prefix apps/daily-checkin test
cd apps/shared && npx vitest run test/daily-checkin.integration.test.tsx test/daily-checkin.logic.test.ts test/daily-checkin.playarea.test.tsx test/daily-checkin.production.test.ts
npm --prefix apps/daily-checkin run build
```

## License

MIT License — R3E Network
