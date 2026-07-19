I'll synthesize the round-2 findings into a polish plan. Let me first review the data structure to ensure I capture every finding accurately.

The findings JSON is fully provided in the prompt. Let me produce the synthesis directly.

# ROUND-2 POLISH PLAN — 60 Miniapps

## 1. Apps Needing the Most Work (by count/severity of NEW findings)

Ranked by severity-weighted finding count (high=3, medium=2, low=1):

| Rank | App | Findings (sev) | Weight | Top issue |
|------|-----|----------------|--------|-----------|
| 1 | **daily-checkin** | 1 high, 1 low | 4 | **HIGH** — Two unlabeled spinner buttons flank "Claim Rewards" on first paint (check-in + refresh bound to global `isLoading`); action card looks half-rendered. |
| 2 | **aa-market-hub** | 1 high, 2 med | 7 | **HIGH** — "Load Listings" primary button shows only a spinner with no label on mount (auto-load → `loading=true`); spins indefinitely against 404 in standalone, reads as broken. |
| 3 | **custom-anchor** | 1 med, 2 low | 4 | **MED** — Contradictory first paint: red invalid anchor input + disabled-green CTA + full-width green "Ready" strip simultaneously say error/go/ready; round-1 coherence unresolved. |
| 4 | **trustanchor** | 2 med, 1 low | 5 | **MED** — ROUTE STATE card has a large mid-card void (`margin-top:auto` on dl) + stat chips show real `0.00` where sibling profitanchor uses `—` placeholders (no loaded/placeholder distinction). |
| 5 | **neo-multisig** | 1 med, 2 low | 4 | **MED** — Disabled "Create Vault" primary is pale-green-on-pale-green at 0.85 opacity, fails contrast; + clutter from × buttons on 3 empty signer rows. |
| 6 | **self-loan** | 1 med, 2 low | 4 | **MED** — "ProfitAnchor Vote Route" disclosure card outranks the actual Borrow form in visual hierarchy (full-card weight for non-actionable copy) + emoji 🔒 + jargon badge. |
| 7 | **soulbound-certificate** | 1 med, 2 low | 4 | **MED** — Uneven column heights leave a large white gap in the left workspace column; redundant template chooser + ID input on empty state. |
| 8 | **recovery-guardian** | 1 med, 2 low | 4 | **MED** — Risk-note badge uses literal "SR" text glyph (looks like an unfinished avatar stub) + six look-alike preview/credential buttons. |
| 9 | **red-envelope** | 1 med, 2 low | 4 | **MED** — "Active envelopes" label appears twice with the same `0` value (metric tile + activity panel both resolve to same string). |
| 10 | **gas-sponsor** | 3 med (1 partial-regression) | 6 | **MED** — Fuel-tank gauge at 0% reads as an empty/broken white box (round-1 tick-opacity fix only partially landed); + enabled CTA pre-connection; + missing mobile shot. |

Other multi-finding apps: **last-survivor** (3 stacked "Refresh Round" prompts), **time-capsule / unbreakable-vault** (column imbalance + weak empty/stat tiles), **gov-merc** ("POOL STATS" mislabels the action form), **quadratic-funding** (off-brand purple hero + unbalanced columns), **aa-session-key-lab** (forced bottom-pinned void), **burn-league** (mobile impact-strip wrap).

---

## 2. Fix Clusters (batched for implementers)

