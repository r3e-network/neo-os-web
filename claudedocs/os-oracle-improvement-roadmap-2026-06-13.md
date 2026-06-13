All key claims verified: file sizes match, and `template-studio-helpers.ts` has zero references in `src` (confirmed dead). The findings JSON is well-grounded. Producing the roadmap.

# IMPROVEMENT ROADMAP — Miniapp OS + Morpheus Oracle

## 1. Executive read

**Miniapp OS (host platform)** — Architecturally healthy but carrying classic late-stage accretion: a handful of god-files (`PlayAreaShared.tsx` 1470L, `templates/page.tsx` 1339L, `recipes.ts` 1110L, `miniapp-templates.ts` 1063L) and several abandoned-extraction states where a helper module was written but never wired in, leaving two live-looking copies of the same logic. The biggest *correctness-adjacent* risk is **logic drift across duplicated lanes** — the wallet adapter's `invoke`/`invokeMultiple` fee-guard/rebuild code, the desktop/mobile action-console derivation, and the deposit-then-act recipe error copy — where a fix applied to one copy silently misses the other. The biggest *cheap* wins are removing genuinely dead code (`lib/wallet/types.ts`, three dead admin hooks, the duplicated `template-studio-helpers.ts`) and killing two redundant Supabase Realtime subscriptions on the most-opened page. There is no evidence of a structural failure; this is a maintainability/perf-hygiene pass, not a rescue.

