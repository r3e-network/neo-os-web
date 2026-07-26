# Comprehensive Platform Audit - Part 3: Framework Abstraction Analysis
**Date:** 2026-07-25

## 5. Framework Surface Analysis

### 5.1 Current Framework Structure

**Location:** `framework/` (root business SDK)
**Entry Point:** `ctx.framework` in `defineMiniApp()`
**Test Coverage:** 4,479 tests passing

**Surface Count:** 20+ surfaces covering all platform capabilities

### 5.2 Framework Surfaces Inventory

| Surface | Status | Adoption | Deduplication Potential |
|---------|--------|----------|------------------------|
| `app.chain` | ✅ Complete | High | Already deduplicated |
| `app.funds` | ✅ Complete | High | Payment lanes unified |
| `app.amount` | ✅ Complete | High | Protocol math standardized |
| `app.fmt` | ✅ Complete | High | Display formatters unified |
| `app.errors` | ✅ Complete | Medium | Error handling centralized |
| `app.notify` | ✅ Complete | High | Toast system unified |
| `app.actions` | ✅ Complete | High | Action registration pattern |
| `app.operations` | ✅ Complete | Medium | State machine helpers |
| `app.state` | ✅ Complete | High | Observable atoms |
| `app.storage` | ✅ Complete | High | Persistence layer |
| `app.wallet` | ✅ Complete | High | Identity management |
| `app.events` | ✅ Complete | Medium | Chain event queries |
| `app.bus` | ✅ Complete | Medium | In-app pub/sub |
| `app.lifecycle` | ✅ Complete | High | Mount/unmount hooks |
| `app.platform` | ✅ Complete | High | Host detection |
| `app.registry` | ✅ Complete | Low | **New surface, 0 bindings** |
| `app.platformGame` | ✅ Complete | Low | **Ready, migration pending** |
| `app.platformSocial` | ✅ Complete | Low | **Ready, 0 bindings** |
| `app.platformAnchor` | ✅ Complete | Medium | **5 apps use old pattern** |
| `app.platformDeFi` | ✅ Complete | Low | **Ready, 0 bindings** |
| `app.platformVesting` | ✅ Complete | Low | **New, 0 bindings** |
| `app.platformEscrow` | ✅ Complete | Low | **New, 0 bindings** |
| `app.platformFactory` | ✅ Complete | Low | **3 apps, needs update** |
| `app.mode` | ✅ Complete | Medium | Guest/gamefi abstraction |
| `app.game` | ✅ Complete | Medium | Reward game SDK |
| `app.oracle` | ✅ Complete | Medium | Oracle envelopes |
| `app.credits` | ✅ Complete | High | Platform credits |
| `app.permissions` | ✅ Complete | High | S11 manifest gating |
| `app.aa` | ✅ Complete | Low | **New AA surface** |

### 5.3 Deduplication Analysis

**Progress (measured 2026-07-25, counts reproducible from the commands below):**
- ✅ Shared game rules live at `framework/game-rules.ts`, not `shared/game/rules.ts`.
  12 of the 13 apps carrying a local `src/logic/game-rules.ts` import from
  `@framework/game-rules`; the 13th (`zhuada-e`) is a level-curve game with no
  difficulty-rule selector, and its two local helpers (`readTuneNum`, `seedFor`)
  have no second definition anywhere in `apps/` or `framework/`, so it has
  nothing to delegate rather than an outstanding migration.
- ✅ All 78 apps reference `ctx.framework`.
- ✅ One shared composable remains for chain addressing: `useContractAddress`
  (1 app consumer). Transaction waiting, event parsing and balance polling are
  owned by the framework SDK; the parallel `useTxWaiter` / `useEventParser` /
  `useBalancePoller` composables were removed unused rather than migrated to,
  because shipping both a composable and an SDK surface for one concern is the
  duplication this section tracks.

Reproduce with:
```
ls apps/*/neo-manifest.json | wc -l
grep -rl 'src/logic/game-rules.ts' apps | grep -c .
grep -rl '@framework/game-rules' apps | grep -c .
```

Line-count deltas are deliberately not stated here: the earlier "-40 lines each"
and "-151 lines" figures had no reproducible derivation, and an unverifiable
number is worse than none in an audit record.

**Duplication Remaining (re-measured 2026-07-25 over non-test `contracts/**/*.cs`):**

