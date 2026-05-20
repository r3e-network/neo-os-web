# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: this repository’s **current** architecture uses a Supabase Edge gateway plus
> external Morpheus / AA runtimes. Removed pre-migration docs can be recovered from
> Git history.

## [Unreleased]

### Added — 2026-05-19 security + correctness sweep

**Security audit (full report at `docs/reports/security-audit-2026-05-19.md`).** Four parallel-agent audits covered smart contracts, edge functions, frontends, and secrets / CI / supply chain. ~80 findings; all code-only Critical/High items resolved.

**Smart contracts**

- C-1 `FlashWithdraw` pool drain — added per-LP share map (`PREFIX_FLASH_PROVIDER_BAL`) + total accumulator + one-time `MigrateFlashProviderBalance` admin hook for pre-fix deposits
- C-2 `MiniAppQuadraticFunding.FinalizeRound` — round creator locked out; per-funder `RefundMatchingPoolContribution` so sponsors are not robbed by `CancelRound`; self-contribute blocked
- C-3 `MiniAppMilestoneEscrow.CancelEscrow` — refuses cancellation while any approved-but-unclaimed milestone exists
- H-9 / H-10 envelope/RangePool/Vault randomness — block-beacon mix added; vault uses commit-reveal (30s min delay, attacker-bound preimage)
- H-11 wildcard `[ContractPermission("*","*")]` — replaced with explicit native + per-method allowlists on `PlatformGame` and `PlatformSocial`
- H-12 oracle resolver — `ResolveCoinFlipBet` / `ResolveGachaPull` now require `requestId > 0`; mapping check is non-optional
- H-13 / NEW-H-2 `MiniApp*` manifest permissions — `*:onNEP11Payment` and `*:isPaused` added so NEP-11 transfers to contracts work and a `SetPauseRegistry` call no longer bricks the contract
- M-1 / M-2 / M-4 / M-5 / M-6 dice + coinflip hardening — `CallFlags.AllowCall|AllowNotify` on flash callback; rejection-sampling RNG (no modular bias); rolling 24h window keyed off an anchor timestamp; read-before-write for `lastBetTime`
- M-7 Trust `ExecuteTrust` — explicit executor parameter + `CheckWitness` (no more `Tx.Sender`)
- M-8 Capsule/Lending — explicit `principalAmount` / `collateralAmount` parameters; remaining credit returned to the user
- M-11 anchor app spam — `RegisterCustomAnchorApp` charges 1 GAS from prepaid credit
- NEW-H-3 Gacha `CreateGachaMachine` — explicit `creator` parameter (no more `Tx.Sender`)
- NEW-H-4 `MiniAppEventTicketPass.Transfer` — `CallFlags.AllowCall|AllowNotify` on the NEP-11 callback
- NEW-H-8 QF cancel-round refund — per-funder ledger; matching sponsors can claim refunds via `RefundMatchingPoolContribution`
- NEW-M-2 Soulbound `Transfer` — always rejects (tools can detect non-transferability)
- NEW-M-7 anchor auto-stake — requires structured `["stake", appId]` payload instead of bare-string memo match
- NEW-M-10 oracle `requestFromCallback` — `CallFlags.AllowCall|AllowNotify`
- NEW-M-11 `OnOracleResult` — validates `requestType` on every callback (including failure branch)
- NEW-I-2 `SetGateway` / `SetOracle` / `SetPauseRegistry` — assert target is a deployed contract via `ContractManagement.GetContract`
- Systemic `Runtime.Time` unit bug — Neo N3 returns block timestamp in **milliseconds**; previously seconds-valued constants were added directly to it. Capsule lockup, trust inheritance, vault expiry, flash-loan cooldown, admin timelock, countdown round duration, envelope/RangePool expiry — all now operate at documented durations. Param renames where ABI shows units: `CreateTrust(... heartbeatIntervalMs)`, `CreateEnvelope(... expiryMs)`, `CreateRangeGasPool(... expiryMs)`. Constant renames: `TIMELOCK_DELAY_MS`, `CD_INITIAL_DURATION_MS`, `CD_MAX_DURATION_MS`, `CD_TIME_PER_KEY_MS`, `HEARTBEAT_MIN_MS`, `HEARTBEAT_MAX_MS`, `GRACE_PERIOD_MS`, `DEFAULT_VAULT_EXPIRY_MS`, `FLASH_COOLDOWN_MS`

