# Framework Extraction Plan — Non-Game MiniApps

Date: 2026-07-08. Scope: 54 non-game apps (games already migrated). Mandate: all business-agnostic logic (chain ops, oracle ops, wallet ops, data/state RW, lifecycle, resources, permissions, notifications) becomes framework-owned (`ctx.framework` / `app.*`).

## Campaign status (updated 2026-07-09)

- **Wave 1 — DONE** (`ffc13f825`): S0–S14 surfaces extracted into the framework SDK + framework/test specs.
- **Wave 2 — DONE** (`51610565f`): 18 mechanical low-risk apps onto framework surfaces (2A service-swap + 2B console kernel).
- **Wave 3 — DONE** (`49cc0e920`): 19 medium-risk apps (3A signing/oracle + 3B amounts/events/two-step-lite); profitanchor's `useProfitAnchor` dropped its eventBus dep here, clearing the profitanchor-admin conditional exemption (§3.6).
- **Wave 4 — DONE** (`e5561db69`): 6 deposit-then-act apps onto `app.funds`; also folds in the settlement-wrap fix (host-lane timeout/unreachable stranded-credit wrap regression — `FrameworkPrepaidActionError` now wraps confirmation-timeout/unreachable outcomes so recovery copy still shows).
- **Wave 5 — DONE** (`62c11e7c6`): 5 bespoke rewrites (aa-market-hub, neo-multisig, neo-treasury, quadratic-funding, neo-message partial).
- **Wave 6 — DONE** (working tree): cross-app source imports dissolved (profitanchor-admin/trustanchor-admin → `@shared/composables/{profitanchor,trustanchor}`; neo-pay-shared-example was already on `@shared/composables/neo-pay`); `TransferService`, `registerActions` (createActionHandlers), `useAllEvents`, and the positional `NotificationService.guard` path `@deprecated` toward `app.funds` / `actions.register` / `app.events.listAll` / `app.notify.guard` (consumers remain, so implementations kept); campaign-orphaned `useTicker` composable deleted; `createObservable`/`Observable` in `react/context.ts` now re-export the framework canonical.

Sources: 6 sweep batches (raw-site inventory per app), framework surface+gap audit, shared-vs-framework boundary audit. This doc is the execution contract for Waves 1..6.

---

## 1. Executive summary

### Raw sites by category (sweep totals, 54 apps)

| Category | Sites | Retiring surface |
|---|---|---|
| `ctx.services.notify` direct | ~128 (126 grep hits) | **app.notify** (params-capable) |
| raw `ctx.services.chain` / wallet-sdk | 86 | app.chain extensions + app.wallet |
| raw EventBus / `chain.events` gaps | 72 | **app.events** + **app.bus** |
| hand-built `{type,value}` arg literals | 34 | app.chain.arg extensions |
| localStorage / runtime-cache / safe-storage | 27 | app.storage.local (prefix-compatible) |
| clipboard (service + navigator) | 7 | app.clipboard |
| raw BalanceService / manual balanceOf | 6 (+4 apps hand-rolling balanceOf) | app.wallet |
| manual oracle/edge fetch | 6 | app.oracle.dataFeed / seal extensions |
| raw AAService | 2 | app.aa |
| **Total** | **~368** | |

### Top duplicated patterns (by app count)