1. **Contract-Level Duplication:**
   - 46 `OnNEP17Payment` receiver definitions (should use base class)
   - 25 `PREFIX_CREDIT` ledger declarations, of which only 2 carry a
     total-liability accumulator (`MiniAppTarotVrf`, `PlatformRegistry`) — the
     original census figure of 2 still holds, so the accounting gap is real and
     has widened with the ledger count
   - 42 `Update` method definitions
   - 26 `SetPaused` definitions (should delegate to Registry)
   - 8 `AppKey` definitions (should use DevPack)

   Two of the 25 credit ledgers are the intended shared homes
   (`MiniApp.DevPack/MiniAppHouseGameBase.cs` and
   `platform/PlatformGame/PlatformGame.RewardGame.cs`), so per-app ledgers should
   shrink toward those rather than the total growing. Every count above is
   definition-based, not reference-based; reference greps inflate `AppKey` from 8
   to 76 and were the source of the earlier understated figures. Reproduce with:
   ```
   grep -rn 'void OnNEP17Payment' contracts --include='*.cs' | grep -v __tests__ | wc -l
   grep -rnE 'static .*(byte\[\]|string) AppKey' contracts --include='*.cs' | grep -v __tests__ | wc -l
   ```

2. **Game Logic Duplication:**
   - 10-11 reward game contracts (~6,800-7,300 duplicated lines)
   - Each has identical `Play.cs` logic
   - Only constants differ: entry fee, reward, difficulty params
   - **Solution:** PlatformGame.RewardGame module with descriptor-based economics

3. **Framework-Level Duplication (re-measured 2026-07-25):**
   - `getApplicationLog` appears in **0** files under `apps/`. The claim of "8
     polling implementations" does not reproduce. Every remaining caller is in
     the host or the tooling that legitimately owns raw RPC: `platform/host-app`
     (`lib/chain/rpc-client.ts`, `pages/miniapps/[id].tsx` + its test) and
     `deploy/scripts` / `test/fuzz` harnesses.
   - Transaction waiting in apps therefore goes through the host bridge and
     `ctx.framework`, not through per-app log polling.
   - **Remaining item:** contract-address resolution, quantified in §5.4.

   ```bash
   grep -rn 'getApplicationLog' --exclude-dir=node_modules --exclude-dir=.next \
     --exclude-dir=.git . | grep -E '\.(ts|tsx|vue|mjs|js):' | cut -d: -f1 | sort -u
   ```

### 5.4 Framework vs App Responsibility Analysis