### Cluster A — Disabled-CTA contrast (green-on-green / pale fills fail AA)
Single recurring pattern: disabled primary CTAs render as pale-accent-text on pale-accent-fill at ~0.85 opacity, failing ~4.5:1 and reading as broken/placeholder.
- **neo-multisig** — `.multisig-primary-actions .neo-btn--primary:disabled` (PlayArea.scss:566-572): drop `opacity:0.85`, darken text to full `--multisig-green-strong`, add 1px solid `--multisig-green` border.
- **red-envelope** — disabled "Claim now" (PlayArea.scss:370-377): swap accent-green-on-accent-soft → `--ns-text-muted` ink on soft fill.
- **dev-tipping** — disabled "Send Tip" (PlayArea.scss:704-710): muted ink label + add "Enter a registered developer ID and amount" helper.
- **aa-session-key-lab** — disabled "Configure Session Key" (PlayArea.tsx:460-463): bump text to `#0fb174` full-weight on soft fill.
- **soulbound-certificate** — disabled Issue/Lookup (PlayArea.tsx:370-378/485-492): neutral gray fill + gray label.
- **event-ticket-pass** — `.ticket-play-area .neo-btn--primary:disabled` missing → add soft-green disabled rule mirroring graveyard/timestamp-proof (PlayArea.scss:634).
- **profitanchor** — PREFLIGHT `dt` labels (PlayArea.scss:293-297): `--ns-text-muted #8a92a6` → `--ns-text-2 #5b6478`.
- **neo-message** — note-box text (PlayArea.scss:141-149): `--ns-text-faint #8a8fa0` → `--ns-text-muted #6b7180` on `#f6f7fb`.
- **explorer** — disabled Search button: filled `--ns-surface-subtle` + `--ns-text-2` label + 1px border (SearchPanel.scss).

**Expected gate:** every disabled/muted text element ≥4.5:1; `npm run build` 60/60; visual re-shoot confirms legible-but-inactive.

### Cluster B — Loading-state never erases the button label (HIGH priority)
Buttons bound to a global `isLoading` replace their text with a bare spinner on mount, reading as broken.
- **daily-checkin** (HIGH) — check-in + refresh NeoButtons bound to global `isLoading` (PlayArea.tsx:~190/213). Split into `isCheckingIn`/`isRefreshing`; while `!hasLoadedStatus` render disabled with text label, never `loading={isLoading}`.
- **aa-market-hub** (HIGH) — "Load Listings" `loading={isLoading}` auto-fires on mount (WalletConnectCard.tsx:63-71). Keep label visible (spinner as adornment) or don't auto-spin pre-market; show "Loading…" text minimum.

**Expected gate:** no button renders label-less during background hydration; build 60/60.

### Cluster C — Empty result/aside column dead-zone (the dominant layout defect)
Two-column shells with `align-items: start` leave a short empty aside while the form column runs tall. The 6 oracle consoles share one root cause.
- **SHARED — ConsoleToolPanel** (oracle-compute-lab, oracle-http-console, oracle-neodid-console, oracle-seal-console, oracle-vrf-console): `.console-tool__workspace` 2-col grid (scss:150-155) + `.console-tool__empty` capped at min-height:72px (scss:357-365). Fix once: `align-items: stretch` on workspace + `min-height` (~260px) and vertically center `.console-tool__empty`; add a muted lucide icon + one-line subtext in ConsoleToolPanel.tsx:369-373.
- **neo-sign-anything** — `.sign-shell` `align-items: start` (scss:33-39): expand safety rail (surface broadcast/route/GAS rows out of `<details>`) or drop to single column; add centered placeholder + line to empty Proof output.
- **on-chain-tarot** — `.tarot-shell` fixed 0.72fr/0.44fr (scss:24-32): move READINGS/CARDS-DRAWN metrics into aside, or `minmax(280px,0.36fr)`, or collapse to single column below 1200px.
- **aa-account-lab** — `.account-empty` `flex:1 1 auto` + `height:100%` (scss:140-146,246-261): cap `min-height:180px;max-height:240px`, drop the stretch, or `align-items:start` on workspace.
- **aa-session-key-lab** — remove `margin-top:auto` bottom-pinning (scss:286-288); `align-items:start` so left card sits at natural height.
- **trustanchor** — remove `margin-top:auto` on `.anchor-route-card dl` (scss:485) so status rows pack top.
- **aa-market-hub** (med) — collapse `.market-side-rail` to single column when no ManageListingCard (scss:165-170); move "Shell-Only Transfer" under Create Listing.
- **aa-permissions-lab** (low) — `permissions-grid` `align-items:start`: acceptable, low priority.
- **dev-tipping** — `.tipping-body` 1.4fr/1fr `align-items:start` (scss:193-198): span "How it works" full-width or balance ratio.
- **neodid-passport** (low) — reduce empty-result min-height 360→300px (scss:451).

**Expected gate:** no >150px blank band in an aside at first paint on 1280px; build 60/60.