1. **Per-action toast wrapper** — `notify.guard(fn, successKey)` or hand-rolled try/catch + `ctx.setStatus` around every registered action (~40 apps; quadratic-funding alone has 41 setStatus sites, neo-multisig 29).
2. **Deposit-then-act** — creditOf precheck → memo transfer → confirmation wait → consuming invoke, with stranded-credit recovery affordance (11 apps: custom-anchor, dev-tipping, gasbox, gov-merc, milestone-escrow, memorial-shrine, self-loan, time-capsule, quadratic-funding, neo-pay, unbreakable-vault).
3. **eventBus success/error emit + rethrow** double error-shaping, many on documented dead channels (~10 apps; unbreakable-vault has 14 dead-channel emits).
4. **Count-then-page / id-range enumeration** with defensive cap + per-id catch-and-skip + newest-first sort (~12 apps).
5. **Event-slot decode + waitForEvent timeout reconciliation** (verified=false pending, re-read fallback) (~10 apps).
6. **addressToScriptHash preamble / hash160 normalization** with localized throw before arg building (~10 apps) — plus the *distinct* false-not-throw comparison-key variant that must NOT migrate.
7. **Null-on-invalid amount scalers** duplicated because `app.amount.gasToFixed8` throws (flashloan, gas-sponsor, self-loan, neo-pay, quadratic-funding — documented gotcha).
8. **Hand-rolled stack-item decoders** (valueOf/asNumber/asMapValue/parseBigInt coercion) (5+ apps).
9. **Wallet address subscribe → reload cascade** (~8 apps; timestamp-proof polls at 500ms).
10. **Preview-builder console wiring** copy-pasted across the 4 oracle consoles + neo-x-bridge + oracle-compute-lab + neodid-passport.

### Expected end state

- `ctx.services.notify`: 126 → **0** app sites (all through app.notify / actions successParams).
- Raw chain/events/balance/aa/clipboard injections in `apps/*/src/main.tsx`: → **0** except the exemption list (§3.6).
- framework/utils forks (6 diverged files + 3 private re-impls in index.ts): → **1 canonical copy each**, shared re-exports (instanceof-compatible).
- Every new surface unit-tested in `framework/test/`; full `npm test` green; no app behavior change (toast text, error localization, storage keys byte-identical).

---

## 2. Wave 1 — surfaces to build (framework + framework/test)

Style contract: every surface is a lazy module on the object returned by `createMiniAppFramework` (framework/index.ts), typed in the same file, degrading gracefully when the injected service is absent (standalone/OneGate), with unit tests in `framework/test/*.test.ts` using the existing shims.

### S0. Utils consolidation (zero-app-risk, do first)

Merge the 9 duplicates: framework/utils/{neo,format,parsers,chain-events,fetch-timeout,morpheus-confidential-envelope}.ts forks ← full apps/shared/utils originals; framework/index.ts private `sha256Hex`/`localStorageAvailable`/`txidOf` ← shared hash.ts / safe-storage.ts / transaction.ts. Also move: async-utils, errors (MiniAppError hierarchy), observables (combineBusy → reactive.ts), amounts, and NotificationService's pure `classifyChainError`/`mapChainError` → `framework/utils/chain-errors.ts`. **apps/shared re-exports from framework** so existing imports and `instanceof` checks keep working. Constraint: amounts consolidation must preserve BOTH error-semantics variants (see S6); storage helpers must preserve the `neo:<appId>:` key prefix byte-for-byte (migration hazard — add a prefix-compat test).

### S1. app.notify — retires the 126 notify sites + ~70 setStatus toast hand-rolls

```ts
app.notify: {
  success(key: string, params?: Record<string, unknown>): void
  info(key, params?): void
  warn(key, params?): void
  error(err: unknown, fallbackKey?: string): void        // chain-error mapping via utils/chain-errors
  guard<T>(fn: () => Promise<T>, opts: { successKey?: string; successParams?: Record<string,unknown> | ((r: T) => Record<string,unknown>); errorKey?: string; rethrow?: boolean }): Promise<T | undefined>
  guardResult<T>(...same...): Promise<{ ok: boolean; value?: T; error?: unknown }>
}
```
Delegates to `ctx.services.notify`, falls back to `ctx.setStatus`. **Hard requirement: t-key + params interpolation** — `successParams` may be a value or a `(result) => params` builder so post-write results ("withdrew {amount}", "vault {id} created") can drive the toast. Fix the existing param-dropping bug: framework/index.ts:504,706,836 call `notify.success?.(successKey)` without params. Extend `FrameworkActionOptions` and `FrameworkOperationRunOptions` with `successParams` the same way. Retires: red-envelope-style interpolated toasts, time-capsule's 14 raw NOTIFICATION_EVENT toasts, neo-multisig's `t('toastVaultCreated',{id})`, gas-sponsor's `requestSubmitted {id}`.

