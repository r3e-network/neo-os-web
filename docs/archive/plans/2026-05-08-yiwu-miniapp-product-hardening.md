# Yiwu Miniapp Product Hardening Plan

Date: 2026-05-08

## Product Bar

Yiwu is the product brand; `miniapp` remains the technical model. Every miniapp must feel like a small, focused dapp: one core job, one obvious next action, real data, and no decorative complexity.

Global rules:

- The playarea shows the primary state and result of the miniapp, not a form dump.
- The action console owns the concrete operation flow. The primary action button must be visible in the first viewport on desktop and near the first screen on mobile.
- Secondary/operator/developer details move to folded sections or lower tabs.
- No fake numbers in production paths. If data is unavailable, show a real empty/loading/error state and name the upstream source.
- Testnet and mainnet data remain strictly separated in URLs, Supabase rows, chain reads, transaction builders, and status feeds.
- Money-moving contracts restrict funds by domain: loans can only pay borrowers and return collateral to borrowers; anchor transfers can only move between agents of the same anchor app except user withdrawals/claims; reward/vault flows can only pay the intended claimant.

## Shared Shell First

1. Simplify `MiniAppOperationPanel` to a compact NeoBurger-like card:
   - One active primary operation.
   - Secondary/operator operations folded under "More actions".
   - Tighter fields, smaller labels, plain solid primary button, no noisy glow.
   - Button remains high in the card.

2. Simplify `MiniAppPage`:
   - Remove atmospheric/marketing language from the product surface.
   - Stabilize tab heights so overview/reviews/forum/news never jiggle the page.
   - Mobile layout becomes playarea first, action console second, metadata below.
   - Comments/reviews/news/status stay below the core interaction unless the app's main job is social.

3. Add data-source discipline:
   - `source: "chain" | "supabase" | "oracle" | "local"` for visible non-form data.
   - Production mock guard fails when a production route renders mock data without an explicit demo flag.

## Miniapp Pass Order

### Fund and Account Apps

- OneGate Vault: claimant enters via QR with `poolId`/claim key; playarea shows reward claim status and result only. Action console contains one claim button. Creator/funding/withdrawal goes to a secondary admin view. Backend owns key validation, per-pool one-claim rule, random 1-50 GAS payout, tx monitoring, and luck percentile.
- Red Envelope: primary user flow is claim. Sending a red envelope and active envelope list are secondary/lower views. Playarea shows selected envelope, remaining packets, and claim result.
- SelfLoan: primary user flow is borrow/repay/close. Contract enforces payout only to borrower and collateral return only to borrower. Playarea shows loan health and debt; action console contains borrow/repay/add collateral/close.
- ProfitAnchor User: stake, redeem, claim. No agent internals in primary view.
- ProfitAnchor Admin: manual rebalance between the app's 21 AA agents, update agent candidate, harvest rewards. Must never expose arbitrary transfers.
- TrustAnchor User: stake, redeem, claim. Same primary model as ProfitAnchor, with TrustAnchor-specific copy.
- TrustAnchor Admin: manual allocation/candidate management only. Agent details folded.
- NeoPay: create stream/pay/claim are the only primary actions; stream hash details folded.
- FlashLoan/TimeCapsule/UnbreakableVault/GAS Sponsor: show one core state, one primary action, operational history below.

### Games

- Dice Game: add a real dapp if it is intended as a product. Primary flow is choose odds/stake, roll, show provable result. Use Morpheus VRF or platform randomness; no UI-only dice.
- FogPlay: primary flow is choose heads/tails + amount, submit, settle. Oracle/randomness status is folded unless pending.
- GASBox/Gacha: primary flow is open/claim. Odds, pool, and machine stats below.
- LastSurvivor: always show current active round. If a round ended, backend/keeper must create the next round automatically; UI should never dead-end on "round ended".
- On-chain Tarot: primary flow is draw/flip/read. Deck/artist metadata is below.
- Daily Check-in/Burn League/Council Governance: keep one primary action and one scoreboard/proposal view; move long history down.

### Factories and Tools

- NEP-17 Factory and NEP-11 Factory should be separate miniapps. Each deploys from pre-approved on-chain templates/registries and only customizes constructor/config parameters, never uploads arbitrary NEF/manifest from the browser.
- Asset Factory keeps only asset config, preview, deploy status, and post-deploy verify. Developer details folded.
- AA labs are developer tools; make them clearly "lab" apps and hide raw hashes until expanded.
- Oracle consoles show request composition, submit, status, and verification. Raw callback/debug payloads are folded.
- Explorer must read real chain APIs only; no fake block/search rows in production.
- NeoX Bridge shows asset bridge, message bridge, and operation tracking. Every status must come from AxLabs/BaneLabs APIs, chain events, or an explicit unavailable state.

## Contract Work

- PlatformDeFi: testnet update completed for borrower-only payout/collateral return guard. Mainnet uses a separate SelfLoan contract and needs its own source recovery or reimplementation before upgrade.
- PlatformAnchor: mainnet has been redeployed to the updateable contract `0x02beeef6f65c6989a121c0a0e6b23190333edb98`, with ProfitAnchor and TrustAnchor registered and 21 AA agents each. UI/runtime bindings now point at the updateable mainnet contract; miniapp NNS records still require a domain-owner signer because the local deploy signer is not authorized for `*.miniapp.neo`.
- AA: add a batch registration helper for deterministic anchor agents using `anchor + appId + agentId + nonce`, while preserving user-provided nonce to prevent pre-registration griefing.

## Verification Gates

- Unit/security tests for every fund boundary.
- Live testnet transaction smoke for every money-moving flow before mainnet.
- Read-only mainnet coverage for every listed app.
- OneGate NEP-21 open/scan/query-param flow for every miniapp.
- Browser screenshots for desktop and mobile core route of every miniapp.
- Production mock guard, bundle check, and layout-jitter check in CI.
