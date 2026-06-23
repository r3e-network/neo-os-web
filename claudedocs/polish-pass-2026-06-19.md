# Miniapp frontend polish pass — 2026-06-19

Goal: polish all miniapp frontends for beauty + user-friendliness. Driven by a
full 60-app screenshot review (desktop + mobile), 4 parallel design-reviewer
agents. Screenshots: `/tmp/polish-now/<slug>__now__{desktop,mobile}.png`
(regenerate via `node scripts/capture-miniapp-runtime.mjs ${=ALL} --out <dir> --tag now`;
NOTE zsh needs `${=VAR}` to word-split a slug list).

## Fleet verdict
Most apps score 8–9 (the prior category campaign + a11y rounds left it strong).
The weak tail and cross-cutting patterns are the targets.

## DONE this session
- `19a9a8e5e` Batch 1 (cascades ~12 apps): ConsoleToolPanel waiting-label pill→plain
  caption (5 consoles); FactoryPlayArea draft checklist "Blocked"→"Pending" (3
  factories); neo-sign-anything value mid-word wrap fixed; gas-lucky-pool sample
  card → dashed mockup border + amber SAMPLE tag; explorer "Search Result"→"Last
  lookup"/"None yet".
- `2b7eabc45` profitanchor: empty stat tiles get an "awaiting connect" caption.

## CROSS-CUTTING patterns (highest leverage remaining)
1. **Em-dash "—" / disabled-pale-primary on first run reads as broken** — across
   neo-pay, neo-pay-shared-example, neo-treasury, custom-anchor, daily-checkin
   (sea of 0s), aa-account-lab. Fix per app: show "0" or an "awaiting connect"
   caption; reserve pale-mint fill strictly for disabled (enabled primary =
   full #0a8050 green). profitanchor done as the template.
2. **Multiple equal-weight filled CTAs** — aa-market-hub (5× Connect Wallet),
   aa-session-key-lab, asset-factory: keep one filled primary per region, demote
   rest to outline.
3. **Oracle console dead desktop whitespace** below the cards (shared
   ConsoleToolPanel + the separate oracle-price-console) — page bottoms out
   ~halfway. Cap content width / vertically center. (Deferred — page-layout, riskier.)
4. **Off-brand robot mascot empty states** (aa-permissions-lab, aa-session-key-lab,
   dev-tipping) vs clean line-icon ones (council-governance, event-ticket-pass) —
   pick one style fleet-wide.

## WEAKEST apps + specific items (from agent review)
- **asset-factory (5/5)**: tiny uniform type scale (no hierarchy); orphaned DRAFT
  hex chip top-right; deploy actions 3 equal filled — make "Deploy via factory"
  the only filled primary. (BLOCKED→PENDING already done.)
- **aa-account-lab (6/6)**: Register CTA pale/buried under warning wall; group
  required vs optional fields (collapsible); bold the mainnet-spend warning clause.
- **custom-anchor (6/6)**: low-contrast wall — wrap wallet-actions in a card
  surface; add labels above the 0/— stat figures; single filled primary.
- **on-chain-tarot (6/7)**: dark card backs clash with light theme — frame them
  in a light tray or lighten the backs.
- **gov-merc (7/6)**: dense jargon — add a plain one-line subtitle; promote
  Stake (earn) vs Place Bid (spend) visually; remove duplicated stat tiles
  (hero vs right rail); color-code NEO vs GAS chips consistently.
- **neo-pay / neo-pay-shared-example (7-8)**: em-dash hero stats → "0"/one line;
  enabled "Create Stream" must be full green not pale; shared-example footer →
  iconned empty-state card like neo-pay.
- **neo-treasury (7/7)**: soften orange "Price feed unavailable" → neutral "USD
  paused — native only"; group Source/Network/Status vs editable fields.
- **miniapp-factory / nft-factory (7-8)**: number the checklist; contain the raw
  OneGate URL in a single-line truncated field + "Copy link" button.
- **soulbound-certificate (7/7)**: dense 3-col; let the cert preview be the
  anchor; one Connect CTA (dedupe header vs card).
- **private-transfer (7/7)**: consolidate the 3 amber warning blocks to one;
  pair "Degraded" chip with a plain-language note.
- **recovery-guardian (7/8)**: empty field grid → single centered empty state
  ("Run Query State to load your guardians"); highlight one primary entry action.
- **trustanchor-admin (7/7)**: cap the 21-row agent directory to a scrollable
  fixed-height panel, truncate hashes, mute "Candidate: no candidate".
- **quadratic-funding (8)**: soften the raw "YYYY-MM-DD HH:mm" placeholder.
- **neo-message (8)**: indigo accent diverges from the green fleet (confirm
  intentional Neo X sub-brand vs retint).

## Models (no change needed): milestone-escrow, fogplay, neo-convert, neo-ns,
neo-x-bridge, self-loan, timestamp-proof, wallet-health, red-envelope.