**Morpheus Oracle** — Healthy on the money path (the relayer's retry/dead-letter ceiling logic is real and `recordDeliveryExhaustion` is already extracted), but two files concentrate nearly all the debt: `fulfillment.js` (a ~537-line `processEvent` with a ~385-line catch block) and `feeds.js` (a 1523-line god-file mixing six concerns). The highest-leverage win is making the dead-letter/retry logic **unit-testable in isolation** — today it is only exercised by 4 end-to-end ceiling tests, which makes the money path's most dangerous branches the hardest to verify. Performance debt is real but mostly *cold-start-dominated* (the sequential `block_cursor` mainnet scan bites only on post-downtime catch-up) or *low-absolute-cost* (registry re-cloning in a worker that runs every 2-5 min); the genuinely worthwhile perf item is the **unmemoized `/api/onchain/state`** endpoint, which fans out 7 RPC calls per poll with no cache while being the dashboard's hottest endpoint. Several cross-cutting hygiene items (timing-unsafe secret compares, duplicated `mapWithConcurrency`/`trimString`) are mechanical and safe.

---

## 2. Quick wins (small effort, high/medium impact — batchable)

### OS — batch into one PR per cluster

| # | File | Change | Benefit |
|---|------|--------|---------|
| O1 | `platform/host-app/pages/miniapps/[id].tsx:570` + `hooks/useActivityFeed.ts:49` | Surface `realtimeNotifications` out of `useActivityFeed` (or accept as prop); drop the page-level `useRealtimeNotifications`. **Preserve the `showNews` gate** — only subscribe/fetch when the news tab is shown. | Halves WS channels + the duplicate `/api/app/{id}/news` fetch on every detail open (medium, not high — one topic-join + one fetch per open). |
| O2 | `platform/admin-console/src/app/templates/lib/template-studio-helpers.ts` + `templates/page.tsx:36-243` | Import the 12 symbols from the helper module; delete the inline copies. (Confirmed dead: zero `src` references.) | −150L off the 1339L god-file, 0 dead modules. Mechanically clean (private `asString`/`asStringArray` travel inside `buildMiniAppInstallDraft`). |
| O3 | `platform/host-app/lib/wallet/types.ts` + `lib/wallet/index.ts` | Delete both (or re-export canonical types from `base.ts`/`store.ts`). | Removes two divergent `WalletAccount`/`WalletProvider` definitions that can mislead edits. |
| O4 | `platform/admin-console/src/lib/hooks/useServices.ts` | Delete `useUser`, `useMiniApp`, `useServiceHealth` + barrel re-exports + tests covering only them. | ~60L removed; public hook surface shrinks to what's consumed. |
| O5 | `platform/host-app/components/MiniAppPlayfield.tsx:99` | Add the `document.visibilityState==='hidden'` guard already used in `useActivityFeed`; refresh once on `visibilitychange`. | Stops the 15s chain-state poll storm on backgrounded tabs (heaviest reader). |
| O6 | `platform/host-app/lib/miniapp-invoke/recipes.ts:142` | Add `fundedRecipe(appName, noun, buildPlan)` / `simpleRecipe(...)` factories deriving `notConfiguredError` + `multiInvokeUnavailableError`. `recoveryAccountRecipe` already demonstrates the pattern. | −30L repeated string literals; guaranteed consistent copy across 21/13 sites. |
| O7 | `platform/host-app/pages/miniapps/index.tsx:256` + `pages/index.tsx` | Extract `serializeMiniAppForCatalogProps(app)` to lib; import in both pages. | Single source for SSG prop shape; −30L; removes field-drift hazard. |
| O8 | `platform/host-app/pages/index.tsx:214` | Drop `targetNetwork` from the catalog-fetch effect deps (catalog body never varies by network on `scope=all`). | Stops re-fetching the network-independent catalog on every network switch. |

### Oracle — batch into one mechanical-hygiene PR + targeted perf items

| # | File | Change | Benefit |
|---|------|--------|---------|
| R1 | `apps/web/lib/onchain-state.ts` | Wrap `fetchOnchainState` in a per-`(network,limit)` TTL cache (~10-15s) mirroring `feeds-status.ts:152` `getFeedsStatusBody`; add a `reset*` test hook. **Key must include network AND limit.** | Collapses M-clients × 7 RPC reads/interval → ~1 per TTL window; cuts dashboard poll latency. Proven local pattern. |
| R2 | `workers/nitro-worker/src/oracle/feed-registry.js:226` | Memoize `getFeedPairRegistry()` keyed on the raw `MORPHEUS_FEED_PAIR_REGISTRY_JSON` string. | Removes hundreds of redundant `deepMerge`+`JSON.parse` per feed run. (Low absolute cost — worth it as ~10L drop-in, not as a perf emergency.) String-keyed cache stays correct under the env-mutating tests. |
| R3 | `apps/web/lib/control-plane-auth.ts` + `cron-auth.ts` | Replace `===` secret comparisons with `timingSafeCompare` from `@neo-morpheus-oracle/shared`. **Confirm `cron-auth.ts:23` `NODE_ENV==='production'` guard fully gates the `vercel-cron` UA path.** | Closes a timing side-channel on server-only auth helpers. Security item, low effort. |
| R4 | `workers/nitro-worker/src/chain/signing.js:200` + 6-7 handler sites | Have handlers use `signed.tee_attestation` instead of re-calling `maybeBuildDstackAttestation`. | Removes duplicate enclave round-trip on attested lanes. **Note:** default path short-circuits to null (`NITRO_EMIT_ATTESTATION` unset), so this only bites opt-in-attestation requests — and the "surfaced value can differ" rationale is false (report_data is identical). Still a clean dedup. |
| R5 | `apps/web/app/docs/architecture/page.tsx` (+13 sibling docs pages) | Remove `'use client'` from the static docs pages (keep on `feed-status`/`networks`). | No client JS/hydration for static content; largest docs-route TTI win, near-zero risk. |
| R6 | `apps/web/package.json` | Remove `ethers ^6.16.0` (no source usage; web is Neo N3/dApi only). | Smaller install surface; prevents accidental bundle inclusion. Verify with a build. |
| R7 | `apps/web/components/ui/CodeBlock.tsx` | Switch to `highlight.js/lib/core` + `registerLanguage` for only the used grammars (json, cs, plaintext, bash/js). | Drops most of the highlight.js payload from any code-rendering route. (Medium effort — verify language coverage.) |

---

## 3. Larger refactors (medium/large effort — sequence + safety story)

### Oracle (do these first — highest leverage, money path)

**R-A. Decompose `processEvent` and collapse the outcome recorders** — `workers/morpheus-relayer/src/fulfillment.js:839`
- **Sequence:** (1) Extract `scheduleCallbackRetry(config, state, persistState, logger, event, kernelIntent, {nextAttempts, route, errorMessage, extraRetryItemFields, upsertStatus, upsertWorkerResponse})` returning the standard `{retry_status}` envelope — collapses the 3 near-identical `enqueueRetryItem` arms (1102-1143, 1163-1210, 1290-1336) + the trailing `scheduleRetry` arm. (2) Extract `recordTerminalOutcome(...{localStatus, durableStatus, route, lastError, metric, logLevel, logMessage, extraMeta})` to absorb the `settled` (991-1031) and `terminal-config` (1033-1082) arms. (3) Reduce `processEvent` to a dispatcher (~120L target). (4) Thread the already-computed `kernelIntent` into `recordProcessedEvent` so it stops re-deriving.
- **Calibration:** `recordDeliveryExhaustion` (774-837) is **already** extracted and called from all three exhaustion sites — that portion of the originally-claimed win is done, so the real scope is smaller than billed.
- **Safety:** Must stay green — the 4 end-to-end ceiling tests at `src/fulfillment.test.mjs:451/473/501/527`. The arms differ only in well-defined fields (status string, `worker_response` shape, `finalize_only`/`terminal_error`) a parameterized helper preserves. **Then add the missing unit test** for `worker-exhausted → finalize → finalize-fails → re-enqueue` (currently untested) using the `config.hooks.fulfillNeoRequest` injection seam (`fulfillment.js:300`). **Risk:** this is the GAS-callback delivery path; behavior-preserving extraction is mandatory, validate by table-driven tests before/after.

**R-B. Split `feeds.js` into peer modules** — `workers/nitro-worker/src/oracle/feeds.js`
- **Sequence:** behavior-preserving extraction under `oracle/feeds/`: `feed-state.js` (state file + cache + supabase, L52-271), `neo-stack-decode.js` (L694-804), `decimal.js` (the converters, L310-373), `sync-policy.js` (L495-884), `feed-submit.js` (N3 submission + fallback detectors, L1067-1234). `feeds.js` keeps the public handlers + the `handleOracleFeed` orchestration loop (L1247-1490) and **re-exports everything** so `index.js` (8 public fns) and `feeds.test.mjs` (17 `__forTests` shims) are untouched.
- **Safety:** `feeds.test.mjs` (22/22, verified passing) pins behavior. Keep the same call sequence. **Risk:** low — internal module move, public + test surface preserved. De-prioritize the speculative "reusable by relayer / decimal duplicates elsewhere" justifications; no live external consumer exists.

**R-C. Batch the `block_cursor` mainnet scan** — `workers/morpheus-relayer/src/neo-n3.js:382`
- **Sequence:** wrap the block-level work in the existing `mapWithConcurrency` under `resolveScanConcurrency` (default 4, max 8); preserve ascending order on flatten. Add an equivalence + fault-abort test modeled on `neo-n3.test.mjs:272` ("batched scan ≡ sequential path") — this path is currently **untested**.
- **Critical constraint:** keep the per-tx `getapplicationlog`. Do **NOT** chase the "getblock verbose returns notifications" shortcut — it's factually wrong for Neo N3 (verbose returns headers + tx bodies, not execution notifications). Optionally add a cheap contract pre-filter if available.
- **Safety:** the helper is already proven in this exact file (sibling `scanNeoN3OracleRequestsById` uses it). Impact is catch-up-dominated (cold-start/backfill after downtime), not steady-state — sequence this *after* R-A/R-B unless a backfill is imminent. **Risk:** low; the equivalence test is the gate.

### OS (structural, no correctness/coverage gap — sequence after dead-code cleanup)

**O-A. Extract `signAndRelay` from the WIF adapter** — `platform/host-app/lib/wallet/adapters/wif.ts:537`
- Extract a private `signAndRelay(sdk, network, {script, txSigners, rpcPreflight, systemFee, validUntilBlock})` owning blockCount/magic/fee/draft/final/relay/rebuild. `invoke()` builds single-call script + `invokefunction` preflight; `invokeMultiple()` builds concat script + `invokescript` preflight; both call the helper. **−~120L; removes the genuine fee-guard/rebuild drift risk** between the two lanes (564-568 ≡ 725-729, 610-625 ≡ 771-786 are verbatim copies today).
- **Safety:** `wif.adapter.test.ts` already covers both lanes incl. stale-rebuild, duplicate relay, fee-estimation failure — behavior-preserving extraction is directly verifiable. **Risk:** this signs/relays real transactions; the existing test coverage is the gate, do not change observable behavior. Plumb `systemFee`/`validUntilBlock` through the helper signature (packaging detail).

**O-B. Centralize the host-proxy boilerplate** — `platform/admin-console/src/app/api/miniapps/*`
- Add `proxyToHost(req, {path, method, searchParams, body, fallbackError, timeoutMs, onSuccess?})` to `host-admin-proxy.ts` handling auth-base-check → URL build → fetch → `!ok→parseHostErrorPayload→jsonError` → JSON-parse-with-fallback → 502 catch, **with an optional `onSuccess` transform** for the ~4 routes with divergent success shaping (`route.ts` list unwrap, `[id]` GET 404+unwrap, `publish-requests/export` CSV, `import-definitions`). Centralize the scattered timeout literal (30× 15000, 16× 20000, 4× 10000). Keep per-route zod validation.
- **Safety:** `api-routes.test.ts` (1467L) mocks global fetch and asserts on `fetchSpy.mock.calls` — largely transparent to a proxy refactor. **Risk:** low, contained to one subsystem. This is DRY/maintainability, not correctness — sequence it low.

**O-C. Break up `PlayAreaShared.tsx`** — `platform/host-app/components/playarea/PlayAreaShared.tsx:531`
- Split into `playarea/bridge/*` (the security-critical wallet-bridge types/normalizers/`handleEmbeddedWalletBridgeRequest`/`useEmbeddedWalletBridge` — make these pure functions **directly unit-testable without rendering an iframe**), `playarea/shared-helpers.ts` (url/format/tone), and keep `PlayAreaShared.tsx` as the component barrel.
- **Safety:** the bridge is the host's security boundary (postMessage wallet bridge). Extracting normalizers as pure functions *improves* testability — add unit tests for `normalizeBridgeOperation` and the request handler as part of the split. **Risk:** medium — this is the wallet trust surface; do it as pure-move first, then add tests, no behavior change.

---

## 4. Cross-cutting themes (worth a dedicated pass each)

1. **Duplicated `mapWithConcurrency` (Oracle):** 4 copies across `queue.js:503`, `request-processor.js`, and the two engine scans (2 distinct behaviors). Move the **fail-fast variant** (the safer abort-the-tick default both scans rely on) into `@neo-morpheus-oracle/shared/utils` (where `trimString`/`parseTimestampMs` already live); import everywhere. One definition, one test. **Pair with R-C** so the batched scan lands on the shared helper.

2. **Re-declared primitives (both systems):** `trimString` is locally redefined in 3 relayer modules + 14 web lib files despite a shared export; `getSupabaseRestConfig` is verbatim in 3 oracle modules; `resolveSupabaseNetwork`, `strip0x`, `isPlainObject` are scattered. A single mechanical import-and-delete pass (relying on the existing suites) removes a whole class of drift. **Keep env-var name strings verbatim** — they are the systemd integration contract.

3. **Visibility-agnostic polling (both systems):** `MiniAppPlayfield.tsx:99` (15s), `apps/web/app/status/page.tsx`, and the dashboard tabs all poll on wall-clock with no hidden-tab guard, while `useActivityFeed` already has the fix. One pass to apply the `visibilityState` gate everywhere. Pairs with the `onchain-state` cache (R1).

4. **Server-side read-endpoint caching (Oracle web):** `feeds-status.ts` has the right pattern (module TTL cache + reset hook); `onchain-state.ts` and the catalog routes (`platform/host-app/pages/api/miniapps/catalog.ts`) don't. A dedicated "cache the static-ish reads" pass: `(network,limit)`-keyed onchain-state, `(status,scope,network,search='')`-keyed catalog payload (the `scope=all` empty-search variant both pages request is the dominant, fully-cacheable key).

5. **Missing test seams on the money/auth paths:** the relayer dead-letter ceiling logic, `attestation.ts` verification, and `control-plane-auth.ts` are pure-ish functions with no isolated tests. The refactors (R-A) and the auth change (R3) should each land *with* the unit tests that the extraction newly enables — this is the durable payoff, not the line-count reduction.

6. **Abandoned-extraction "worst of both worlds" (OS):** `template-studio-helpers.ts` (O2) is the flagship, but the pattern recurs — a helper was written, never imported, and the consumer kept its inline copy. Worth a quick `grep` sweep for other unreferenced `lib/*helpers*` modules during the dead-code PR.

---

## 5. Explicitly de-prioritize (tempting, not worth it now)

- **"Drop the per-tx `getapplicationlog` because getblock returns triggers" (R-C sub-claim):** factually wrong for Neo N3 — `getblock` verbose returns headers + tx bodies, not execution notifications, and `getapplicationlog-by-block` is not a standard C# node method. Implementing the concurrency wrapper is worth it; chasing this shortcut would break notification reads. **Do not pursue.**

- **Treating `feed-registry` memoization (R2) / attestation dedup (R4) / signing double-build as "high" perf wins:** all real redundancies but low absolute cost — a 2-5 min background worker cloning ~36 small objects, or an enclave call that's *disabled by default*. Do them as cheap hygiene riding along with their module's refactor; don't schedule a perf sprint around them.

- **Adding GET retry/backoff to the SDK and rpc proxy (`client.ts:561`, `rpc/[fn].ts`):** medium effort, needs careful method-aware scoping to never retry POST intents (double-spend risk). The current `MAX_RETRIES=0` dead machinery should just be **deleted** (call `fetchWithTimeout` directly) rather than activated — retrying a single-gateway non-idempotent POST is unsafe and the read path's idempotency benefit is marginal.

- **VRF → ECVRF proof implementation (`oracle/vrf.js`):** large effort to add real algorithmic verifiability when no downstream contract currently requires it. The right move is the one-line capability-registry note documenting it as enclave-attested CSPRNG (option (a)), **not** the cryptographic build-out (option (b)).

- **Rewriting `claimAutomationJob`'s constraint-violation control flow / unbounded provider caches with full LRU:** real robustness smells, but the automation claim works today and the caches are bounded in practice by the static pair set. The provider-cache bound is a cheap prune-on-set (do it), but don't over-engineer an eviction subsystem.

- **Any refactor that touches deployed-parity or frozen surfaces:** the C# contracts are frozen (bytecode-preserving splits only, per established practice), and `config.js`/`neo-signers.js` env-var **names** are the systemd contract — the proposed config-reader-helper and signer-table refactors are fine *only* if every env key string stays verbatim. Treat "change how env is read/grouped" as in-scope and "rename/remove any env key" as out-of-scope without an explicit ops migration.

**Recommended global order:** Oracle (R-A → R-B → cross-cut #1/#2) and OS dead-code cluster (O2/O3/O4) can proceed in parallel — different repos, low blast radius. Land the quick-win batches (O1/O5–O8, R1/R3/R5/R6) opportunistically alongside. Defer O-B/O-C and R-C until the higher-leverage testability refactors (R-A) are in and green.

**Key file references:** OS — `/Users/jinghuiliao/git/r3e/neo-miniapps-platform/platform/host-app/{pages/miniapps/[id].tsx, components/playarea/PlayAreaShared.tsx, lib/wallet/adapters/wif.ts, lib/miniapp-invoke/recipes.ts}`, `platform/admin-console/src/app/templates/page.tsx`. Oracle — `/Users/jinghuiliao/git/r3e/neo-morpheus-oracle/workers/morpheus-relayer/src/{fulfillment.js, neo-n3.js, config.js}`, `workers/nitro-worker/src/oracle/feeds.js`, `apps/web/lib/onchain-state.ts`.