**Well-Abstracted (Apps don't reimplement):**
- ✅ Chain reads/writes through `app.chain`
- ✅ Payment flows through `app.funds`
- ✅ Error handling through `app.errors`
- ✅ Wallet identity through `app.wallet`
- ✅ Toast notifications through `app.notify`

**Partially Abstracted (measured 2026-07-25, one line per verified claim):**
- ✅ Transaction waiting — no app polls `getApplicationLog` (see §5.3). Nothing
  outstanding.
- ✅ Event parsing — 28 apps read notification payloads, and all 28 also use the
  shared event surface (`useAllEvents` / `app.events`). Reading fields off an
  event you subscribed to through the framework is consumption, not a parallel
  implementation, so there is nothing to migrate here either.
- ✅ Balance tracking — 17 apps call `setInterval`, but none of those timers sit
  within four lines of a balance read; they are gameplay/animation timers. No app
  hand-rolls balance polling.
- ⚠️ **Contract address resolution — the one real item.** 12 apps declare
  deployment hashes in `src/manifest.ts` (the intended, host-readable home) while
  28 apps additionally hardcode per-network hashes in ordinary source modules
  (e.g. `apps/memorial-shrine/src/logic/memorial-production.ts`,
  `apps/neo-ns/src/hooks/useNeoNS.ts`). These are deployment coordinates, not
  secrets, so this is a configuration-locality problem rather than a security
  one: a redeploy has to be chased through app source instead of one manifest.
  `useContractAddress` has 2 consumer files, both in `quadratic-funding`.

```bash
# addresses declared in the intended place vs. scattered through app source
grep -rlE '"0x[0-9a-fA-F]{40}"' apps/*/src/manifest.ts | wc -l
grep -rlE '"0x[0-9a-fA-F]{40}"' apps | grep -E '\.(ts|tsx|vue)$' \
  | grep -v '^apps/shared/' | grep -v 'manifest\.ts$' \
  | grep -vE '\.test\.(ts|tsx)$' | grep -v '/test/' | cut -d/ -f2 | sort -u | wc -l
```

**Not Yet Abstracted (Apps must implement):**
- ❌ Game-specific UI components (intentional - business logic)
- ❌ App-specific state machines (intentional - business logic)
- ✅ Oracle interaction (now abstracted via `app.oracle`)

### 5.5 Migration Complexity Assessment

**Low Complexity — re-measured 2026-07-25; three of the four rows were phantom
work.** The original list named `useTxWaiter`, `useEventParser` and
`useBalancePoller` with "8 / estimated 10 / estimated 15" app counts. Those three
composables had **zero** app consumers and were deleted on 2026-07-25 rather than
migrated to; per §5.3 and §5.4 the underlying concerns are already owned by
`ctx.framework` and the host bridge, so there was nothing behind the estimates.
The fourth row measured to 2 consumer files, not "estimated 20 apps".

- Contract addresses → `useContractAddress`: 2 consumer files today, both in
  `quadratic-funding`. The actual open work is the 28 apps that hardcode
  per-network hashes outside `src/manifest.ts` (§5.4) — mechanical, but 28 apps
  wide, so it is only "low complexity" per app, not in aggregate.

**Medium Complexity (Requires testing) — re-measured 2026-07-25:**
- Game logic → `framework/game-rules.ts` (**not** `shared/game/rules.ts`, which
  does not exist): 12 of 13 apps with a local `src/logic/game-rules.ts` already
  import it; the 13th (`zhuada-e`) has nothing to delegate. See §5.3. The
  "15 apps remaining" figure does not reproduce.
- Guest mode → `app.mode`: 24 apps reference it (plus `apps/shared`). The only
  app matching a `guest` grep without `app.mode` is `event-ticket-pass`, where
  every hit is the noun "guest" in user-facing copy about event attendees — a
  false positive, not a missing migration. "8 apps remaining" does not reproduce.
- Credit management → credits surface: composed centrally in
  `framework/index.ts:249` via `createCreditsSurface`, so every app holding
  `ctx.framework` already has it. 37 apps carry credit-related logic outside
  locale files and reach it through host-injected state bindings
  (`val("creditsBalance")`, `bool("creditsAvailable")`, …) or registered actions
  such as `withdrawCredit`; 2 apps use the `apps/shared/react/game-credits.ts`
  helper. There is no per-app credits implementation to migrate, so the
  "estimated 10 apps" row is retired.

```bash
grep -rlE '\bapp\.mode\b|framework\.mode\b' apps | grep -E '\.(ts|tsx|vue)$' \
  | cut -d/ -f2 | sort -u                       # guest-mode adoption
grep -rn 'createCreditsSurface' framework/index.ts   # single composition point
```

**High Complexity (Requires contract migration):**
- Reward games → PlatformGame.RewardGame (10-11 contracts)
- Requires: contract deployment, descriptor setup, framework binding
- Benefits: -800 LOC per game, shared maintenance

## 6. Framework Enhancement Opportunities

### 6.1 Identified Gaps

**Gap 1: Contract Upgrade Helper**
- **Issue:** 36 Update methods, inconsistent timelock usage
- **Solution:** Framework helper for safe contract upgrades
- **Benefit:** Standardized upgrade UX across all apps

**Gap 2: Pause/Resume Helper**
- **Issue:** 19 SetPaused copies, no Registry integration
- **Solution:** `app.registry.pause()` helper with proper guards
- **Benefit:** Unified pause experience

**Gap 3: Credit Ledger Helper**
- **Issue:** 23 PREFIX_CREDIT implementations, only 2 track liability
- **Solution:** DevPack base class with mandatory accounting
- **Benefit:** Prevent insolvency bugs

**Gap 4: Event Vocabulary**
- **Issue:** Ad-hoc event names (CreditWithdrawn ×27, Credited ×25, Solved ×20)
- **Solution:** DevPack standard event library
- **Benefit:** Consistent client-side event handling

### 6.2 Proposed Framework Additions

**New Surface: `app.contract`**
```typescript
app.contract.safeUpgrade(nefFile, manifestFile, data)
app.contract.proposeUpgrade(nefFile, manifestFile, data, timelockMs)
app.contract.executeUpgrade(proposalId)
```

**New Surface: `app.devpack`**
```typescript
app.devpack.creditLedger(prefix) // Returns managed ledger
app.devpack.pauseRegistry() // Returns Registry integration
app.devpack.standardEvents() // Returns event emitter
```

**Enhanced: `app.registry`**
```typescript
app.registry.pause(reason) // App self-pause
app.registry.resume() // App self-resume
app.registry.upgradeConsent(approve) // Treasury shim upgrade
```
