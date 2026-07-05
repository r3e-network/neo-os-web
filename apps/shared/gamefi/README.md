# Reward Game SDK

Shared frontend framework for GAS-pay-to-play / GAS-reward miniapp games.

It centralizes the flow every trusted reward game needs:

- wallet connection and player Hash160 resolution
- reward-pool and player-credit reads
- start-game transaction selection: existing credit first, prepaid GAS fallback
- active game id recovery when an indexer event is delayed
- Morpheus confidential session identity, start, step replay, and sealed op-log
- finalize transaction, Solved-event decoding, getGame polling fallback
- local op-log storage, expire-game cleanup, and winnings withdrawal

## Contract Interface

The default method/event names match the current Morpheus reward-game contracts:

- `freePool()`
- `creditOf(player: Hash160)`
- `activeGameOf(player: Hash160)`
- `startGame(player: Hash160, difficulty: Integer)` emits `GameStarted`
- `getGame(gameId: Integer)`
- `finalizeGame(gameId: Integer, sealedOpLogHex: String)` emits `Solved`
- `expireGame(gameId: Integer)`
- `withdraw(player: Hash160)` emits `CreditWithdrawn`

Games with different names can override `methods`, `events`, and `eventSlots` in
`RewardGameConfig`.

## Frontend Usage

Miniapps should normally access this through `ctx.framework.game.reward(...)`,
which supplies the app id, chain adapter, and app-scoped op-log storage. Import
`@shared/gamefi` directly only for low-level tests or custom runtimes.

```ts
import {
  createLocalStorageRewardGameStorage,
  finalizeRewardGame,
  gasToFixed8,
  openRewardGameSession,
  recordRewardGameOp,
  startRewardGame,
} from "@shared/gamefi";

const rewardConfig = {
  appId: "miniapp-flappy-dash",
  engineHash: "401bb3de1c04a8b20c18d35a9f0750f33647361060884f275d6954d3c74c2b1c",
  entryMemo: "miniapp-flappy-dash:entry",
  modes: [
    { id: 0, key: "easy", entryFixed8: gasToFixed8("0.02"), rewardFixed8: gasToFixed8("0.1") },
    { id: 1, key: "medium", entryFixed8: gasToFixed8("0.1"), rewardFixed8: gasToFixed8("0.5") },
  ],
};

const storage = createLocalStorageRewardGameStorage("miniapp-flappy-dash:ops:");

const started = await startRewardGame(rewardConfig, ctx.services.chain, 0, storage);
const session = await openRewardGameSession(rewardConfig, ctx.services.chain, started.gameId, 0);

await recordRewardGameOp(session, storage, { type: "flap" });

const finalized = await finalizeRewardGame(rewardConfig, ctx.services.chain, session, storage);
```

The SDK deliberately stays UI-free. Game screens should still render their own
native-feeling play area, assets, animation, and controls; this layer owns only
the financial and confidential-compute state machine.