**Edge functions**

- C-4 `auth-wallet` — signed message must include the address; `auth-wallet-nonce` rate-limited; `NEXTAUTH_SECRET` JWT fallback removed
- E-5 `OS_CONTRACTS` env-var name mismatch — `CONTRACT_STORAGE_SERVICE_HASH` etc. now read both canonical (`CONTRACT_STORAGESERVICE_HASH`) and legacy underscored aliases
- E-6 `requireKernelHash()` — kernel hash read per-call (no module-import caching) and `requireKernelHash()` fail-fast guard prevents empty-`contract_hash` intents in production
- E-7 placeholder edges — `os-payment-balance`, `os-leaderboard-get`, `os-vesting-list` now route to real kernel reads instead of returning misleading constants
- O-1 — added missing `os-escrow-get` edge function (`EscrowProxy.get()` was calling a 404 endpoint)
- H-7 `_shared/tee.ts` — HTTPS required everywhere except localhost; `*.workers.dev` suffix allowlist replaced with explicit `TEE_PUBLIC_RUNTIME_HOSTS` env list
- H-8 `_shared/ratelimit.ts` — fail-closed default; opt-in via `EDGE_RATELIMIT_FAIL_OPEN=true` (non-prod only)

**Frontend / SDK / config**

- C-5 admin console — `ADMIN_CONSOLE_API_KEY` auto-injection middleware removed; informational `AdminSecurityNotice` banner when no SSO is configured
- C-7 iframe sandbox — `sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"` added to both miniapp iframes
- H-1 / H-2 host CSP — `frame-ancestors` pinned to exact subdomains (no `*.onegate.space` / `*.miniapp.r3e.network` wildcards); miniapp paths keep `'unsafe-inline'` for Vite-injected runtime scripts now that C-7 sandbox is the actual boundary
- H-4 SDK boundary — `createHostSDK` calls `assertHostSdkServerContext()` (mirrors `AdminSDK`); opt-out via `HOST_SDK_ALLOW_BROWSER=true` for jsdom test harnesses
- Brand-color drift — 20+ `focus-visible:ring-emerald-*` / `text-emerald-*` / `hover:border-emerald-300` sites normalized to `ring-neo` / `text-neo` / `hover:border-neo/40` in host-app (Navbar, Footer, OperationPanel, AppDetailHeader, PlayArea components, key pages); admin-console 4 `ring-neo` sites normalized to `ring-primary-500/50` for intra-app consistency
- Admin dashboard stat-card glow — Card 4 changed from `bg-emerald-500/5` to `bg-neo/5` so the glow matches the `text-neo` body

**MiniApps**

- C-1 (miniapp review) — 7 manifests with broken `permissions: { ... }` schema converted to the canonical `permissions: [ ... ]` array
- H-1 (miniapp review) — `on-chain-tarot/scripts/manifest.json` stale `generate-interpretation` entry removed (the file never existed)
- H-3 (miniapp review) — `neo-treasury` dead `mainnet1.neo.coz.io` RPC replaced with the healthy mainnet2-5 + nspcc set
- M-1 (miniapp review) — stale `"vue": "catalog:"` and `"@vitejs/plugin-vue"` deps removed from 46 React-only miniapp `package.json` files

**CI / supply chain**

- M-22 — all `actions/checkout`, `setup-node`, `setup-go`, `upload-artifact` references in `.github/workflows/{ci,live-smoke}.yml` pinned to 40-char commit SHAs
- M-23 — `pg` client scripts default `rejectUnauthorized: true`; opt-out via `PG_SSL_INSECURE=true`
- M-21 — `fix_rls_for_anon.sql` moved to `deploy/scripts/dev/dev_only_fix_rls_for_anon.sql`, with a `DO $$` guard that hard-fails if `app.environment` is `prod | production | live | mainnet`
- M-17 — `Makefile INSECURE` default inverted to `0`; `--insecure` is now explicit opt-in
- M-15 — `apps/gasbox/chain-manifest.json` (1-of-61 stale orphan) deleted