### Cluster D — Tall blank canvas below short content (`min-height:100vh` / sparse pages)
- **breakup-contract** — drop `min-height:100vh` on `.breakup-play-area` (scss:62); add "How it works / what happens on break" explainer for empty state.
- **gasbox** — vertically center empty-state card or add a "how GasBox works" teaser strip (content ends ~y560 of 900).
- **memorial-shrine** — `.empty-memorials` (scss:471): add heart-glyph badge + `min-height:180px`; narrow `.memorial-play-area` max-width; mirror timestamp-proof empty-state template.
- **neo-convert** — fill ~55% blank lower viewport with a "What you can paste" chips card or on-device security note.
- **automation-copilot** (low) — keep Payload `<details>` open by default or tie collapsed bar to workspace card.

**Expected gate:** content fills ≥~70% of 900px desktop viewport; build 60/60.

### Cluster E — Unbalanced column heights (tall form vs short sibling, masonry drift)
- **quadratic-funding** — `qf-content-grid` 0.82fr/0.38fr (scss:217-219): single-column until first round, or move round list above form, or fill empty-ledger card.
- **gas-lucky-pool** — tighten right "Pool controls": Inspect/Add/Recover in a 2-up row under inputs; group Check/Withdraw inside RECOVERABLE GAS card (scss:563-567).
- **soulbound-certificate** — `.tipping`-style 2-col `align-items:start` (scss:204-208): move Verify/My Certificates to right column under Create Template (3-stack distribution).
- **time-capsule** — grid minmax(0,1.15fr)/minmax(320px,0.85fr): `align-self:stretch` + min-height on empty "Your Capsules", or `position:sticky` side panel.
- **unbreakable-vault** — `vault-grid` 1fr/1fr `align-items:start`: let Recent Vaults grow (min-height) or move to full-width row.
- **graveyard** (low) — taller min-height on empty Records card or add helper line.
- **aa-permissions-lab** (low) — min-height on Current-permissions empty-line.
- **forever-album** — `grid-template-columns: minmax(0,1fr) minmax(280px,0.62fr)` (scss:230): stack empty Album full-width above uploader, or min-height match.

**Expected gate:** sibling columns terminate within ~120px of each other at empty state; build 60/60.

### Cluster F — Redundant / mislabeled copy & duplicated strings (i18n)
- **red-envelope** (med) — rename `availablePools` string (not `availableEnvelopes`) to "Available to claim"/"Open envelopes" (PlayArea.tsx:201/371).
- **gov-merc** (med) — action panel eyebrow `t("poolStats")` → new `actionsTitle: "Your actions"` (PlayArea.tsx:115); + give settle button own `settleAction: "Settle epoch"` vs reused `flowInfluence` (PlayArea.tsx:184).
- **timestamp-proof** (med) — disabled-button hint reuses `t("enterContent")` twice; add `createDisabledHint: "Add some text above to enable timestamping"` (PlayArea.tsx:92).
- **flashloan** (low) — amber banner title reuses `t("notAvailable")`; add `statsStaleTitle`; use "—"/"Not connected" for wallet chip (PlayArea.tsx:235/241).
- **neo-swap** (low) — exchange rate shown 3×; drop hero RATE block (SwapHero.tsx:46-49) + trim execute note (PlayArea.tsx:222-224).
- **dice-game** (low) — in-stage "CURRENT STAKE" caption duplicates right-panel Stake tile; repurpose to selected-face + payout.
- **neo-convert** (low) — em-dash balance tiles + "Connect a wallet…" note state the same thing twice; drop tiles until connected.
- **self-loan** (low) — reword "VOTE-ONLY DEPENDENCY" badge → "Voting only — funds stay in custody".
- **neo-x-bridge** (low) — drop DIGEST column from top strip until prepare; de-dupe repeated "Neo N3 → Neo X".
- **milestone-escrow / dev-tipping** copy: see consistency.

