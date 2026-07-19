# Guest / GameFi two-mode adoption contract

Shared foundation for a **two-mode** game fleet. Every game supports:

- **GUEST (游客)** — a plain LOCAL game. No token, no oracle, no chain, no
  reward/asset ops. Runs entirely client-side. A player MAY connect a wallet
  only to record a score to an **off-chain guest leaderboard**; nothing hits
  the chain.
- **GAMEFI** — the current behavior: chain + oracle (TEE/VRF) + reward pool +
  on-chain leaderboard + assets. **Unchanged.**

The launcher shows a two-choice entry — primary **"Earn GAS" (GameFi)** and
secondary **"Play free" (Guest)**. Guest scores go to a separate off-chain
board, distinct from the on-chain GameFi board.

`color-clash` is the reference implementation. This doc is the contract the
remaining games follow.

---

## 1. `app.mode` API (framework/index.ts)

Exported types: `FrameworkAppMode`, `FrameworkModeSurface`,
`FrameworkGuestLeaderboard`.

```ts
type FrameworkAppMode = "guest" | "gamefi";

interface FrameworkGuestLeaderboard {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

interface FrameworkModeSurface {
  current: Observable<FrameworkAppMode>;   // default "gamefi" (back-compat)
  set(mode: FrameworkAppMode): void;       // non-"guest" coerces to "gamefi"
  get(): FrameworkAppMode;
  isGuest(): boolean;
  isGameFi(): boolean;
  onChange(cb: (mode: FrameworkAppMode) => void): () => void; // returns unsubscribe
  guestLeaderboard: FrameworkGuestLeaderboard;
}

// Reached as:
app.mode.isGuest();
app.mode.guestLeaderboard.submit(score);
```

`app.mode.current` defaults to `"gamefi"`, so every existing game keeps its
current behavior with zero changes.

### The guest guard (defense-in-depth)

When `app.mode.current === "guest"`, these **write / oracle / reward entry
points THROW** `Error("guest-mode: on-chain/oracle operations are disabled")`
(code `GUEST_MODE_BLOCKED`):

| Surface | Guarded methods |
|---|---|
| `app.chain` | `invoke`, `invokeWithPayment`, `write`, `invokeMultiple` |
| `app.funds` | `payAndCall`, `prepayAndCall`, `receiptPay`, `withdrawCredit` |
| `app.oracle` | `http`, `vrf`, `compute`, `seal`, `dispatch` |
| `app.game.reward(cfg)` | `start`, `openSession`, `recordOp`, `finalize`, `expire`, `withdrawCredit` |

**Read-only lanes stay allowed** in guest mode: `app.chain.read`,
`app.chain.readRaw`, `app.chain.readArray`, `app.chain.events`.

The guard is a safety net. Correct guest wiring **branches before** any guarded
call, so the guard **never fires** in normal guest play — it only catches bugs.

### Guest leaderboard namespacing

`app.mode.guestLeaderboard` delegates to the existing off-chain
`os.leaderboard`, but under an **app-scoped `"<appId>:guest:"` prefix**:

- `submit(8)` → `os.leaderboard.submitScore("miniapp-color-clash:guest:8")`.
- `get()` → reads the board, keeps only rows whose score starts with the
  prefix, and strips it back to the plain score.

Guest scores therefore never mix with any other board usage (and are wholly
separate from the on-chain GameFi board, which color-clash builds from chain
`Solved` events — a completely different source).

---

## 2. Launcher → framework plumbing (race-free)

`apps/shared/react/MiniAppRoot.tsx` builds the framework and renders
`GameHomePageWrapper`. When a game opts in (see §3) the wrapper renders two
entry CTAs and, on click, records the mode **synchronously before** the play
area mounts:

```tsx
const enterWithMode = useCallback((mode: "guest" | "gamefi") => {
  framework.mode.set(mode);   // synchronous — observable updated + onChange fired now
  setShowGame(true);          // React re-render mounts the PlayArea/scene AFTER this
  if (mode === "guest") void reloadData();
}, [framework, reloadData]);
```

CTA wiring in the wrapper (opt-in games only):

```tsx
primaryLabel   = translate("entryGameFiCta", "Earn GAS");   // primary  = GameFi
secondaryLabel = translate("entryGuestCta", "Play free");   // secondary = Guest
onPrimaryClick   = () => enterWithMode("gamefi");
onSecondaryClick = () => enterWithMode("guest");
```

