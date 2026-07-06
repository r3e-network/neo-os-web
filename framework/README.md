# Neo MiniApp Framework

The root-level `framework/` module is the default business SDK for MiniApps and
dApps that must run in both the Neo MiniApp Platform and OneGate.

It sits above `PlatformServices` and standardizes the work that should not be
reimplemented by every app:

- platform launch detection (`onegate`, embedded platform, standalone)
- app state and persisted state
- app-scoped local storage plus OS storage fallback
- small collection-style app database access
- contract argument and GAS/NEO amount normalization
- user-visible operation state (`idle` / `running` / `succeeded` / `failed`)
- chain reads, writes, prepaid GAS calls, and event waiting
- oracle request envelopes for HTTP, VRF, compute, and sealed-reference flows
- stats, leaderboards, achievements, and single-flight user actions
- Reward Game / GameFi flows through `app.game.reward(...)`
- success/error notification wiring

## Basic Setup

React miniapps receive the framework from `defineMiniApp` setup context:

```ts
defineMiniApp({
  appId: "miniapp-example",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const app = ctx.framework;

    const counter = app.state.persisted("counter", 0);

    app.actions.register("increment", async () => {
      counter.set(counter.get() + 1);
      await app.stats.increment("increments");
    }, {
      successKey: "saved",
    });

    return {
      state: { counter },
    };
  },
});
```

Use the host miniapp runtime for `defineMiniApp`; the framework value itself is
injected as `ctx.framework` and its implementation lives in the root
`framework/` package.

`createMiniAppFramework(ctx, { appId })` remains available from `@framework` for
tests and custom embeds, but app entrypoints should prefer the runtime-provided
`ctx.framework`.

## Chain And Funds

```ts
const playerArg = app.chain.arg.hash160(walletAddress);
const gasFixed8 = app.amount.gasToFixed8("0.02");
const neoUnits = app.amount.neoToUnits("3"); // NEO is whole-number only

await app.chain.write({
  operation: "claim",
  args: [app.chain.arg.integer(1)],
  waitForEvent: "Claimed",
  successKey: "claimSuccess",
  reload: loadAll,
});

await app.funds.payAndCall({
  amountGas: "0.02",
  memo: "miniapp-example:entry",
  operation: "startGame",
  args: [],
  waitForEvent: "GameStarted",
});
```

Use `app.amount.assetToUnits("NEO" | "GAS", value)` when a screen lets the user
choose an asset. It preserves the NEO rule that the smallest unit is `1` and
rejects fractional NEO before a transaction is prepared.

## Operation State

Use framework operations when a button, panel action, or game move needs a
stable user-facing state machine:

```ts
const claimOp = app.operations.create("claim");

app.actions.register("claim", () =>
  claimOp.run(() =>
    app.chain.write({
      operation: "claim",
      args: [],
      waitForEvent: "Claimed",
    }),
  ),
);
```

`claimOp.state` is an observable containing status, txid, error, timestamps, and
the last returned value. PlayAreas can bind this to progress copy, disabled
states, retry rows, or transaction result panels instead of inventing a new
loading/error convention per miniapp.

## Reward Games

Games that charge GAS and pay rewards should use the framework-native GameFi
client:

```ts
const runner = app.game.reward({
  engineHash: "401bb3de1c04a8b20c18d35a9f0750f33647361060884f275d6954d3c74c2b1c",
  entryMemo: "miniapp-runner:entry",
  modes: [
    { id: 0, key: "easy", entryFixed8: app.amount.gasToFixed8("0.02"), rewardFixed8: app.amount.gasToFixed8("0.1") },
  ],
});

const started = await runner.start(0);
const session = await runner.openSession(started.gameId, 0);
await runner.recordOp(session, { type: "move", direction: "left" });
const finalized = await runner.finalize(session);
```

This wraps the existing reward-game SDK with app-scoped op-log storage and the
current platform/OneGate chain adapter. Game code should own gameplay, assets,
animation, and controls; the framework owns wallet, prepaid credit, contract,
Morpheus session, settlement, and credit withdrawal plumbing.

## Oracle Envelopes

```ts
const request = await app.oracle.http({
  url: "https://api.example.com/price",
  method: "GET",
  path: "$.data.price",
});

await app.oracle.dispatch(request, {
  operation: "submitOracleRequest",
  waitForEvent: "OracleRequestSubmitted",
});
```

The envelope digest is deterministic: equivalent JSON payloads produce the same
digest, so UI previews, OneGate dApp calls, and platform submissions can be
cross-checked before sending a transaction.

## Storage And App Data

```ts
const runs = app.db.collection<{ score: number; txid?: string }>("runs");

await runs.set("run-1", { score: 120 });
const run = await runs.get("run-1");
```

Writes are always app-namespaced locally. When the MiniApp OS storage service is
available, the framework syncs there too; when a OneGate or standalone embed
cannot reach OS storage, the local copy still keeps the app usable.

## Achievements

```ts
await app.achievements.awardOnce({
  id: "first-win",
  name: "First win",
  criteria: "Win one completed round",
});
```

`awardOnce` stores a local per-user marker after a successful award so reloads
and later button taps do not repeatedly award the same achievement.
