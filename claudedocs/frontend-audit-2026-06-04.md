# Frontend Audit Report

Generated 2026-06-02 · 60 miniapps · 8 scoring dimensions

## 1. Overall Health

**Average score across all dimensions: 8.45 / 10**

| Dimension | Avg | Rank |
|-----------|-----|------|
| professional | 8.7 | strongest |
| beauty | 8.7 | strongest |
| layout | 8.7 | strongest |
| consistency | 8.6 | |
| functionalCorrect | 8.5 | |
| functionalComplete | 8.3 | |
| **businessLogic** | **8.1** | **weakest** |
| **userFriendly** | **8.0** | **weakest** |

**Read:** Visual/structural quality (professional, beauty, layout, consistency) is uniformly high — the design system is landing well. The drag is on **substance over surface**: the two weakest dimensions are `userFriendly` (8.0) and `businessLogic` (8.1), followed closely by `functionalComplete` (8.3). The pattern is consistent: apps look finished but under-deliver on validation feedback, reachable features, and business-state correctness.

---

## 2. Apps Scoring ≤ 7.5 (worst-first)

| Slug | Avg | Weakest dimension(s) | Top issue |
|------|-----|----------------------|-----------|
| `neo-pay-shared-example` | 7.0 | functionalCorrect (4) | GAS create flow broken: `deriveSchedule` emits 16–17-decimal float rate strings (`0.7/7`→`0.0999…`) that `toBaseUnits` rejects → both default GAS presets fail with misleading "invalid amount" |
| `milestone-escrow` | 7.3 | functionalComplete (5), businessLogic (5) | Multi-milestone is the core feature but create form hardcodes a single milestone `[{ amount }]`; staged releases unreachable despite full composable/contract support |
| `breakup-contract` | 7.5 | functionalCorrect (5), businessLogic (5) | Client mints `Date.now()` as the escrow id, but the kernel assigns its own sequential id — Sign/Break target a non-existent escrow and status never advances past 'pending' |

Three apps fall at or below 7.5. All three are dragged down by **functional/business correctness, not appearance** — every one scores ≥8 on professional/beauty/layout. The defects are real integration or feature-completeness bugs, not polish gaps.

---

## 3. All HIGH-Severity Issues (grouped by app)

### `breakup-contract`
**[functionalCorrect] Escrow id invariant is false** — `useBreakup.ts createContract/signContract/breakContract`
The composable mints `generateContractId() = Date.now()` and reuses it as both the os-storage key and the `escrowId` passed to `escrowService.fund()`/`completeMilestone()`. The kernel assigns its OWN sequential id (`escrowId = TotalEscrows() + 1`); the `Date.now()` timestamp (~1.7e12) is never reconciled. Sign calls `fund('1749000000000')` against a non-existent escrow; Break has the identical defect. Create succeeds, Sign/Break can never hit the right escrow.
**Fix:** Capture the id returned by `escrowService.create()` (the kernel `escrowId`), persist it as a separate field on `StoredContract`, and pass *that* (not `contract.id`) to fund/complete/refund.

### `last-survivor`
**[functionalCorrect] TOTAL KEYS binds to the buy-selector, not chain state** — Participation strip
`TOTAL KEYS` binds to the `keyCount` observable (the buy picker), not the round total `totalKeysInRound` (a bigint never exported from the composable). The stat just mirrors whatever the user dials in (default 1) and changes live with +/− clicks.
**Fix:** Export `totalKeysInRound` from the composable, add to `main.tsx state`, bind TOTAL KEYS to it. Stop binding to the buy-selector `keyCount`.

**[businessLogic] YOUR SHARE % uses the wrong denominator** — Participation strip
Computed as `(userKeys / keyCount) * 100` where `keyCount` is the buy-selector value. A user owning 5 keys who dials the picker to 10 sees "50%" — meaningless. Wrong whenever picker ≠ total keys (almost always).
**Fix:** Use `userKeys / totalKeysInRound * 100`, guarding divide-by-zero. Keep `keyCount` solely for cost estimation.

### `milestone-escrow`
**[functionalComplete] Multi-milestone create is unreachable** — `PlayArea.tsx:73` + composable
App is "release funds in stages" and the contract/composable support 1–12 milestones (`milestoneAmounts[]`, sum validation), but the form hardcodes `milestones: [{ amount }]`. No add/remove UI, no per-milestone inputs, no running total. Locale keys (`addMilestone`, `milestoneAmount`, `totalAmount`, `totalHint`) exist but are unused. Every escrow is effectively single-stage.
**Fix:** Add a milestone repeater (amount inputs + Add/Remove for 1–12 + live total) and pass the real array to `dispatch('createEscrow', { milestones: [...] })`. UI-only — composable already handles arrays.