**Why it's race-free:** `framework.mode.set()` mutates the observable
synchronously in the click handler, *then* `setShowGame(true)` schedules the
render that first mounts the scene/PlayArea. By the time the scene renders (and
by the time any dispatch runs), `app.mode.current` already holds the chosen
mode. All `main.tsx` action handlers read `app.mode.isGuest()` **lazily at
dispatch time**, never capturing it, so there is no stale value.

`MiniAppRoot` also mirrors the mode onto `document.documentElement`
(`<html data-app-mode="guest|gamefi">`) — a pure signal for host chrome / e2e
probes; no behavior depends on it.

Non-opted-in games and non-game apps keep the current single-CTA behavior
unchanged. OneGate direct-play (`skipLaunchPage`) bypasses the launcher and
stays `gamefi` (default).

---

## 3. Manifest opt-in flag

Only games that opt in get the two-CTA entry
(`apps/shared/types/miniapp-manifest.ts`):

```ts
// Canonical (games with a gamePage block):
manifest.gamePage.modes = { guest: true };

// Alternative (games without a full gamePage):
manifest.supportsGuest = true;
```

The wrapper enables the two-CTA entry when
`gamePage?.modes?.guest === true || supportsGuest === true`.

---

## 4. `main.tsx` pattern — branch actions on `app.mode`

The scene is pure presentation (reads state, dispatches action names). In guest
mode you satisfy the **same dispatch actions + the same state/observable keys**,
driven by a local engine instead of the chain/oracle. Do NOT rename scene
actions or bridgeState keys.

```ts
const app = ctx.framework;

// 1. Build the guest engine over the SAME observables the scene reads.
const guest = createGuestEngine({ obs, /* extra obs */, guestLeaderboard: app.mode.guestLeaderboard, t: ctx.t, setStatus: ctx.setStatus });

// 2. On switch to guest, reset to a local lobby + load the off-chain board.
app.mode.onChange((mode) => { if (mode === "guest") void guest.enter(); });

// 3. Branch every registered action FIRST on mode.
app.actions.register("startGame", async (...a) => {
  if (app.mode.isGuest()) { guest.startGame(Number(a[0] ?? 0)); return; }
  /* ... existing gamefi flow ... */
});
// same one-line guard for retryDeal / recordPress / submitSolution /
// expireGame / withdrawWinnings / refreshLeaderboard ...

// 4. Gate the on-chain READ helpers so a mount-time gamefi read never clobbers
//    the guest surface once the player has switched.
const refreshBalances  = async () => { if (app.mode.isGuest()) return; /* chain reads */ };
const refreshStats     = async () => { if (app.mode.isGuest()) return; /* chain reads */ };
const loadLeaderboard  = async () => { if (app.mode.isGuest()) return; /* chain reads */ };
```

**Rule of thumb:** every action handler starts with a
`if (app.mode.isGuest()) { <local>; return; }` line; every chain-reading loader
starts with `if (app.mode.isGuest()) return;`.

---

## 5. Building a guest local engine

Put it in `apps/<game>/src/logic/guest-engine.ts`. It drives the SAME
observables the scene reads; it makes ZERO framework chain/oracle/reward calls.

### (a) Games that already have a `logic/*-engine.ts` (deterministic rules)

Reuse the pure rules module. The guest engine is a thin driver that:

1. `startGame(difficulty)` — generate the puzzle/seed with the Web-Crypto RNG
   (the local analog of the enclave seed), set the observables the scene reads
   (`gameStatus → "dealt"`, `sequence`, timers, difficulty), clear player state.
2. `recordPress`/move handlers — validate the move against the local rules
   module, advance or end the run, mirror the same `lastStatus` strings the
   gamefi flow uses (`"wrong"`, `"all-correct"`, …) so the scene reacts
   identically.
3. `submitSolution` — compute the local score, set `gameStatus → "solved"`,
   submit to `guestLeaderboard`, refresh the guest board.
4. `expireGame` — reset to `gameStatus → "idle"`.
5. `refreshLeaderboard` / `enter` — load `guestLeaderboard.get()` into the
   leaderboard observable; `enter()` also zeroes the on-chain-only counters
   (credit/pool/rank/totalWon/solves/history).

### (b) Chance / social games with NO engine (local RNG sim)

Same driver shape, but the "rules" are a local RNG simulation:

- Generate outcomes with `crypto.getRandomValues` (dice, card, spin, draw).
- Resolve win/score locally from the rolled outcome.
- Drive the same scene observables and dispatch names.
- Submit the score to `guestLeaderboard`; skip any pool/credit concepts.

Both variants end with the same off-chain submit path.

### Guest scores → `app.mode.guestLeaderboard`

```ts
try { await app.mode.guestLeaderboard.submit(score); } catch { /* wallet optional — best-effort */ }
const rows = await app.mode.guestLeaderboard.get(50); // [{ user, score }] — guest namespace only
```

Submitting is best-effort (wallet is optional in guest). Read `get()` back into
the leaderboard observable to render the guest board.

---

## 6. color-clash worked example (files changed)

| File | Change |
|---|---|
| `framework/index.ts` | Added `app.mode` (types + surface), the guest guard on all write/oracle/reward entry points, and `guestLeaderboard`. |
| `apps/shared/types/miniapp-manifest.ts` | `GamePageConfig.modes?: MiniAppGameModes` + top-level `supportsGuest?`. |
| `apps/shared/components-react/MiniAppHomeShell.tsx` | Optional `secondaryLabel` / `onSecondaryClick` → renders a `.n3h-button--secondary` CTA. |
| `apps/shared/react/MiniAppRoot.tsx` | Wrapper renders the two CTAs, sets `app.mode` on click before mount, reflects mode on `<html data-app-mode>`. |
| `apps/shared/locale/base-messages.ts` | `entryGameFiCta` / `entryGuestCta` (en + zh). |
| `apps/color-clash/src/manifest.ts` | `gamePage.modes = { guest: true }`. |
| `apps/color-clash/src/logic/guest-engine.ts` | **New** — local Simon engine (adapted from the legacy `PlayArea.tsx` practice engine). |
| `apps/color-clash/src/main.tsx` | Import + build the guest engine; `onChange` → `guest.enter()`; one-line guest branch on every action; `isGuest()` guard on the three chain-read loaders. |
| `apps/color-clash/src/locale/messages.ts` | `guestRunComplete`, `guestModeLine` (en + zh). |

**Frozen scene contract (unchanged):** dispatch actions `startGame`,
`retryDeal`, `recordPress`, `submitSolution`, `expireGame`,
`withdrawWinnings`, `refreshLeaderboard`; and all bridgeState keys. Guest mode
reuses these names verbatim, backed by the local engine.

### Before / after (a color-clash action)

```ts
// BEFORE
app.actions.register("startGame", async (...args) => {
  if (obs.isStarting.get() || obs.isDealing.get()) return;
  /* pay entry, open TEE session, bind commitment on-chain ... */
});

// AFTER
app.actions.register("startGame", async (...args) => {
  if (app.mode.isGuest()) { guest.startGame(Number(args[0] ?? 0)); return; }
  if (obs.isStarting.get() || obs.isDealing.get()) return;
  /* unchanged gamefi flow ... */
});
```

---

## 7. Caveats the rollout must know

1. **`loadData` runs under the default `gamefi` mode on mount.** Guest-only
   players still incur READ-ONLY chain calls on mount (reads are allowed; the
   guard never fires). Gate every chain-read loader with
   `if (app.mode.isGuest()) return;` so those results never overwrite the guest
   surface after the player switches. A read that *started* in gamefi and
   resolves *after* the switch is the only residual window — negligible in
   practice (human click latency ≫ read latency) and harmless (read-only).
2. **The score panel / drawer copy is GAS-centric** (`PhaserPlayArea` /
   scene copy is not mode-aware). In guest, the panel still shows
   "REWARD AT STAKE 0.10 GAS" etc. This is cosmetic — no GAS moves. Games that
   want guest-specific copy should surface `app.mode` into their PlayArea (e.g.
   via a `mode` observable) and branch labels; out of scope for this foundation.
3. **Guest leaderboard display reuses the GAS column.** The guest board maps
   `score → totalWon`, so it renders as "N GAS". Same cosmetic class as (2).
4. **Wallet is optional in guest.** `guestLeaderboard.submit` is best-effort
   (wrap in try/catch); a guest with no wallet simply doesn't get a board row.
5. **Guarded set is broader than the minimum ask** — `chain.write`,
   `invokeMultiple`, `funds.prepayAndCall`, `receiptPay` are guarded too, so any
   game using those write lanes is protected in guest mode without extra work.