### S2. Notify policy on writes — unlocks the deposit-then-act cohort

Extend `FrameworkWriteSpec`, `FrameworkPaySpec`, and invoke opts with:
```ts
notify?: 'all' | 'errors' | 'silent'   // default 'all' (current behavior)
```
**Design constraint (gotcha #1): `chain.write`/`funds.payAndCall` always-notify is the single biggest migration blocker** — 11 apps keep raw invoke solely to control mid-flow messaging (double-toast, stranded-credit remap, revert→i18n mapping). `'silent'` + typed errors makes those flows migratable without changing single-step apps.

### S3. app.funds extensions — retires deposit-then-act hand-rolls

```ts
app.funds: {
  payAndCall(spec)                     // existing, gains notify policy + throws FrameworkPrepaidActionError
  prepayAndCall(spec: { amount, memo, op, args, waitForCredit?: boolean, notify? })  // deposit confirmed in block, then act (gasbox chain.prepayAndInvoke, custom-anchor waitForDepositConfirmation)
  receiptPay(spec)                     // mainnet receipt-id deposit lane (flashloan, memorial-shrine mainnet fork)
  creditOf(...), withdrawCredit(...)   // existing
}
export class FrameworkPrepaidActionError extends MiniAppError { txid; depositConfirmed: true }
```
Constraint: `FrameworkPrepaidActionError` must be identity-stable (exported class, re-exported by shared) because gasbox/dev-tipping/self-loan branch on "deposit landed but act reverted" to show localized recovery copy. Also export a `revertKeyOf(err, map)` helper for gov-merc-style revert→i18n mapping.

### S4. app.events + app.bus — retires 72 event sites

```ts
app.events: {
  list(name, { limit, offset }?)                       // existing chain.events
  listAll(name, { cap? })                              // ChainService.listAllEvents, bounded
  listParsed<T>(name, decode: (ev) => T, { limit }?)   // ChainService.listEventsParsed
  waitFor(txid, name, timeoutMs?)                      // ChainService.waitForEvent
  value(ev, i), record(ev, slots: string[])            // canonical slot decode (kills the 3 eventValue copies, ~80 sites)
}
app.bus: {
  on(event, handler): () => void   // auto-unsubscribed on lifecycle unmount
  once(event, handler): () => void
  emit(event, payload?): void
  off(event, handler): void
}
```
Migration rule: eventBus emits on channels with **no subscriber** (documented: unbreakable-vault `vault:*` 14 sites, wallet-health, dev-tipping/gas-sponsor side-channels) are **deleted**, not migrated.

### S5. app.wallet — retires balance sites + isConnected gap + manual balanceOf

```ts
app.wallet: {
  address(): string | null; scriptHash(): string | null
  isConnected(): boolean                       // aa-permissions-lab's sole raw-chain reason
  ensure(): Promise<string>                    // alias of chain.ensureWallet
  observe(): Observable<string | null>         // address changes (subsumes subscribe→reload wiring)
  balance(asset, address?), gas(), neo(), raw(asset), all(address?, extra?)
  observeBalance(asset): { balance: Observable<string>; refresh(): Promise<void> }  // BALANCE_CHANGED-wired
}
```
Backed by optional `services.balance`; when absent, falls back to chain.read balanceOf (what self-loan/soulbound/trustanchor-admin/wallet-health hand-roll today). profitanchor-admin/neo-treasury need arbitrary-address reads — `balance(asset, address)` covers it.

### S6. app.amount null-variants — retires the parse-vs-throw gotcha

```ts
app.amount: {
  gasToFixed8(v, opts)                 // existing, THROWS — semantics unchanged (gotcha #2: do NOT touch)
  parseGasToFixed8(v, opts): string | null      // null-on-invalid
  parseNeoToUnits(v, opts): string | null
  parseAssetToUnits(asset, v, opts): string | null
}
```
Retires flashloan `parsePositiveFixed8` (documented in-code), gas-sponsor, self-loan (useSelfLoan.ts:108-114 documented), neo-pay `toBaseUnits`, quadratic-funding `scaleAssetAmount`. Constraint: null-variants must never throw so localized `t()` error paths keep working.

### S7. app.chain extensions

```ts
chain.arg.publicKey(hex)                      // profitanchor, trustanchor (documented inline)
chain.arg.hash160Raw(value)                   // passes a raw base58 address literal UNCONVERTED — deployed-ABI quirk lane (memorial-shrine, neo-ns); doc-comment why arg.hash160 must not be used
chain.signMessage(msg): Promise<{ signature, publicKey?, data? }>   // normalizes string vs object result shapes (neo-sign-anything, neodid-passport)
chain.invokeMultiple(ops[], { signers?, notify? })                  // aa-market-hub transfer-then-settle with scopes-16 allowedContracts; sanitizes FAULT-state exceptions
chain.waitForState(read: () => Promise<T>, until: (v: T) => boolean, { attempts=4, firstDelayMs=4000, delayMs=5000 })  // the aa-account-lab/aa-session-key-lab confirmation poll, verbatim semantics
chain.enumerate<T>({ countOp | ids, detailOp, decode, cap=500, order='newest' })    // count-then-page fan-out, per-id swallow, sort
chain.contractReady: Observable<boolean>      // milestone-escrow derives this from raw service today
```
Note: `app.chain.readArray` already exists — milestone-escrow and neo-pay carry stale comments claiming otherwise; migrate them onto it. Verify custom-anchor's "detectNetwork has no surface" comment (main.tsx:424) against existing `app.chain.detectNetwork` and migrate.

### S8. app.lifecycle — retires 19 hand-rolled pollers

```ts
app.lifecycle: {
  onMount(fn), onUnmount(fn), onData(loader), reload()
  poll(fn, ms, { immediate = true, pauseWhenHidden = true }): () => void   // auto-cleanup on unmount
  cleanup(fn)
}
```
Binds `ctx.services.lifecycle` when present (impl exists, zero usage today), else standalone visibilitychange impl. Retires explorer dual-cadence tickers, daily-checkin 1s ticker, neo-message poll windows; timestamp-proof's 500ms address poll moves to `app.wallet.observe()` **only if** the wallet-sdk mutation-without-notify bug is fixed in the same change — otherwise keep (exemption §3.6).

### S9. app.clipboard + share

```ts
app.clipboard: { copy(text, { successKey }?), copyAddress(successKey?) }
app.share: { url(text|url, { copiedKey }?) }   // navigator.share → clipboard fallback, AbortError silenced (recovery-guardian semantics)
```

### S10. app.aa

```ts
app.aa: { sponsorship: { check(...), request(...) }, relay(payload), sessionKey: { create(permissions, expiresAt) } }
```
Optional `services.aa`; throws typed `FrameworkCapabilityError` when host lacks AA. Move pure `apps/shared/utils/aa-account.ts` into framework/aa.

### S11. app.permissions

```ts
app.permissions: { list(): string[]; has(perm): boolean; require(perm): void /* throws FrameworkPermissionError */ }
```
Sourced from manifest permissions via launch context. Framework internals call `require()` (chain.invoke → 'invoke:primary', oracle.* → 'oracle:request') so gating is enforced once, centrally.

### S12. app.resources (+ framework/phaser preload)

```ts
app.resources: { url(relPath), image(relPath), tokenArt: { gasUrl, gasPhaserUrl, neoUrl } }
BaseScene.preloadAssets(scene, assets: Record<string, string>)
```
Resolves against host base (onegate | miniapp-platform | standalone).

### S13. app.oracle extensions

```ts
app.oracle.dataFeed: { price(pair, opts?), listPairs(), freshness(record, staleMs) }   // wallet-free JSON-RPC reader core from useMorpheusDataFeed (oracle-price-console, neo-swap staleness)
app.oracle.seal      // extend: publicKey() fetch w/ TTL+stale fallback, algorithm pinning, store(envelope) — phase-tagged FrameworkSealError { phase: 'key'|'package'|'store' } (private-transfer seal.ts)
```
Out of scope: neo-message's Morpheus confidential *reveal* protocol and EVM lane — tracked as future framework/evm work, not this campaign.

### S14. Shared console kernel (apps/shared, not framework)

Extract the preview-builder wiring (lastStatus/lastDigest/requestCount + buildRequest + input_required branch + transient-flag helper) used by 4 oracle consoles + neo-x-bridge + oracle-compute-lab into the existing `ConsoleToolConfig` kit. UI glue → stays in apps/shared by boundary rule.

**Wave 1 tests** (framework/test): one spec per surface + regression tests for: params threading through actions/operations/write success toasts; notify:'silent' suppressing exactly the right toasts; FrameworkPrepaidActionError identity across the shared re-export; parse* null-variants never throwing; storage `neo:<appId>:` prefix compatibility; eventValue parity across the 3 retired copies; hash160Raw passthrough (no conversion).

Wave 1 verification: `npm run -s test:framework && npx tsc -p framework && npm run -s test:shared` (shared re-exports must not break existing app tests).

---

## 3. Waves 2..6 — app migration batches

Ordering = (sites retired) / risk. Per-app verification everywhere:
```
npx tsc -p apps/<app>                                   # per-app typecheck
cd apps/shared && npx vitest run <app-name>             # per-app test filter (files named <app>.*.test.ts*)
```
Per-wave gate: `npm run -s test:shared && node scripts/run-miniapp-tests.mjs && npm run -s lint`.

### Wave 2 — mechanical low-risk (~150 sites, low risk) — 18 apps

**2A. notify/guard + service-swap** (needs S1, S4, S5, S9, S10):
aa-account-lab, aa-permissions-lab (isConnected → app.wallet), aa-relay-console (→ app.aa), graveyard, event-ticket-pass (8 try/catch+setStatus → actions.register; arg.hash160 at lines 296/418 only), explorer (runtime-cache → app.storage.local, pollers → app.lifecycle.poll, delete dead chain/events injections), forever-album (storage + chain-as-identity → app.wallet), neo-convert, neo-swap, profitanchor-admin, trustanchor, trustanchor-admin, recovery-guardian (clipboard/share via S9), wallet-health (balances → app.wallet, checklist → app.storage.local, delete dead emits).

**2B. console-kernel adoption** (needs S14): oracle-http-console, oracle-neodid-console, oracle-seal-console, oracle-vrf-console, oracle-compute-lab, neo-x-bridge.

**No-op verify only**: asset-factory, miniapp-factory, nft-factory.

Wave-2 in-app sites that must NOT migrate: aa-account-lab main L132 comparison key; aa-permissions-lab try/catch hash site; event-ticket-pass lines 552/774 validity checks; neo-convert {bigEndian,littleEndian} key tooling (see §3.6).

### Wave 3 — medium risk, surface-dependent (~130 sites) — 19 apps

**3A. signing / oracle surfaces** (needs S7 signMessage, S13):
neo-sign-anything, neodid-passport (keep translateKnownError mapping app-side — auto-notify must not leak raw resolver text), oracle-price-console (reads → app.oracle.dataFeed; keep non-throwing {success,error} action shape, toast via app.notify branches), private-transfer (seal.ts → app.oracle.seal phase errors; history → app.storage.local; keep false-not-throw validators), automation-copilot (storage + actions table; **gateway envelope + auth-header harvesting stay app-side**, exempt).

**3B. amounts / events / two-step-lite** (needs S2, S3, S5, S6, S7):
flashloan (parseGas*, receiptPay), gas-sponsor (successParams toast, app.wallet balances; **sponsorship HTTP client stays in wallet-sdk**, exempt), dev-tipping (payAndCall + FrameworkPrepaidActionError remap to tipPrepaidNoTip), daily-checkin (notify:'silent' invokes keep evidence recorder), aa-session-key-lab (notify:'silent' + waitForState; keep network-arity arg building app-side), breakup-contract (notify:'silent' two-step; L410/L486 stay), council-governance (migrate reads/args; **keep HTTP fallback rethrow-original wrapper**, exempt), neo-pay + neo-pay-shared-example (app.chain.readArray exists — fix stale comment; parse* scaler; dissolve cross-app import into shared package export), soulbound-certificate (split dual-use normalizeHash160: arg half → arg.hash160, fail-closed comparison half stays), memorial-shrine (arg.hash160Raw; mainnet fork → receiptPay), neo-ns (arg.hash160Raw; **nnsRpc iterator-traversal indexer reads stay**, exempt until n3index moves into framework), timestamp-proof (invoke → app.chain w/ notify:'silent'; journal → storage; address poll per S8 caveat), unbreakable-vault (raw ChainService → app.chain; events → app.events.waitFor + re-read reconciliation; **delete 14 dead vault:* emits**), profitanchor (runAnchorAction keeps status/history bookkeeping but writes go notify:'silent' + app.notify.error; arg.publicKey).

### Wave 4 — deposit-then-act cohort (high risk, ~60 sites) — 6 apps

Needs S2+S3 proven in Wave 3. One app per PR, manual flow-test on testnet lane in addition to suites.
gov-merc (payAndCall silent + revertKeyOf for biddingClosed/bidDepositHeld; keep safeHash160Arg null-guards), milestone-escrow (prepayAndCall + FrameworkPrepaidActionError for depositPrepaidNoEscrow; contractReady observable; keep hash160-throw→localized conversion pattern via parse-style guard), self-loan (credit-shortfall top-up → funds; parse* scalers per useSelfLoan.ts:108-114; success-nonce pattern replaced by successParams builders), time-capsule (parametrized toasts → app.notify; bury flow → prepayAndCall silent; content store → app.storage.local; keep expected-revert regex→info-toast classification app-side), custom-anchor (4-step provisioning: keep sequential orchestration app-side but each step on framework invoke notify:'silent' + waitForState; anchor-agents.ts moves to framework per boundary audit), gasbox (prepayAndCall replaces chain.prepayAndInvoke; recovery walks → app.events.listAll capped; commit/reveal keeps typed-error branching — verify FrameworkPrepaidActionError identity test before starting).

### Wave 5 — bespoke rewrites (high risk, ~35 sites) — 5 apps

aa-market-hub (raw SDK → chain.invokeMultiple with custom signer scopes + FAULT sanitization; runWriteAction → operations + notify:'silent'), neo-multisig (parametrized toasts now expressible via successParams builders keyed on post-write status; activity log → app.storage.local; widened ChainArg cast → arg.array), neo-treasury (writes → app.chain notify:'silent'; **external-address RPC failover balance sweep stays** until n3index/framework rpc lands), quadratic-funding (full legacy-stack rewrite onto app.chain/app.funds/app.amount.parse*; replace succeededSince snapshot success-detection with guardResult — this is a rewrite, not a migration), neo-message (**partial**: device cache → app.storage.local, busyIds/status via operations; EVM lane + confidential reveal stay raw, tracked for a future framework/evm wave).

### Wave 6 — consolidation and deprecation

Delete apps/shared duplicates now re-exporting framework (utils forks, eventValue copies, createObservable in react/context.ts → re-export). Deprecate TransferService (→ app.funds), createActionHandlers, useAllEvents (→ app.events.listAll), notify.guard legacy path. Dissolve cross-app source imports (neo-pay-shared-example, profitanchor-admin, trustanchor-admin) into shared/framework exports. Update MEMORY.md gotchas (amount scaler + always-notify entries now have framework answers).

### 3.6 Permanent / conditional exemptions (must NOT migrate, with reasons)

| Site | Reason |
|---|---|
| aa-account-lab main.tsx:132; aa-permissions-lab hash site; breakup-contract :410/:486; event-ticket-pass :552/:774; soulbound-certificate comparison half of normalizeHash160; private-transfer validators | false-not-throw semantics are load-bearing for localized validity/witness checks; arg.hash160 throws |
| neo-convert addressToScriptHash | it IS the app's product (key tooling), not plumbing |
| memorial-shrine / neo-ns raw-address Hash160 literals | deployed-ABI quirk — must reach the wallet unconverted; use arg.hash160Raw, never arg.hash160 |
| council-governance readContract HTTP fallback | deliberately rethrows the ORIGINAL wallet error after failed bridge; readRaw cannot replicate |
| automation-copilot gateway envelope + auth-header harvesting | no framework gateway client; moving partially would drop credentials on every request |
| gas-sponsor sponsorship HTTP API | lives in wallet-sdk; moves only when wallet-sdk moves into framework (out of campaign scope) |
| neo-message EVM lane + Morpheus confidential reveal | framework is N3-only; app.oracle does not cover the reveal protocol |
| neo-treasury external-wallet RPC balance failover | no framework surface for arbitrary-address multi-endpoint RPC (until n3index moves) |
| timestamp-proof 500ms address poll | wallet-sdk mutates address ref without notifying; keep until SDK subscription bug fixed |
| neo-ns nnsRpc getnep11balances/invokefunction | chain bridge cannot traverse tokensOf iterators |
| aa-session-key-lab network-conditional 7-arg/5-arg building | contract-specific business logic, correctly app-side |
| profitanchor-admin main.tsx eventBus injection | conditional (expires Wave 3B/6): cross-app import of profitanchor's useProfitAnchor requires the shared EventBus class — private fields defeat a structural app.bus swap; migrates with that hook (Wave 3B) and the cross-app dissolve (Wave 6) |

---

## 4. Acceptance criteria (measurable)

1. `grep -rn "ctx\.services\.notify" apps/*/src` → **0** hits (from 126). No exemptions — S1 params support removes the last reason to stay raw.
2. `grep -rln "ctx\.services\.chain" apps/*/src` → only apps in §3.6 (from 86 sites); each surviving site carries an in-code `// framework-exempt:` comment naming the reason.
3. `grep -rln "ctx\.services\.events\|eventBus" apps/*/src` → 0 (from 24 apps); all documented dead-channel emits deleted (verify: unbreakable-vault, wallet-health, dev-tipping, gas-sponsor).
4. runtime-cache/safe-storage/localStorage direct use in apps → 0 (from 27 sites); storage-prefix compat test proves existing user data (`neo:<appId>:` keys) still resolves.
5. framework/utils diverged forks: 6 → 0; framework/index.ts private re-impls (sha256Hex, localStorageAvailable, txidOf): 3 → 0; `apps/shared/utils/*` re-export framework canonicals; instanceof-compat test for FetchTimeoutError/HttpResponseError/MiniAppError passes.
6. Every S1–S13 surface has a dedicated spec in framework/test; `npm run -s test:framework` green; framework boundary test updated for new modules.
7. After every batch: per-app `npx tsc -p apps/<app>` green + `cd apps/shared && npx vitest run <app>` green. After every wave: `npm run -s test:shared`, `node scripts/run-miniapp-tests.mjs`, `npm run -s lint` green.
8. Behavior invariants: toast strings byte-identical (params interpolate through `t(key,params)`); `app.amount.gasToFixed8` still throws, `parse*` never throw; write/payAndCall default notify behavior unchanged for already-migrated single-step apps; deposit-then-act apps still show stranded-credit recovery copy (manual testnet check per Wave 4 app).
9. End of campaign: raw-site total ~368 → ≤ ~25 exempted sites, all listed in §3.6 and comment-tagged.
