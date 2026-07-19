I'll synthesize the findings into a concrete fix plan. The full findings JSON is truncated at the end (daily-checkin's third gap is cut off), but I have complete data on the vast majority of apps. Let me produce the plan from the structured findings provided.

# BUSINESS-MODEL COHERENCE FIX PLAN — 60 Miniapps

All fixes are frontend-only (contracts frozen). Gates referenced throughout: **G** = `vite build` (60/60) + `tsc` + per-app `vitest` + i18n key parity (no orphaned/missing locale keys across all locale files).

---

## 1. COHERENCE SCORECARD (worst-first)

### MISLEADING (2) — product sells something it cannot do
| App | Core business-model gap |
|---|---|
| **neo-swap** | Sold as a working DEX; router never deployed → swap CTA permanently disabled, only previews quotes. |
| **private-transfer** | Sold as a confidential money transfer that "settles"; no contract, no token movement — only seals an encrypted intent and dead-ends at 3 hashes. |

### PARTIAL (10) — real product, but a primary role/mechanic/economic fact is missing or inert
| App | Core business-model gap |
|---|---|
| **gas-lucky-pool** | Catalog describes only the recipient; default open lands on an undescribed creator workspace + two unexplained reward engines (on-chain pool vs server-paid keys). |
| **self-loan** | UI claims locked collateral "votes" via ProfitAnchor (no voting on-chain) + docs assert a 24h lock the contract never enforces. |
| **quadratic-funding** | Donor never sees the quadratic-amplification value prop at the moment of contributing; suggested-match shown as authoritative (it's an approximation). |
| **gov-merc** | Hero/README promise "vote rental / governance delegation"; contract routes no vote, only pays stakers + records a title. Staker yield hidden pre-deposit. |
| **custom-anchor** | Manifest promises "create 21 AA agents"; app never provisions them → self-registered anchor born inert; stake not gated on agentCount>0. |
| **trustanchor** | Yield source/no-guarantee never explained; indistinguishable from ProfitAnchor. |
| **profitanchor** | "Profit/gas-yield" positioning but yield mechanism/variability hidden; indistinguishable from TrustAnchor; SelfLoan composability (its differentiator) invisible. |
| **asset-factory** | Headline "Create NEP-17 assets" unachievable on default network (artifact not preloaded → deploy permanently blocked). |
| **nft-factory** | Same as asset-factory: "Create NEP-11 collections" unfulfillable on default network. |
| **daily-checkin** | Advertised GAS rewards unfunded on live contract (pool ~66× short, totalRewarded=0); pause state has no UI. |

### MOSTLY-FAITHFUL (~26) — coherent, but a notable disclosure/copy gap
dice-game, fogplay, gasbox, dev-tipping, milestone-escrow, flashloan, neo-treasury, gas-sponsor, aa-account-lab, aa-permissions-lab, aa-relay-console (partial), aa-session-key-lab, aa-market-hub (partial), miniapp-factory, neo-message, neodid-passport, recovery-guardian, event-ticket-pass, timestamp-proof, time-capsule, unbreakable-vault, graveyard, memorial-shrine, forever-album. (Each carries a one-to-three-line economic/lifecycle/trust disclosure gap detailed below.)

### FAITHFUL (~14) — de-prioritize (see §4)
on-chain-tarot, last-survivor, burn-league, red-envelope, breakup-contract, council-governance, neo-pay, neo-ns, soulbound-certificate, neo-sign-anything, neo-convert, neo-message (modulo timed-reveal warning), neodid-passport, profitanchor-admin/trustanchor-admin (admin-only, minor).

---

## 2. FIX CLUSTERS (batch these together)

### Cluster A — Catalog/manifest copy drift (description + tags + technologies flags)
Pure `neo-manifest.json` edits; no TS change. Highest ROI, lowest risk. Batch all together.
- **fogplay**: rewrite description to "Instant on-chain coin flip — Neo N3 native randomness settles each flip and pays 2x in the same transaction"; set `technologies.oracle.enabled=false`.
- **dice-game**: add `5.70x`, odds `1/6`, `5% house edge` to description.
- **gasbox**: change description to "win NEO or GAS … provably-fair weighted draws"; drop the `nft` tag.
- **recovery-guardian**: reword manifest description + `README.md` line 3 from "final recovery execution" → "Read-first recovery console … execution happens in the AA workspace."
- **gas-lucky-pool**: expand description to name both roles (recipient-claims-via-QR + campaign-owner-creates/funds/recovers).
- **Gate:** G (i18n unaffected; manifest is not a locale surface, but run build to confirm manifest parse).

### Cluster B — "Misleading" reframes (neo-swap, private-transfer)
The two apps whose headline contradicts the deliverable. Each needs hero/CTA/lifecycle copy + a demoted/relabeled primary action.
- **neo-swap** (`src/locale/messages.ts`, `SwapHero`, `PlayArea.tsx`, `useSwapEngine`):
  - `title`/`subtitle` → "Neo Swap — live NEO/GAS rate & trade preview"; `step3/step4` → review-quote-then-settle-elsewhere; `feature3Desc` → "Live data-feed quotes (settlement pending a deployed router)".
  - When `routerAvailable===false`: demote primary CTA to "Refresh quote"/"Copy quote"; render disabled Swap as "Settlement unavailable" state (reuse existing `routerAvailable` signal).
  - Name the price source in the detail panel ("Rate via Morpheus data feed, as of {time}").
- **private-transfer** (`appConfig.ts`, `PlayArea.tsx`):
  - Hero/CTA/status copy: transfer-that-settles → "Seal a private transfer intent for Morpheus confidential compute"; always-visible "No funds were moved — this seals an encrypted intent" banner above the seal button.
  - Demote lifecycle steps 1 (Deposit) and 4 (Release/refund) to "not available in this app / handled by your wallet & settlement service" OR add a real "Check settlement status" action against `secretRef` if an endpoint exists.
  - Add one-line purpose captions under `secretRef`/`commitment`/`nullifier`.
- **Gate:** G + i18n parity (both touch locale heavily; verify no key added in one locale only).

### Cluster C — Factory "artifact-not-registered" honesty (asset-factory, nft-factory, miniapp-factory)
Shared `factoryPlan.ts`/`factoryChain.ts` engine; per-app locale overrides. Batch — same remedy.
- **asset-factory & nft-factory** (`FactoryPlayArea.tsx`, per-app `messages.ts`):
  - Hero banner driven off live `artifactPresence` state: when `presence!=='present'`, show "On {network}, deployable artifacts are preloaded by a factory admin; this template is metadata-only here. Switch networks or export a signed plan."
  - Per-network availability hint next to the network `<select>`.
  - Surface the network-fee cost model even when blocked (drop `execution.available` precondition for the read-only `estimateFactoryFeeGas`, OR add static "Deploying costs only the Neo network fee; no app fee" line in the existing `deployHonesty` note).
  - Clarify `signPlanDescription`: signature is a portable issuer commitment for handoff/audit.
  - nft-factory only: extend `royaltyHelper` (marketplace-honored cut to owner on secondary sales, fixed at deploy) + label soulbound toggle consequence.
- **miniapp-factory** (per-app `messages.ts`): override `publishPackage`/`deployChecklist`/`deployHonesty` to "Register a miniapp instance record" (registry entry + catalog patch, not a contract deploy); after `lastTxid`, render explicit "Next: sync the catalog patch to the platform registry" step (patch already in `currentPlan.payload`).
- **Gate:** G + i18n parity (per-app override keys must exist in all locales).

### Cluster D — Anchor family: yield mechanism + Trust-vs-Profit differentiation + agent-provisioning honesty
trustanchor, profitanchor, custom-anchor (+ admin twins). Highest-severity economic gaps live here. Batch the shared "how yield works" treatment.
- **trustanchor** (`src/locale/messages.ts`, `PlayArea.tsx`): add "How you earn" block (NEO voted by 21 agents → GAS → reserve → pro-rata, variable, only when funded); promote Reward Reserve to a hero stat; label GAS/NEO as "cumulative since launch"; differentiate hero copy as governance-aligned; add redeem-timing line.
- **profitanchor** (`messages.ts`, `PlayArea.tsx`): add same yield explainer + render `rewardReserve`/cumulative GAS-per-NEO (it currently renders neither); reframe hero as profit-policy/distinct-pool; surface the existing-but-unrendered SelfLoan-composability copy near route state; reclassify the preflight "AA route" row as informational (not a blocking gate).
- **custom-anchor** (`neo-manifest.json`, `main.tsx`, `PlayArea.tsx`): reframe manifest/hero (drop "create 21 AA agents" claim — app doesn't provision); after register, prominent "0/21 agents — staking earns nothing until operator provisions" callout (agentCount already in state); **gate stake** when `anchorLinked && !anchorNotRegistered && agentCount===0` (inline warning + explicit confirm); add reward-model explainer (read `getRewardPerNeo`); add one-line Trust-vs-Profit mode descriptions under the toggle + in discovery tags.
- **Gate:** G + per-app vitest (custom-anchor's stake-gating is logic, not just copy → add/adjust a test asserting stake disabled at agentCount 0).

### Cluster E — gov-merc "vote rental" reframe + staker yield surfacing
Single app, multiple linked gaps (`neo-manifest.json`, `README.md`, `messages.ts`, `MercHeroStats`, `MercActionCards`):
- Reframe `description`/README/`flowInfluence`/`settleCopy` to actual mechanism: "Stake NEO to earn the GAS auction yield; bid GAS to win the epoch's influence title"; add "How influence is used" note (winner recorded on-chain, vote execution off-contract).
- Surface staker value-prop at deposit (`depositNeo`): "NEO stakers split every epoch's winning GAS bid pro-rata" + hero stat for last/cumulative GAS distributed.
- Read `minBid()` → show as helper/placeholder before a bid fails.
- Add "Current top bid" (`highestBid(currentEpoch)`, already read for leaderboard) to hero/settle panel.
- Relabel deposit/withdraw "voting power" → "stake weight / reward share".
- **Gate:** G + i18n parity.

### Cluster F — self-loan misrepresentation removal
Highest individual-app severity (a "high" trust misrepresentation):
- Remove/rewrite ProfitAnchor voting claims: drop the vote-route footnote (`PlayArea.tsx:512-519`), `profitAnchorStatus`/`profitAnchorValue` sidebar stat + docs feature (`manifest.ts:44,60`), and the manifest description line → "Collateral is held in SelfLoan custody and returned on repayment (no third-party voting)."
- Fix `messages.ts`: "Repay anytime to unlock — no minimum lock, no interest"; drop the 24h `minDuration` phrasing.
- Add Rate/fee note: "Rate is operator-set (not a live oracle); the 0.5% origination fee is retained by the lending pool."
- **Gate:** G + i18n parity (removing keys → ensure no remaining references).

### Cluster G — gas-lucky-pool dual-role + dual-engine legibility
- Role-orienting header on the creator workspace ("Campaign owner? Fund a random-GAS reward pool here, then share OneGate QR claim links").
- Label the two distribution paths explicitly: "On-chain pool (recipients call `claimRangeGasPool`)" vs "OneGate claim keys (paid by the reward server)"; clarify in docs that QR keys redeem off-chain via the backend payout wallet.
- Add "View on explorer" for `lastTxid` in the recipient success card.
- **Gate:** G + i18n parity.

### Cluster H — "Credit is not withdrawable" disclosure (dice-game, gasbox)
Prepaid-credit apps lacking a withdraw path, where copy implies recoverability. Batch the honest-credit-label pattern.
- **dice-game** (`locale/messages.ts`): rewrite `directCreditBanner`/`statusFundsRecoverable` → credit is re-spend-only, NOT withdrawable; surface the VRF-oracle-dependency trust line + a "Settlement pending / Check again" state replacing the indefinite spinner (re-runs `resolveN3Bet`).
- **gasbox** (`gasboxPlayCreditHint`): append "spendable on a future pull only; cannot be withdrawn to the wallet."
- **Gate:** G + i18n parity. (dice-game's "Check again" is a small logic add → light vitest.)

### Cluster I — Custodial accrue-then-claim mental-model fix (dev-tipping)
A "high"-severity wrong-mental-model:
- `messages.ts`: `feature1Desc`/`step4`/`docDescription` "directly to wallet" → "100% of your tip (no platform fee) accrues to the developer's on-chain balance, which they withdraw."
- `DeveloperPanel.tsx`: hint that tips accrue here and require Withdraw; extend `registerHint`.
- `PlayArea.tsx:201`: replace unsourced `tip.to` with resolved "→ Dev #{devId}" via `getDeveloper(devId)`; drop if unresolvable. Remove the `to` field expectation in `useDevTippingStats.ts`.
- **Gate:** G + i18n parity + vitest (stats shape change).

### Cluster J — Explorer-link + on-chain-verification surfacing (event-ticket-pass, timestamp-proof, neo-sign-anything)
Apps whose whole value is "verifiable on-chain" but txid/tokenId render as dead text. Batch one explorer-URL helper (build from active network, pattern from `evm-chain.ts`).
- **event-ticket-pass**: link issue/check-in txid + ticket tokenId to explorer; also reframe "sales/sold-out" copy → invite/allowlist + "Free passes — no payment taken on-chain" note.
- **timestamp-proof** (**high**): make anchor txid a click-through explorer link; add "How to verify" note (anyone reads `timestamp-proof:<digest>` in tx data; block time = proof time); optionally add txid-based on-chain lookup to Verify so third parties (not just this device) can confirm; add anchor cost note.
- **neo-sign-anything**: link broadcast tx hash to explorer; add a verify panel or one copyable address+message+signature+pubkey bundle.
- **Gate:** G + i18n parity (event-ticket-pass copy rename must update all locales).

### Cluster K — Game economics surfacing (odds/edge/risk at point of commitment)
Pure copy/chips. Batch.
- **fogplay**: odds chip "50% chance · pays 2x" next to payout preview.
- **last-survivor**: relabel "Share %" as participation-only; add non-refundable-contribution risk note near Buy Keys.
- **red-envelope**: annotate create-preview "Average packet" as a random draw (reuse `createReadyDesc`); delete dead NFT/dual-type/NEO-gate locale block.
- **breakup-contract**: keep the matched-stake/forfeit economics line near Create regardless of `hasContracts` (stop gating the How-it-works card).
- **burn-league**: bind min/max inputs + `burnRange` copy to on-chain `minBurn()`/`maxBurn()` reads (fallback to literals).
- **Gate:** G + i18n parity (red-envelope key deletion → confirm no references).

### Cluster L — AA family security/lifecycle disclosures
aa-account-lab, aa-permissions-lab, aa-session-key-lab, aa-relay-console, aa-market-hub. Shared theme: the security primitive (timelock/verifier/session-key/escrow) is under-explained at the decision point. Batch by app, mostly locale.
- **aa-account-lab**: explain escape-timelock (social-recovery window tradeoff) + escape-status meaning; reframe verifier/verifier-params as the auth authority; always-visible "real permanent mainnet account" note.
- **aa-permissions-lab**: relabel "Update Verifier/Hook" → "Propose…" (two-phase hint); explain why the timelock exists in the pending banner; fix wrong `feature3` "Direct Wallet / writes go straight" copy.
- **aa-session-key-lab** (**high** on key warning): security caution at one-time private-key export; read+show `getSpentAmount` vs limit; decode `getSessionKey` into labeled fields (target/method/expiry/spent) instead of raw JSON; warn that blank Allowed Method = ANY method.
- **aa-relay-console** (**high** value-prop): plain-language "a paymaster pays your GAS" hero line; pre-commit direction-of-value note on Request Sponsorship + daily-limit meaning; explain relay-vs-direct + render returned txid.
- **aa-market-hub** (**high** shell-only): surface shell-only caveat inline at the Buy panel (not collapsed details); escrow explainer at the Buy CTA; no-platform-fee + net-proceeds statement in Create; seller-side note that a sale completes only when a buyer settles (acknowledge `getPendingPaymentOf` is payer-keyed).
- **Gate:** G + i18n parity (session-key/market changes include read-only ABI additions → light vitest where decode logic is added).

### Cluster M — Memory/ritual apps: economic-truth disclosures (time-capsule, unbreakable-vault, graveyard, memorial-shrine, forever-album)
Mostly copy; one logic affordance.
- **time-capsule**: reframe "fishing" as a tip (fisher gets only acknowledgement, not content); add a browsable `loadPublicCandidates()` list so the fisher picks a target (currently blind auto-pick of newest).
- **unbreakable-vault** (**high** hidden 2% fee): show "You win: {bounty×0.98} (after 2% fee)" row (constant from `getVaultConstants`); annotate bounty-growth ("each failed attempt adds its fee"); relabel difficulty fee as challenger-paid, not creator-paid.
- **graveyard**: state fees are sunk/non-refundable (rename "Burial Fees (est.)" → "GAS spent on burials"); frame the 10× forget fee as an intentional ritual.
- **memorial-shrine** (trust): replace inaccurate "Non-Profit — fees only cover blockchain costs" with honest "symbolic offerings, not paid to family, non-refundable, consumed as a record"; disclose non-refundable destination in tribute panel.
- **forever-album**: durability disclaimer chip overriding the "Forever" name ("Saved only on this device — clearing your browser deletes them"); reword dead on-chain/transaction strings to device terms.
- **Gate:** G + i18n parity (time-capsule candidate-list is read-only over existing reads → light vitest if list logic added).

### Cluster N — Lower-priority "mostly-faithful" copy nudges (batch last)
milestone-escrow (two-sig disclosure + free/no-fee value prop + beneficiary-approval note), neo-pay (per-day release on created-stream cards), neo-multisig (pooled-balance / no-earmark note), flashloan (80% LP share + `distributeFees` note + power-user/LP banner via existing `instructionMode`), neo-treasury (from-your-wallet labeling + "Use as recipient" on watched rows), gas-sponsor (donation→pool loop copy + pool address + Send-is-direct clarifier + API-down hero adaptation), council-governance (relabel "Voting Power" → "Council Seat"; quorum fallback to 21), neo-ns (Expired badge + re-register hint), soulbound-certificate (surface soulbound badge in Verify card), neodid-passport (off-chain/non-broadcast hero note), neo-convert (scope the on-device claim; note the balance read hits RPC), neo-message (public-reveal warning + acknowledge on the timed toggle; device-local-cache note after recipient reveal), the two anchor-admins (per-agent balances via `getAgent`, AA-witness pre-submit framing, routing→yield causality line).
- **Gate:** G + i18n parity per app.

---

## 3. CROSS-CUTTING PATTERNS (shared treatments worth standardizing)

1. **Economic terms not surfaced pre-commit** (most common — dice-game, fogplay, gasbox, self-loan, gov-merc, flashloan, unbreakable-vault, graveyard, milestone-escrow, quadratic-funding, anchors): fee %, odds/EV, who-pays-whom, payout-net-of-fee, and yield source must appear **at the action/CTA**, not only in docs/hero. **Shared treatment:** a reusable "economics chip/row" component rendered adjacent to every primary money CTA, fed by values already read from the contract (fee bps, odds, net payout, reward-per-unit).

2. **Non-withdrawable / sunk / non-refundable money framed ambiguously** (dice-game & gasbox "credit", graveyard & memorial-shrine sunk fees, last-survivor & breakup forfeit). **Shared treatment:** a standard "credit/fee disposition" label vocabulary — explicitly one of {refundable-deposit, withdrawable-credit, re-spend-only credit, sunk fee, forfeit-to-other-party} — applied wherever money leaves the wallet.

3. **Missing/illegible lifecycle states** (dice-game stuck "Rolling", private-transfer dead-end hashes, custom-anchor 0-agent inert, neo-ns expired domains, daily-checkin pause, factories blocked-deploy, anchor-admin blind moves): every app should render a definite state (and a next action) for the "stalled/blocked/empty" branch instead of an indefinite spinner or silent disable. **Shared treatment:** a "blocked/pending state" pattern (status line + actionable button: Check again / Switch network / Provision required / Re-register).

4. **On-chain verifiability promised but unreachable** (timestamp-proof, event-ticket-pass, neo-sign-anything, dev-tipping "→ to", gas-lucky-pool): txid/tokenId/recipient shown as dead text. **Shared treatment:** one explorer-URL helper (network-aware, already exists in `evm-chain.ts`) + render every captured txid/tokenId as a click-through link.

5. **Value-prop / mechanism not in the hero** (neo-swap, private-transfer, aa-relay-console, quadratic-funding, gov-merc, anchors, trustanchor-vs-profitanchor twins): the *why-use-this* and *what-actually-happens* are buried in collapsed details or doc keys. **Shared treatment:** hero must state the real mechanism in one plain-language line; twin/duplicate apps must differentiate their hero copy.

6. **Manifest/README copy drift from corrected in-app copy** (fogplay, dice-game, gasbox, gov-merc, recovery-guardian, self-loan, custom-anchor, factories): store-listing description still describes a prior/aspirational model. **Shared treatment:** a manifest-vs-in-app consistency check (could be a lint/test) asserting description claims match the rendered locale/feature set.

---

## 4. DE-PRIORITIZE

**Already faithful — no fix (≈14):** on-chain-tarot (no gaps), last-survivor/burn-league/red-envelope/breakup-contract (only low cosmetic copy), council-governance, neo-pay, neo-ns, soulbound-certificate, neo-sign-anything, neo-convert, neodid-passport (single low hero note). Their listed gaps are all "low" cosmetic and can ship in Cluster K/N opportunistically or be skipped.

**Out of scope — would require a contract change (do NOT attempt):**
- **dice-game** — adding an actual N3 game-credit `withdraw()` (kernel frozen; only the copy honesty fix is in scope).
- **private-transfer / neo-swap** — building real settlement (no contract deployed; only honest reframing is in scope).
- **daily-checkin** — funding the reward pool / fixing solvency is an on-chain/operator action; in scope is only surfacing pool balance + "rewards unfunded" banner + disabling Claim when insufficient (reads only).
- **custom-anchor / anchors** — provisioning the 21 agents (`registerAgents`) is an operator/admin on-chain action; in scope is only the honesty callout + stake-gating.
- **aa-market-hub** — enumerating buyer pending-payments seller-side is impossible (`getPendingPaymentOf` is payer-keyed); do not imply sellers can see/refund buyer payments — only clarifying copy is in scope.
- **gas-lucky-pool / gas-sponsor / flashloan** — backend/paymaster/relay behavior is out of frontend scope; only labeling/explainer copy applies.

**Note on completeness:** the findings JSON was truncated mid-`daily-checkin` (third gap cut off). daily-checkin is covered above for its two complete gaps (unfunded-pool disclosure = high; pause-state UI = medium); the third (cut-off) gap should be reviewed against source before implementing its cluster slot. All other 59 apps had complete findings.