**[businessLogic] Cards never show amount/asset/progress** — `EscrowList.tsx`
`formatAmountFunc` is declared in props and passed down but never destructured (line 23) or called. Cards show only title + counterparty + status. For a fund-locking app, users cannot see how much is locked, which asset, how many milestones, or how much is released.
**Fix:** Render `formatAmountFunc(escrow.assetSymbol, escrow.totalAmount)` per card, plus a released/total line and a milestone progress indicator (claimed/approved of `milestoneAmounts.length`).

### `neo-convert`
**[businessLogic] Disassembler uses Neo Legacy (NEO2) opcodes, not N3** — `services/neo.ts disassembleScript()`
The branch `if (opcode >= 0x01 && opcode <= 0x4b)` emits `PUSHBYTES{N}`, which does not exist in N3 (0x00–0x05 = PUSHINT8..256, 0x0C–0x0E = PUSHDATA1/2/4, 0x10–0x20 = PUSH0..16). Real N3 scripts disassemble to wrong opcodes. The dedicated PUSHDATA1/2/4 branches (lines 154–176) are **dead code** — 0x0C/0x0D/0x0E satisfy the legacy range first and misread as `PUSHBYTES12`. This is 1 of 4 advertised features.
**Fix:** Rewrite to N3 semantics: handle 0x00–0x05 (fixed widths), 0x0B PUSHNULL, 0x0C/0x0D/0x0E PUSHDATA1/2/4 *first*, 0x0F PUSHM1, 0x10–0x20 PUSH0..16, then fall back to `OPCODE_NAME_BY_VALUE`. Remove the legacy `PUSHBYTES` branch.

### `neo-pay-shared-example`
**[functionalCorrect] GAS create flow broken by float-precision** — `main.tsx deriveSchedule` + `useNeoPayApp.toBaseUnits`
`deriveSchedule` computes rate via JS float and stringifies: `0.7/7 → "0.09999999999999999"`, `20/30 → "0.6666666666666666"`. `toBaseUnits` regex `/^\d+(\.\d{1,8})?$/` rejects >8 decimals → returns `0n` → `handleCreateVault` throws `invalidAmount`. Both default GAS presets (7d=0.7/7, 30d=20/30) and common inputs (100 GAS / 30 days) fail. NEO and round GAS cases work. No fund loss (throw precedes deposit).
**Fix:** Compute rate in base units with BigInt: convert total to base units, then `rate = totalBase / BigInt(days)`, derive intervals exactly. Or `rate.toFixed(8)` before `toBaseUnits`. Add unit tests for `0.7/7` and `20/30`.

### `neo-pay`
**[functionalCorrect] Same float-precision break (production app)** — `main.tsx deriveSchedule` + `composables/useNeoPayApp.ts toBaseUnits`
`deriveSchedule` uses `String(total / days)` producing 17-significant-digit floats (5 GAS / 30 days → `'0.16666666666666666'`; 1/7 → `'0.14285714285714285'`; even the manifest placeholder 0.03/7 → `'0.004285714285714286'`). Same regex rejection → `invalidAmount` before deposit. Only amounts dividing cleanly into ≤8 dp/day succeed.
**Fix:** Round/quantize the derived rate to 8 decimals before stringifying, or compute directly in base units (`rateBase = totalBase / days`); ensure `rateAmount > 0` after rounding and `rateAmount ≤ totalAmount`. Add unit tests for 5 GAS / 30 days and the 0.03/7 placeholder.

### `unbreakable-vault`
**[functionalComplete] Claim/reclaim flow does not exist** — Claim / reclaim flow
Docs describe a full bounty lifecycle ("Winners receive the bounty minus a 2% fee"; step4 "expired vaults can be reclaimed"), locale defines a `claimable` status, and the composable header says "listing, and claiming" — but there is NO claim or reclaim action (no UI control, no composable function). An expired-vault creator cannot reclaim escrowed GAS; no explicit winner payout. Half the documented loop is unreachable.
**Fix:** Add a `claimBounty`/`reclaimVault` action: register a host action in `main.tsx`, implement the invoke in `useVaultBreaker` (gated on `status==='broken' && winner===wallet`, or `status==='expired' && creator===wallet`), and surface a "Claim Bounty"/"Reclaim Vault" button in the loaded-vault detail block.

**HIGH-issue summary:** 9 high-severity issues across 7 apps. The dominant patterns are **float→base-unit conversion bugs** (neo-pay, neo-pay-shared-example), **stat/share bound to input instead of chain state** (last-survivor ×2), **core feature unreachable from UI** (milestone-escrow, unbreakable-vault), and **client/kernel id mismatch** (breakup-contract). Two of the seven affected apps are the neo-pay pair sharing the identical root cause.

---

## 4. Recurring Problems Across ≥3 Apps (systemic fixes)