**Expected gate:** no identical user-facing string appears 2× in one viewport; existing i18n keys preserved (add new keys, don't repurpose); build + full vitest green.

### Cluster G — Letter/emoji glyphs that read as broken icons (beauty)
Replace bare letter/emoji glyphs with inline SVG matching the Neo Soft icon set.
- **gasbox** (med) — hero "G" + empty-state "G" + `machineIcon()` letters (PlayArea.tsx:314/357/292-297) → gachapon/blind-box SVG.
- **recovery-guardian** (med) — "SR" text glyph (PlayArea.tsx:260-261) → shield/alert SVG.
- **self-loan** (low) — 🔒 emoji in connect CTA → inline lock SVG (currentColor, ~16px).
- **custom-anchor** (low) — orbit badge "— AA" → render "0" (muted) or AA-cluster icon before anchor linked (PlayArea.tsx:48/192-194).
- **fogplay** (med) — N/G coin glyphs unlabeled on hero coin; render "Heads"/"Tails" word or add "N = Heads / G = Tails" caption (WagerControls.tsx:44).

**Expected gate:** no standalone letter/emoji in a focal badge; build 60/60.

### Cluster H — Mobile-specific density/wrap defects
- **burn-league** (med) — impact strip wraps to littered 2×2 (scss:396-437). Add ≤480/560px breakpoint: `.burn-league-impact-strip` → `grid 1fr 1fr; gap:12px`, `.burn-league-impact-divider{display:none}`, item min-height for 2-line labels.
- **red-envelope** (low) — 3 metric tiles stack full-width (scss:690-695); keep a 3-up `repeat(3,1fr)` compact row on mobile.
- **aa-relay-console** (low) — "AA CORE" label wraps; add `white-space:nowrap` to `.relay-fact` label, let hash ellipsis (scss:89-99).
- **neo-ns** (low) — add margin between `.nns-hero__stats` and `.search-row` in ≤640px block so "Search Domain" heads the input.
- **gas-sponsor** (low) — re-capture missing mobile shot; verify `.gas-hero-gauge` mobile override (scss:540) stacks gauge+facts.

**Expected gate:** no overlap/wrap collision at 375px; build 60/60.

### Cluster I — Redundant/contradictory empty-state affordances (UX clutter)
- **last-survivor** (med) — 3 stacked "Refresh Round" prompts (PlayArea.tsx:125-143/210-232/90-94): when `serviceNotice` present, suppress round-control-card; Buy Keys helper references the single notice.
- **custom-anchor** (med) — first-paint says error+go+ready at once: gate green "Ready" strip on `looseAnchorValid`; only apply red border after non-empty input (PlayArea.tsx:83/213); add format hint.
- **trustanchor** (low) — 3 stacked muted empty rows; collapse to one "nothing yet" cue.
- **recovery-guardian** (low) — split 6 preview/credential buttons into 2 labeled subgroups (PlayArea.tsx:98-105/321-333).
- **aa-session-key-lab** (low) — group Check/Request sponsorship into 2-up row distinct from Generate Key.
- **gas-lucky-pool** (med) — 5 identical full-width green buttons: keep Inspect solid-primary, demote Add/Recover/Check/Withdraw to outline/soft-fill secondary (scss:263-291).
- **memorial-shrine** (low) — add inline "Create Memorial" button inside `.empty-memorials` (copy promises "above" but no in-place action).
- **soulbound-certificate** (low) — collapse to just Template-ID input in disconnected state; reveal selected-template strip only on pick.

**Expected gate:** at most one refresh/CTA entry point above the fold; build 60/60.

### Cluster J — Off-brand theme / sibling-divergence (consistency)
- **quadratic-funding** (med) — lavender hero + heart icon vs cluster green: swap stops in PlayArea.scss:54-56 to `#fff → --ns-brand-soft #e4f8f0`, recolor badge/kicker brand-green, replace heart SVG (FundingHero.tsx:34-36) with coins/sprout/target.
- **oracle-seal-console** (med) — amber `#facc15` accent reads as warning across hero badge + notice + empty pill: change `theme.accentColor` (appConfig.ts:29) to teal/indigo (e.g. `#22d3ee`).
- **trustanchor-admin ↔ profitanchor-admin** (low) — flat outline shield vs gradient finance CategoryIcon: pick one badge convention for the admin pair.
- **neo-message** (med) — hero lacks icon badge + eyebrow every sibling has: add 40-48px accent badge (lock/envelope, `#5b6ef5`) + uppercase eyebrow (PlayArea.tsx:130-133).
- **oracle-neodid-console** (low) — violet vs green/cyan family: flag for a suite-palette decision (intentional per-app identity may be fine).
- **neo-pay** (low) — flat-grey disabled "Create Stream" vs cluster's soft-tinted disabled: apply soft-brand-tinted disabled (matches neo-multisig).
- **milestone-escrow** (low) — pending notice icon uses brand green (success-colored a blocking state); give neutral/amber tint (scss:507-517), keep green for hero badge only.

**Expected gate:** oracle consoles + finance/privacy clusters share accent family; build + i18n green.

### Cluster K — Hero collapses to a strip / placeholder stat tiles (layout)
Heroes that gate summary metrics behind `count>0` collapse to a left strip with an empty right half. Pattern fix: render em-dash placeholder tiles so the hero holds height (mirror milestone-escrow).
- **neo-pay** (med) — hero strip with empty right half at zero streams (PlayArea.tsx:314): render `—`/zero placeholder summary tiles.
- **breakup-contract** (low) — narrow hero content max-width or add right-aligned value-prop chip ("Stake-backed · On-chain · Refundable").
- **dice-game** (low) — grow cube `min(220px,56%)` or reduce `.dice-stage__visual` min-height ~260px (scss:61-98) to fill the dashed frame.
- **fogplay** (low) — surface selected side + 2× payout chip inside the coin arena.
- **trustanchor** (med) — gate stat displays on `stats` loaded → `—` until then (mirror profitanchor `hasData`).
- **neo-ns** (low) — bump `.nns-stat__statusText` to ~15px and baseline-align to numeric tiles (scss:88-92).

**Expected gate:** hero holds height with placeholder content at zero-data; build 60/60.

### Cluster L — Misc / low-priority single items
- **milestone-escrow** (low) — 3 identical bold `—` stat tiles; add `.hero-stat-value--empty` lighter modifier (scss:116).
- **unbreakable-vault** (med) — stat tiles read as floating text; restyle `.vault-stat` with `--ns-surface-subtle` bg + accent number, constrain width (mirror daily-checkin `.checkin-stat-item`).
- **asset-factory / nft-factory** (low, shared) — first-paint 4× red "BLOCKED" chips contradict neutral DRAFT pill: in FactoryPlayArea.scss render step chips with neutral `.is-draft` palette when no plan generated; reserve red for post-generate blocked. One fix covers all 3 factories.
- **miniapp-factory** (low) — re-capture desktop screenshot (1/3-scale capture artifact, not a code defect); add oracle-toggle consequence sub-label.
- **private-transfer** (low) — add icon to sealed-intents empty state; inline "degraded" hint under network select.
- **oracle-price-console** (low) — copy affordance on truncated feed hash; tighten right-heavy hero metrics.
- **oracle-vrf-console** (low) — add "1-10" hint/clamp to Rounds field (appConfig.ts).
- **oracle-http-console** (low) — placeholder contrast (acceptable, optional).
- **neo-treasury** (low) — merge redundant review/status summary rows; balance hero copy vs metrics.
- **wallet-health** (low) — disconnected score ring `0` → muted `—`/"Connect to score" caption; align auto pill height to Mark-done buttons.
- **gas-sponsor** (low) — gate Request CTA on connected address.
- **dice-game** (low) — see Cluster F (caption de-dup).

**Expected gate:** per-item; build 60/60, full vitest green.

---

## 3. Cross-Cutting Visual Patterns (fix once in `apps/shared` where possible)

1. **Disabled-primary contrast token (HIGHEST leverage).** ~9 apps independently roll a green-on-green/pale disabled style that fails AA. There is no shared disabled-CTA convention — graveyard/timestamp-proof/event-ticket each hand-patch it. **Define a single shared `.neo-btn--primary:disabled` treatment** (soft fill + full-weight strong-accent or neutral-ink label, no 0.85 opacity, optional 1px border) in the shared NeoButton stylesheet so per-app overrides stop diverging. Apps with stronger per-app accent selectors (event-ticket `.ticket-play-area .neo-btn--primary`) override the shared `:disabled` reset via specificity — the shared rule should win or be re-asserted per cluster.

2. **Two-column shell `align-items: start` dead-zone.** The single most common layout finding across the whole fleet (oracle ×5 shared + sign-anything, tarot, account-lab, session-key-lab, trustanchor, market-hub, permissions-lab, dev-tipping, quadratic-funding, soulbound, time-capsule, unbreakable-vault, forever-album, graveyard). The **ConsoleToolPanel fix is one change for 5 apps**; codify a shared "balanced two-column" pattern (stretch + min-height empty card, OR single-column-until-content) the per-app shells can adopt.

3. **Gated-hero collapse → em-dash placeholder tiles.** Heroes hiding summary metrics behind `count>0` collapse to a strip (neo-pay, breakup, dice, fogplay, trustanchor). milestone-escrow already does the right thing (`—` tiles). Promote that to the shared hero pattern: always render placeholder stat tiles so heroes never collapse to a left strip.

4. **Bare letter/emoji glyph as focal icon.** gasbox "G", recovery-guardian "SR", custom-anchor "— AA", self-loan 🔒, fogplay N/G. A shared icon set exists (CategoryIcon, sibling inline SVGs) — none of these should use raw letters/emoji in a focal badge. Worth a lint/convention note.

5. **Em-dash vs real-zero placeholder inconsistency.** Sibling pairs disagree: trustanchor shows `0.00` where profitanchor shows `—`; explorer collapses real `0` block-height to `—`. Standardize: `—` = data-not-loaded, real `0` = loaded-and-genuinely-zero. A shared `formatStat(value, loaded)` helper removes the per-app drift.

6. **Muted-text contrast floor.** profitanchor preflight `dt`, neo-message note, private-transfer hints all use `--ns-text-faint #8a8fa0`/similar on light fills at ~3.2-3.3:1. Audit the `--ns-text-faint`/`--ns-text-muted` tokens against the common subtle-surface fills; raise the faint token or stop using it for ≤12px body text.

7. **Factory red "BLOCKED" wall.** Shared FactoryPlayArea shows 4 red chips on a fresh draft, contradicting the neutral DRAFT pill — one SCSS change in `shared/factory/FactoryPlayArea.scss` fixes asset/nft/miniapp-factory together.

8. **Eyebrow/key hygiene.** Several apps borrow semantically-wrong i18n keys for hero eyebrows (`permissionsMetricsLabel`, `notAvailable` as banner titles, `poolStats` for an action card, `flowInfluence` reused 3×). Convention: dedicated hero/section/action keys, never repurpose a metrics/aria key for visible headings.

---

## 4. Round-1 Regressions Flagged

Round-1 work held on **57 of 60** apps ("round1_held: Yes"). Three partial holds — none are true regressions (no prior fix reverted); they are round-1 fixes that under-landed:

- **gas-sponsor — PARTIAL.** Round-1 added faint fuel-tick guides (`rgba(20,22,38,0.05)`) + 5px min-height fill so an empty tank "still reads as a gauge" — but at that tick opacity the gauge still renders as an empty white box. Fix incomplete, not regressed. (Cluster G/L: raise tick contrast to ~0.08-0.10, add visible outline/ghost-fill floor.)
- **custom-anchor — PARTIAL.** Good round-1 work survived (true placeholder anchor id, single filled-green primary, em-dash facts, gated credit card, hover/focus states). The messaging-coherence goal was NOT achieved: first paint still shows red input + disabled-green CTA + green "Ready" strip together. (Cluster I.)
- **daily-checkin — PARTIAL.** Content fixes held, but the round-1 disabled-CTA soft-tint is visually undermined because the buttons sit in spinner (loading) state, not disabled-tinted state, on first paint. The fix is correct but invisible behind the `isLoading` spinner. (Cluster B — this is the same HIGH root cause.)

**No app reported a true regression** (a working round-1 fix that round-2 broke). The recurring theme is that two HIGH findings (daily-checkin, aa-market-hub) stem from global `loading` state hiding button labels — these should be prioritized first as they make round-1 styling work invisible.