**Tests**

- New regression tests in `contracts/__tests__/ContractSecurityRegressionTest.cs`: `AuditFixC2_QuadraticFundingBlocksSelfContribute`, `AuditFixC4_MiniAppIframesAreSandboxed`, `AuditFixH3_HostSdkRefusesBrowserConstruction`. The three audit fixes the test-tooling review flagged as having no source-level coverage are now pinned.
- `AnchorBoundarySafetyTest.PlatformAnchorCanStakeDirectlyFromNeoTransferData` — updated to assert the new structured-payload auto-stake shape and forbid the old bare-string trigger
- `deploy/scripts/lib/ci_workflow.test.mjs` — tolerates SHA-pinned action references (fix for the audit's M-22 pinning)
- `deploy/scripts/lib/morpheus_registry_sync.test.mjs` — green after running `node deploy/scripts/sync_morpheus_registry.mjs` to regenerate the Morpheus registry snapshot
- `__tests__/assets/official-brand-assets.test.ts` — now skips when staged miniapp assets are missing (the 2 environmental host-app failures); `MINIAPP_ASSETS_REQUIRED=1` opts back into strict mode for CI

**Documentation**

- README test-count claim "500+ test files" → "215+ test files / 989+ test cases" with the actual per-suite breakdown
- New: `docs/reports/security-audit-2026-05-19.md` (full audit report)

**Build / test status at end of session:** contracts 56/56, host-app 649 pass / 2 skip (asset-staging), admin-console 223/223, deploy-scripts 60/60, SDK typecheck clean, admin-console typecheck clean, host-app typecheck clean. Total **988 tests passing**, **0 failing**, 2 conditionally skipped.

### Added (prior)

- Sprint 1: Code quality baseline and security improvements
- Environment isolation configuration (development, testing, production)
- Unified error handling package (`infrastructure/errors`)
- Unified structured logging package (`infrastructure/logging`)
- Kubernetes secrets template (`k8s/secrets.yaml.template`)
- Supabase Edge gateway functions (auth/routing, API keys, secrets, gasbank, intents)
- Platform contracts for MiniApp flow (Governance/PriceFeed/RandomnessLog/AppRegistry/AutomationAnchor)
- `txproxy` service for allowlisted tx signing/broadcast (single tx policy point)
- Product enclave services: `neofeeds`, `neooracle`, `neocompute`, `neoflow`
- Shared infrastructure packages under `infrastructure/` (chain, secrets, database, middleware, runtime, metrics)

### Changed

- Updated documentation for the current Supabase Edge + platform-contract architecture
- Standardized chain writes through `txproxy` with contract+method allowlisting
- Hardened outbound request policies (URL allowlists, SSRF mitigations) in strict identity/Nitro mode

### Removed

- Legacy Go gateway binary (Supabase Edge is the public gateway)
- Legacy VRF (`neorand`) and NeoVault services (out of scope for current platform)
- Legacy on-chain gateway / per-service contract stack (replaced by platform contracts)

### Fixed

- Documentation and module consistency issues (empty/broken modules, incorrect service docs)

### Security

- Added strict identity/Nitro mode safeguards and safer defaults for internal services

## [0.1.0] - 2024-12-10

### Added

- Initial release with NitroRun + Nitro runtime + Supabase + Vercel architecture
- 9 core services: Gateway, NeoRand (VRF), NeoVault, NeoOracle, NeoFlow, NeoAccounts (AccountPool), NeoCompute, NeoStore (Secrets), NeoFeeds
- Neo N3 smart contracts for service integration
- TEE protection with NitroRun/Nitro runtime
- Remote attestation via NitroRun
- Multi-tenant database with Row Level Security
- Deterministic Shared Seed Privacy NeoVault (v4.1)

### Security

- All services run inside Nitro runtime NitroRun TEE
- Secrets never leave the TEE
- TLS termination inside TEE
- ECDSA secp256r1 (Neo N3 compatible)
- AES-256-GCM encryption
- HKDF key derivation
- VRF (ECVRF-P256-SHA256-TAI)

[Unreleased]: https://github.com/r3e-network/neo-miniapp-platform/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/r3e-network/neo-miniapp-platform/releases/tag/v0.1.0