### A. `userFriendly` — Validation fires only after submit, never inline (≥9 apps)
**Affected:** milestone-escrow, breakup-contract, aa-market-hub, aa-session-key-lab, automation-copilot, custom-anchor, dev-tipping, flashloan, gas-sponsor, gas-lucky-pool.
The same anti-pattern repeats everywhere: amount/address validation lives in the composable and throws on dispatch, surfacing as a transient toast — while the form has no `min`/`step` attributes, no inline error text, and a primary CTA that looks enabled with invalid input. Users hit a dead-end click and only then learn the constraint (min tip 0.001 GAS, price band, N3 address format, out-of-range amount).
**Systemic fix:** Establish a shared form-validation convention — drive the submit `disabled` state from a parsed-validity predicate, add `min`/`step` to numeric `NeoInput`s, validate addresses against the Neo N3 format (not a `length>=30` heuristic), and bind the composable's error key to the field's inline `error` prop so feedback is pre-submit and field-local. This single convention closes the largest cluster of issues.

### B. `consistency` — Stray non-green hues + misleading `--ns-violet` token aliasing (≥10 apps)
**Affected (token-naming smell):** aa-market-hub, aa-permissions-lab, aa-relay-console, burn-league, dev-tipping, gasbox, graveyard, memorial-shrine, forever-album. **Affected (live stray hue on interactive/status chrome):** council-governance (violet "Voted" badge), daily-checkin (amber/red urgency), gas-lucky-pool (sky-blue stepper + submitted chip), fogplay (navy active "Tails"), dice-game (teal-leaning soft tints), graveyard (red primary CTA), memorial-shrine (blue receipt panel).
Two flavors of the same systemic problem: (1) green accents are plumbed through CSS vars named `--ns-violet*` that only resolve green because they alias `--ns-brand` — a latent regression where un-aliasing turns whole apps violet; (2) actual non-green hues leak onto status/interactive elements, breaking the single-green-accent rule.
**Systemic fix:** Codebase-wide rename of `--ns-violet*` references to `--ns-brand*`/`--ns-accent*` (no visual change, removes the drift trap), and recolor non-terminal status indicators (in-progress, selected, submitted, voted) to the green ramp — reserving red strictly for failure/destructive and treating amber/blue as decorative-only, never on interactive affordances.

### C. `functionalComplete` / `professional` — Orphaned code: dead composables, unused locale keys, stale fallback strings, leftover scaffolding (≥6 apps)
**Affected:** event-ticket-pass (13KB unused `useEventTicketContract.ts` + dead `pages/index/` + ~15 unused keys + wrong docs `contentKey`), forever-album (orphan theme.scss, no-op `eventBus.emit`, ~20 unused keys), fogplay (unimported `static/fogplay.css`, orphan tokens), last-survivor (stale `|| '...'` fallbacks contradicting live locale), graveyard (hardcoded fee string decoupled from `BURY_FEE_GAS`), gas-lucky-pool (dead `formatHash` import).
Parallel/abandoned implementations and unreferenced strings/assets that never render but are drift hazards — the next maintainer can wire in stale code (a divergent accent, contradictory game rules, an out-of-sync fee) and silently regress behavior or visuals.
**Systemic fix:** A cleanup pass: delete unused composables/theme files/`pages/` scaffolding, prune locale keys to the rendered surface (or wire intended ones like `connectPrompt*`/`wrongChain*`/`soldOut`), derive displayed values (fees, rates) from their source constants rather than hardcoding, and remove `|| '...'` literal fallbacks now that all keys resolve via `t()`.

### D. `businessLogic` — Stats/counters bound to placeholder or wrong source, not real state (≥6 apps)
**Affected:** last-survivor (TOTAL KEYS + YOUR SHARE from buy-selector), gasbox (`userPulls` hardcoded `createObservable(0)`, never incremented; `totalPulls` under-reports after withdrawals), memorial-shrine ("My Tributes" aliased to `visitedMemorials.slice(0,2)`, never reflects paid tributes), gov-merc (Total Pool from a per-user storage key, not the shared aggregate; leaderboard mixes stale epochs), graveyard (memoryType never anchored on-chain despite "permanent record" framing), gas-sponsor (donate/send shown to ineligible low-balance target users), milestone-escrow (stat labels "Create"/"Escrows" instead of role-clear "Created"/"For you").
Headline metrics and stat tiles are wired to convenient local state rather than authoritative chain/aggregate sources, so they display static, self-referential, or per-user values where the domain demands real aggregates — directly undermining trust in apps whose value prop is on-chain truth.
**Systemic fix:** Audit every hero stat / counter binding against an authoritative source (contract read, event count, or OS-shared/global storage), remove no-op observables, scope leaderboards/pools by the correct epoch/aggregate, and ensure attributes the UI presents as "permanent/on-chain" (memoryType) are actually passed into the contract call rather than stored as local display metadata.