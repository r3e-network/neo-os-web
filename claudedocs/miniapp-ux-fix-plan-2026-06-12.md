# Miniapp UX/Workflow Fix Plan — 2026-06-12

Input: `claudedocs/miniapp-ux-review-2026-06-12.json` (67 reports: 60 apps + 6 OS sections + cross-app sweep; 407 findings; 107 broken/unreachable journeys, 41 partial).

## Execution phases

**Phase S — shared components first (parallel, disjoint files):**
- S1 `shared-utils`: parseHash160 display helper in apps/shared/utils/neo.ts (LE→BE 0x display) + adoption in AA-lab reads; NotificationService.mapChainError (known failure families → i18n keys, raw text to console.debug; add yes/no + transactionFailed keys to base-messages); useMorpheusDataFeed returns {price, recordTimestamp} (staleness); useAbstractAccount sanitizes server JSON errors; useI18n dev-mode missing-key console.warn.
- S2 `console-panel`: ConsoleToolPanel.tsx/scss — uppercase+tracking eyebrows, negative-tracking h2, accent custom property from manifest accentColor (kill hardcoded violet), delete ~200 lines dead scss, i18n the hardcoded validation/checklist strings, Reset honors launch params. INVESTIGATE dispatch-to-live-worker via the public edge lane (oracle.meshmini.app token-injecting proxy): if a tokenless public lane works, add an opt-in execute hook consoles can use; else ship explicit preview-only framing ("copy payload; runtime token required to dispatch") — no dead-end implications either way.
- S3 `factory-engine`: apps/shared/factory/* — MiniAppFactory IS deployed with deployFromTemplate/createMiniAppFromTemplate/getDeployment + registerTemplateArtifact. Wire a real execute step for artifact-backed templates; honest "artifact not registered" state otherwise; owner prefilled from connected wallet (kill the red Blocked first paint); sha256 digest (shims/noble) replacing FNV-1a where presented as signed; GAS fee estimate row; deployments/manage view reading factory state; signature bound into exported package. Report which templates lack on-chain artifacts (orchestrator may register them as a chain op).
- S4a `os-wallet`: zustand persist + reconnect-on-hydration (session restore), ConnectButton connected-chip menu (copy/explorer/account/disconnect), balance refresh after invokes + slow interval, account page (badge truth, BRAND title, i18n, copy feedback), unified social-provider list.
- S4b `os-detail`: embedded-iframe load timeout/retry + always-visible pop-out on coarse pointers, mobile action sheet scroll-lock + focus trap, AppDetailHeader keeps status chip at all widths, success feedback card (shortTxId + explorer link + confirm polling + playfield refresh), generalized cross-lane double-submit guard, confirm_message → ConfirmModal, bridge rejection host notice, GenericPlayArea filler rows into collapsible.

**Phase A — per-app clusters (after S; sweeps folded per cluster):**
Every cluster ALSO applies to its own apps: strip `t("k") || "English"` fallbacks (verify key exists, add if missing), add the 10 missing i18n keys where theirs, exit-path UI (withdraw/creditOf) where contract supports it but UI lacks it (breakup-contract, burn-league, fogplay, last-survivor, on-chain-tarot, time-capsule), success toasts on money-moving actions, shadow palettes → var(--ns-*), hardcoded English eyebrows → locale.

- A1 worst: quadratic-funding (7 broken journeys), gas-lucky-pool (4 broken + 4 high)
- A2 payments: flashloan (rewire to deployed MiniAppFlashLoan ABI: requestLoan/getLoan/getPlatformStats/getPoolBalance/getFlashLoanConstants + LP deposit/withdraw/earnings surface), gas-sponsor (honest service-unavailable state; chain-read balance gates donate/send; per-network pool), neo-swap (staleness guard, integer slippage floor, honest router state + disable CTA, NEO quantization, missing keys)
- A3 aa-labs: aa-account-lab (deriveRegistrationAccountIdHash + backup-owner prefill/guard + escape reads), aa-session-key-lab, aa-relay-console (live relay re-verify), aa-permissions-lab, aa-market-hub (market hash prefill from manifest)
- A4 factories: neo-ns, asset-factory, nft-factory, miniapp-factory (on S3 engine)
- A5 privacy: private-transfer (FULL i18n — 530-line PlayArea has zero t() — + live lane re-verify), recovery-guardian, neodid-passport, neo-message
- A6: breakup-contract, custom-anchor, forever-album, graveyard
- A7 attestation: neo-sign-anything, event-ticket-pass, soulbound-certificate, timestamp-proof
- A8 games-core: dice-game (live VRF journey), gasbox, fogplay (exit path + the locale that promises withdraw)
- A9 games-social: burn-league, last-survivor, on-chain-tarot, red-envelope
- A10: time-capsule (success toasts on reveal/fish + exit), memorial-shrine, unbreakable-vault, neo-x-bridge, automation-copilot (live re-verify)
- A11 finance/gov mediums: council-governance, gov-merc, dev-tipping, milestone-escrow, self-loan (borrow gating + pool read + Max chip + connect CTA + gauge relabel), neo-multisig (signer roster + membership gating + dynamic signer slots + request id + deposit confirm), neo-pay (status i18n, claim gating, 2-sig disclosure)
- A12 anchors: trustanchor, trustanchor-admin, profitanchor, profitanchor-admin
- A13 consoles: all 6 oracle-* app configs on S2 (yes/no keys, raw enum labels, em-dash digest, JSON validation, network labels, default URL targets live lane)
- A14 tools: explorer, neo-convert, neo-treasury, wallet-health, daily-checkin

Gates per cluster: per-app `npx vite build` + `tsc --noEmit` + app vitest + apps/shared scoped vitest (i18n parity test included). Final: full `npm test` + 61 builds + lint.

Premise rule: findings were only partially adversarially verified (37/100 highs) — every agent re-verifies each finding's premise in code before changing; wrong premise → skip with reason.
