# Reward Game SDK

Root-level frontend framework for GAS-pay-to-play / GAS-reward miniapp games.

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
`@framework/gamefi` directly only for low-level tests or custom runtimes.

```ts
import {
  createLocalStorageRewardGameStorage,
  finalizeRewardGame,
  gasToFixed8,
  openRewardGameSession,
  recordRewardGameOp,
  startRewardGame,
} from "@framework/gamefi";

const rewardConfig = {
  appId: "miniapp-flappy-dash",
  engineHash: "401bb3de1c04a8b20c18d35a9f0750f33647361060884f275d6954d3c74c2b1c",
  entryMemo: "miniapp-flappy-dash:entry",
  modes: [
    { id: 0, key: "easy", entryFixed8: gasToFixed8("0.02"), rewardFixed8: gasToFixed8("0.1") },
    { id: 1, key: "medium", entryFixed8: gasToFixed8("0.1"), rewardFixed8: gasToFixed8("0.5") },
  ],
  progression: { enabled: true },
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

## Difficulty Progression

Reward games should not let the same account farm the same paid tier forever.
Enable `progression: { enabled: true }` on every paid reward-game config. Before
payment, `startRewardGame()` reads the connected player's `Solved` history and
rejects a lower completed tier:

- no solved runs: Easy is allowed
- Easy solved: Medium or harder is required
- Medium solved: Hard is required
- Hard solved: Hard remains the paid route, but the SDK returns
  `hardChallengeLevel` and a reduced `effectiveLimitMs` so the scene/TEE can
  continue tightening the challenge

Use `ctx.framework.game.reward(config).progression(difficulty)` in the lobby to
disable locked route cards before the user taps the paid action. Contracts and
TEE engines should still enforce equivalent progression server-side; the SDK
gate prevents bad UX and accidental low-tier payments, not final funds safety.

Casual/practice play should remain separate from paid reward starts: do not call
`startRewardGame()` and do not write `Solved` progress for practice-only runs.

## Game Design Backlog

See [MICROGAME_BACKLOG.md](./MICROGAME_BACKLOG.md) for candidate short-session
GameFi games such as White Tile Rush, ten-second survival, stack timing, and
other recognizable mobile challenge formats that fit this SDK.

New arcade miniapps should start from one of these archetypes or add a new one
before implementation. The archetype must describe the main game object,
mobile control model, deterministic verification, and anti-abuse checks. It is
not enough to expose a payment form plus a submit button.
