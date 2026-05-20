# Security Audit — Neo MiniApps Platform

**Audit date:** 2026-05-19
**Repo:** `neo-miniapps-platform` (master @ `7cdfea53`)
**Auditor:** Claude (Opus 4.7) — multi-agent review across smart contracts, edge functions, frontends, and secrets/CI/supply chain, plus direct reviewer cross-check.
**Method:** Static read-only analysis. No runtime testing. Every finding cites `file:line` evidence.

> This audit was produced end-to-end by an automated AI auditing pipeline. Every finding should be triaged by a human engineer before remediation lands. Treat severity as guidance, not gospel.

---

## 1. Executive summary

The Yiwu MiniApp platform is a substantial multi-surface system: 64 C# Neo N3 contracts (PlatformAnchor / PlatformDeFi / PlatformGame / PlatformSocial plus 4 standalone MiniApp contracts), ~93 Supabase/Deno edge functions, a Next.js host shell that loads 60 third-party MiniApps, an admin console, and supporting CI / deploy / SDK plumbing. The codebase shows real defensive engineering — AES-GCM at-rest secrets, per-app storage prefixes, anti-Martingale dice limits, a reentrancy guard around flash-loan repayment, CEI-style ordering in most contracts, scaled-remainder reward math in the staking pool, a 24-hour timelock on `PlatformGame` admin changes, a centralized env validator, SHA-pinned Nitro base images, scoped CI permissions, and an existing security-regression test suite — but the audit surfaced **6 Critical**, **11 High**, and ~30 Medium/Low issues that collectively put fund custody, account integrity, and the platform's trust boundary at risk.

The single highest-impact findings span four different surfaces:

1. **`FlashWithdraw` (PlatformDeFi.FlashLoan.cs:201-218)** has no admin/depositor-balance check — any caller can drain the flash-loan pool.
2. **`MiniAppQuadraticFunding.FinalizeRound`** lets the round creator assign arbitrary match amounts to any project, including their own; combined with permissive self-contribution this completely defeats the QF property.
3. **MiniApp iframes have no `sandbox` attribute** and are served same-origin — any of the 60 third-party miniapps can lift the host's JWT, hijack `window.MiniAppSDK`, and submit arbitrary wallet intents.
4. **The admin console has no in-app auth gate** — middleware silently injects the admin API key on every browser request, making the dashboard a single URL away from full admin compromise.
5. **A testnet WIF (`***REMOVED***`)** was committed in 2026-03-31 and removed two weeks later, but remains recoverable from git history; the same WIF is still active in the local `.env` for `NEO_TESTNET_WIF`, `FLAGSHIP_LIVE_WIF`, `AA_TEST_WIF`, and `ORACLE_TEST_WIF`.
6. **`secrets-get` decrypts every user's secrets with one master AES key**; combined with weak edge auth, compromise of `SECRETS_MASTER_KEY` exposes all stored secrets.

| Severity | Count |
|---|---|
| Critical | 6 |
| High | 11 |
| Medium | ~22 |
| Low / Info | ~25 |

Each section below cites concrete `file:line` evidence. §6 lists the positive controls worth preserving.

---

## 2. Critical findings

### C-1. `PlatformDeFi.FlashLoan.FlashWithdraw` lets any caller drain the pool
**File:** `contracts/platform/PlatformDeFi/PlatformDeFi.FlashLoan.cs:201-218`
**Reachability:** public, on-chain
**Confirmed by:** direct review + smart-contract audit agent

```csharp
public static void FlashWithdraw(string appId, UInt160 provider, BigInteger amount)
{
    ValidateApp(appId, ProductType_FlashLoan);             // only checks pause + type
    ValidateAddress(provider);
    ExecutionEngine.Assert(Runtime.CheckWitness(provider), "unauthorized");
    ExecutionEngine.Assert(amount > 0, "amount required");
    // ... no admin check, no depositor-share check ...
    BigInteger poolBalance = GetBigInteger(poolKey);
    ExecutionEngine.Assert(poolBalance >= amount, "insufficient pool balance");
    GAS.Transfer(Runtime.ExecutingScriptHash, provider, amount, null);
    Put(poolKey, poolBalance - amount);
}
```

The doc comment claims "Only platform admin or app admin can withdraw on behalf of the pool" but no admin check exists. `ValidateApp` (`PlatformDeFi.Admin.cs:168-174`) checks only platform-paused, app-paused, and product type. `FlashDeposit` (line 182) adds to a flat `PREFIX_POOL_BALANCE` without tracking per-LP shares (`PlatformDeFi.cs:90`), so there is no concept of "provider's share" to enforce against. Any caller signs a tx with their own address as `provider`, calls `FlashWithdraw(appId, attacker, pool_balance)`, and the contract transfers all GAS to them.

Note: `contracts/__tests__/FinancialTransferSafetyTest.PlatformDeFiOtherProductsKeepFundsInsideProductRecipients` (line 47) actually codifies the broken behavior — it asserts only that `Runtime.CheckWitness(provider)` is present.

**Fix:** maintain a per-provider deposit map (e.g. `AppKey(appId, PREFIX_FLASH_PROVIDER_BAL, provider)`) on every `FlashDeposit`, and constrain `FlashWithdraw` to the caller's own credited balance; or restrict `FlashWithdraw` to `ValidateAppAuthority(appId)` per the doc-string.

### C-2. `MiniAppQuadraticFunding.FinalizeRound` allows arbitrary match assignment
**File:** `contracts/MiniAppQuadraticFunding/MiniAppQuadraticFunding.Methods.cs:126-170`; supporting: `MiniAppQuadraticFunding.Projects.cs:97-143` (`Contribute`), `:145-173` (`ClaimProject`).
**Found by:** smart-contract audit agent

`FinalizeRound` accepts caller-supplied `BigInteger[] matchedAmounts` and writes each value verbatim to `ProjectData.MatchedAmount`. The only on-chain invariant is `totalMatched <= round.MatchingPool` (line 163). Authorization is `fromGateway || CheckWitness(round.Creator) || CheckWitness(Admin())` — the round creator (who very plausibly also registered their own project) is authorized to allocate the entire matching pool to themselves. `Contribute` does not block `contributor == project.Owner`, so the creator can also inflate `project.TotalContributed` by self-contributing; `ClaimProject` then pays out `TotalContributed + MatchedAmount`.

**Exploit (purely on-chain, no Sybil server needed):**
1. Attacker (also round creator) registers a project under a second key.
2. Self-contributes a small amount.
3. After `endTime`, calls `FinalizeRound` and assigns the entire matching pool to that project.
4. Claims `MatchingPool + small contribution`.

**Fix:** constrain `FinalizeRound` to a multi-sig of independent operators or an attested computation; compute matches on-chain from stored contributions; and at minimum lock `round.Creator` (and any project owner) out of `FinalizeRound`.

### C-3. `MiniAppMilestoneEscrow.CancelEscrow` claws back approved-but-unclaimed milestones
**File:** `contracts/MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Methods.cs:181-208`
**Confirmed by:** direct review + smart-contract audit agent

`CancelEscrow` refunds `escrow.TotalAmount - escrow.ReleasedAmount`. `escrow.ReleasedAmount` is incremented only inside `ClaimMilestone` (line 156), not on `ApproveMilestone`. So a creator can: (1) approve milestone 1, (2) let the beneficiary trust the on-chain signal and ship final work, (3) immediately `CancelEscrow` to claw the approved-but-unclaimed funds back.

**Fix:** in `CancelEscrow`, deduct `Σ(approved && !claimed milestone amounts)` from the refund, leaving those amounts claimable by the beneficiary; or refuse to cancel while any approved milestone is unclaimed; or add a beneficiary-controlled time-lock window.

### C-4. MiniApp iframes have no `sandbox` attribute (host trust boundary broken)
**Files:**
- `platform/host-app/components/playarea/PlayAreaShared.tsx:595-602`
- `platform/host-app/components/playarea/PlayAreaMedia.tsx:82-88`
**Found by:** frontend audit agent

Both miniapp `<iframe>`s omit `sandbox` and load `/miniapps/<slug>/index.html` from the same origin. With no sandbox + same-origin, a malicious or compromised miniapp can:

- Read `window.parent.sessionStorage` and lift `sb-access-token` (`platform/host-app/lib/auth/store.ts:121,145`).
- Mutate `window.parent.MiniAppSDK` (`platform/sdk/src/window.ts:13`) to trick the host into signing arbitrary intents.
- Navigate the top frame.
- Read the in-memory WIF when `NEXT_PUBLIC_ENABLE_WIF_WALLET=true` via `window.parent.useWalletStore.getState()`.

The architecture explicitly relies on miniapps being untrusted; without iframe isolation there is no enforceable boundary. Combined with **H-1** (`'unsafe-inline'` in the miniapp CSP), any HTML/JSON injection in miniapp content also becomes XSS in the host origin.

**Fix:** add `sandbox="allow-scripts"` (deliberately not `allow-same-origin`) to both iframes; serve miniapps from a different eTLD+1 (e.g. `miniapp.r3e.network` — already in `frame-ancestors`); move the bearer token from `sessionStorage` to an httpOnly cookie.

### C-5. Admin console is wide-open — middleware auto-injects admin API key on every browser request
**Files:**
- `platform/admin-console/src/middleware.ts:3-20`
- `platform/admin-console/src/lib/admin-auth.ts:99-122`
- `platform/admin-console/src/app/layout.tsx:16-38` (no auth wrapper)
- `platform/admin-console/src/app/page.tsx:15-215` (dashboard renders unconditionally)
**Found by:** frontend audit agent

The middleware silently sets `x-admin-key: $ADMIN_CONSOLE_API_KEY` on every `/api/*` request that doesn't already have one, and the pages render with no auth wrapper. Any visitor who can resolve the admin URL — no login, no SSO, no IP allowlist enforced in code — becomes a full admin: list users, mutate miniapp status, manage oracle secrets, run live-smoke verification. The README documents the trust model but the application itself does not enforce it.

**Fix:** remove the auto-injection middleware; wrap every page in a server-side `requireAuth()` tied to Auth0/SSO with an admin role check; refuse to start the admin process if `ADMIN_CONSOLE_API_KEY` is set without `NEXTAUTH_URL`/equivalent SSO env.

### C-6. Committed-and-removed testnet WIF still recoverable from git history; same WIF is still active
**File (added):** commit `3423e507` (2026-03-31), `deploy/scripts/smoke_business_workflows.js:24` (original)
**File (removed):** commit `17c78cc9` (2026-04-13)
**Active reuse:** `.env` `NEO_TESTNET_WIF`, `FLAGSHIP_LIVE_WIF`, `AA_TEST_WIF`, `ORACLE_TEST_WIF`
**Found by:** secrets/supply-chain audit agent

The WIF `***REMOVED***` (address `NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu`) is recoverable from any clone via `git show 3423e507:deploy/scripts/smoke_business_workflows.js`. The same WIF still appears as the active value in the local `.env` for four separate variables. Although it is "only" testnet, it is the key used for the project's flagship live-validate flows and oracle test paths; anyone holding the public commit can sign txns from those accounts.

**Fix:** treat the WIF as compromised. Generate a fresh testnet keypair; update `.env` and any deployment secrets; either accept the historical exposure (acceptable for testnet-only blast radius if the new key is genuinely never the same) or rewrite history with `git filter-repo` and force-push (coordinate with collaborators).

### C-7. (Also Critical) `secrets-get` decrypts every user's secrets with one master AES key
**Files:** `platform/edge/functions/secrets-get/index.ts:9-65`, `platform/edge/functions/_shared/secrets.ts:36-67`
**Found by:** edge function audit agent

All user-stored secrets are encrypted with one 32-byte `SECRETS_MASTER_KEY`. The decryption path is reachable by any session-with-primary-wallet (with `requireHostScope` providing only weak protection in non-prod due to `isProductionEnv()` fragility). Combined with the structurally weak `auth-wallet` flow (see H-4) and the lack of per-user envelope encryption, a single key compromise discloses every user's stored secrets.

The crypto itself is correct (AES-256-GCM, fresh 12-byte nonce, 64-hex-char production check) — the issue is key-management architecture.

**Fix:** move to per-user envelope encryption (encrypt each secret with a user-derived key wrapping a per-record DEK) or back the master key with a KMS that enforces policy-based access. Plan a rotation strategy before more secrets accrue.

---

## 3. High-severity findings

### H-1. Miniapp CSP allows `'unsafe-inline'` (and `'unsafe-eval'` for OneGate vault)
**Files:** `platform/host-app/next.config.js:27`, `platform/host-app/middleware.ts:67-77`, `:126`

Comment explains "OneGate native wallet injects after navigation". Combined with C-4, any HTML/JSON injection in miniapp content trivially becomes XSS in the host origin. Fix: use nonces, or constrain `'unsafe-inline'` to the precise OneGate UA / path only.

### H-2. `frame-ancestors` wildcards `*.onegate.space` and `*.miniapp.r3e.network`
**Files:** `platform/host-app/next.config.js:35`, `platform/host-app/middleware.ts:94`

Attacker who controls (or takes over) a subdomain can iframe the host for clickjacking of wallet-signing flows. Fix: pin to exact subdomains.

### H-3. `EdgeClient.submitWalletIntentIfPresent` auto-signs any invocation-shaped response
**File:** `apps/shared/services/os/EdgeClient.ts:142-162`

Any miniapp-initiated edge call whose response contains an invocation-intent shape triggers wallet signing through the host SDK without an explicit confirmation step. Combined with C-4 this becomes much more dangerous. Fix: make signing explicit via `wallet.invokeWithConfirmation(intent, …)` with a host-rendered confirmation modal; allowlist endpoints that may return intents.

### H-4. `auth-wallet` does not bind the signed message to the address; `auth-wallet-nonce` has no rate-limit
**Files:** `platform/edge/functions/auth-wallet/index.ts:50-69`, `platform/edge/functions/auth-wallet-nonce/index.ts:12-80`

`auth-wallet` looks up `users` by `.eq("address", address)`, verifies signature, then checks `message.includes(nonce)`. It does NOT verify `message.includes(address)`. `auth-wallet-nonce` is unauthenticated and unthrottled, so an attacker can rotate any user's nonce at will (login-DoS, user enumeration via `account_id` presence in the response, pre-positioning nonce values). The single-tx full-takeover via EVM/Neo address-format collision (`address.startsWith("0x")` at line 35) is computationally infeasible, but the structural defect is real and compounds.

**Fix:** add `if (!message.includes(address)) return error(401, …)` after the nonce check; add `requireRateLimit(req, "auth-wallet-nonce")`; ideally move nonces to a `wallet_nonces` table keyed by `(address, requested_at)` instead of mutating `users.nonce`.

### H-5. Hand-rolled HS256 JWT issuance with no `iss`, `iat`, `kid`; fallback to `NEXTAUTH_SECRET`
**Files:** `platform/edge/functions/auth-wallet/index.ts:78-90`, `platform/edge/functions/_shared/jwt.ts:3-29`

Supabase-compatible token minted directly from edge with no issuer/audience binding, 24h lifetime, no refresh. Fix: stop minting JWTs from edge; integrate with Supabase Admin Auth's session creation; drop the `NEXTAUTH_SECRET` fallback.

### H-6. Automation triggers trust forwarded `X-User-ID` header upstream
**Files:** `automation-triggers/index.ts:41-58`, `automation-trigger/index.ts:35-37`, `automation-trigger-{delete,update,enable,disable,resume,executions}/index.ts`

Edge sets `X-User-ID: auth.userId` and forwards to NeoFlow. No edge-side ownership check that the requested `trigger_id` belongs to `auth.userId`. Fix: ownership table mirrored in Supabase, checked in edge before forwarding; or sign `X-User-ID` between Edge and NeoFlow.

### H-7. `_shared/tee.ts` permits `http://` in non-production; auto-attaches Bearer tokens to `*.workers.dev`
**File:** `platform/edge/functions/_shared/tee.ts:91-170`, `:27-34`

`requestJSON` only blocks `http://` when `isProductionEnv()` is true. The "public runtime hosts" allowlist matches `*.workers.dev` as a suffix and auto-attaches `MORPHEUS_RUNTIME_TOKEN` / `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`. Combined with weak env detection on staging-but-actually-prod, a user-controlled URL feeding into `requestJSON` becomes a Bearer-token leak via `attacker.workers.dev`.

**Fix:** always require HTTPS; explicit hostname allowlist; remove the `.workers.dev` suffix match.

### H-8. Rate limiter fails open in non-production
**File:** `platform/edge/functions/_shared/ratelimit.ts:113-123`

If the rate-limit storage backend errors and `isProductionEnv()` returns false, all rate limits return `null` (allow). Fix: default fail-closed unless `EDGE_RATELIMIT_FAIL_OPEN=true` is set explicitly.

### H-9. Predictable randomness in RedEnvelope and Range-Gas-Pool flows
**Files:**
- `contracts/platform/PlatformSocial/PlatformSocial.Envelope.cs:67-71` (`SHA256(envelopeId || creator || Runtime.Time)`)
- `contracts/platform/PlatformSocial/PlatformSocial.Envelope.Internal.cs:26-42` (`Runtime.GetRandom()` + caller-mixable entropy)

Both seeds are predictable / grindable at tx-submission time. An observer of `EnvelopeCreated` can pre-compute every packet's amount and front-run other claimers for the "best luck" prize; for range pools an attacker can grind addresses to maximize `entropy % (range+1)`. Fix: route social randomness through Morpheus VRF (the games already do this).

### H-10. `UnbreakableVault.AttemptBreak` exposes solution in mempool
**File:** `contracts/platform/PlatformSocial/PlatformSocial.Vault.cs:74-122`

The plaintext `solution` is included in the tx body; any mempool observer (including a malicious validator/relayer) can copy it, raise their network fee, and frontrun the claim. Fix: commit-reveal — commit `H(salt || solution || attacker)` first, then reveal after N blocks.

### H-11. `PlatformGame` and `PlatformSocial` declare `[ContractPermission("*", "*")]`
**Files:** `contracts/platform/PlatformGame/PlatformGame.cs:48`, `contracts/platform/PlatformSocial/PlatformSocial.cs:46`

Excessive privilege. For `PlatformGame` specifically, the per-app admin-registered gacha asset hash means a malicious operator can register an "asset" whose `transfer` re-enters across appIds (per-appId reentrancy guards don't span tenants). Fix: replace with explicit `[ContractPermission(NEO.Hash, "transfer", "vote", "balanceOf")]`, `[ContractPermission(GAS.Hash, ...)]`, and `[ContractPermission(oracleHash, "requestFromCallback")]`. Require pre-allowlisted prize asset contracts.

### H-12. `Resolve{CoinFlip,Gacha}` direct entry bypasses `requestId → betId` binding
**Files:**
- `contracts/platform/PlatformGame/PlatformGame.CoinFlip.cs:166-186` (passes `requestId=0` to internal resolver)
- `contracts/platform/PlatformGame/PlatformGame.Gacha.Play.cs:83-104` (same shortcut)

The internal resolvers skip the `requestId>0` mapping check (which Dice correctly enforces at `PlatformGame.Dice.cs:218-222`). A compromised oracle can resolve any bet to any outcome without binding to the original request. Fix: require `requestId>0` and mapping verification in both internal resolvers, or remove the direct public entry points entirely (settlement is already routed through `OnOracleResult`).

### H-13. Single-step admin transfer and single-key `Update` across most contracts
**Files:**
- `contracts/MiniApp.DevPack/MiniAppCompactBase.cs:98-103, 132-136`
- `contracts/platform/PlatformAnchor/PlatformAnchor.cs:108-113, 128-132`
- `contracts/platform/PlatformDeFi/PlatformDeFi.Admin.cs:62-67, 75-79`
- `contracts/platform/PlatformSocial/PlatformSocial.Admin.cs:80-85, 93-97`

`SetAdmin` is one-tx with no acceptance step, no event. `Update(nef, manifest)` is gated by a single admin signature with no timelock or multi-sig. (`PlatformGame.Admin.cs:109-137` is the one good example with a 24h propose/execute timelock — but its `Update` does NOT use the same timelock, and `ExecuteAdminChange` itself emits no event.)

**Fix:** adopt `PlatformGame`'s timelock pattern uniformly; add `AdminChanged(old, new)` events; require multi-sig admin for `Update`; emit `ContractUpgraded(newCodeHash)`.

---

## 4. Medium-severity findings

### M-1. `PlatformDeFi.FlashLoan` callback uses `CallFlags.All`
**File:** `contracts/platform/PlatformDeFi/PlatformDeFi.FlashLoan.cs:152-153`

Borrower-controlled `callbackContract` invoked with full call/storage/witness rights. Reentrancy guard prevents re-entry into the same borrower's flash loan but allows callback to call other platform contracts under the original signer's witness. Fix: minimize to `CallFlags.ReadStates | CallFlags.AllowCall`.

### M-2. Dice RNG has modular bias; only first byte used
**File:** `contracts/platform/PlatformGame/PlatformGame.Dice.cs:143-144`

`randomBytes[0] % 6 + 1` — outcomes 1..4 are 16.8% likely, 5..6 are 16.0%. Fix: read more bytes and use rejection sampling.

### M-3. Stuck dice bet on payout-liquidity failure
**File:** `contracts/platform/PlatformGame/PlatformGame.Dice.cs:155-158`

If `GAS.BalanceOf < payout` the entire tx reverts (restoring the requestId mapping), but the oracle has already produced a result. If Morpheus doesn't retry, the bet is stuck. Fix: guarantee oracle retry or expose admin `EmergencyRefundDice(betId)`.

### M-4. Daily limit doubleable at day boundary
**File:** `contracts/platform/PlatformGame/PlatformGame.Dice.cs:229,243`

`currentDay = Runtime.Time / 86400000` resets at UTC midnight. Attacker bets at 23:59:59 then 00:00:01. Fix: rolling 24h window.

### M-5. Anti-Martingale `betCount` reset is dead code
**Files:** CoinFlip `PlatformGame.CoinFlip.Internal.cs:29-57`, Dice `PlatformGame.Dice.cs:240-255`

`RecordX` writes `currentTime` to `PREFIX_PLAYER_LAST` BEFORE reading `lastBetTime` for the reset check, so `elapsed = 0` always. After 20 consecutive bets a player is locked out forever for that app. Fix: read `lastBetTime` before writing.

### M-6. Trust `Heartbeat` resets even past grace deadline
**File:** `contracts/platform/PlatformSocial/PlatformSocial.Trust.cs:73-87`

Owner can re-extend the timer indefinitely as long as the heir has not yet executed, defeating the "if owner is gone, heir inherits" semantic. Fix: assert `Runtime.Time < trust.Deadline + GRACE_PERIOD_SECONDS`.

### M-7. Trust `ExecuteTrust` uses `Tx.Sender` for guardian path
**File:** `contracts/platform/PlatformSocial/PlatformSocial.Trust.cs:104-107`

Mismatch with the rest of the codebase (everywhere else uses `CheckWitness`). Multi-sig or contract-account guardians can fail to satisfy. Fix: require `guardian` parameter and `CheckWitness(guardian) && IsGuardian(...)`.

### M-8. `PlatformDeFi.Capsule` & lending "consume all credit" lock excess deposit
**Files:** `PlatformDeFi.Capsule.cs:94-100`, `PlatformDeFi.Lending.cs:25-33`, `:134-141`

User deposits 10 NEO intending three 3-NEO capsules + 1 NEO refund; first call sweeps all 10 NEO into one locked capsule. Fix: accept explicit `amount` parameter.

### M-9. Countdown allocates 42% (dividend + referral + platform) but never disburses
**Files:** `PlatformGame.Countdown.cs:29-35`, `PlatformGame.Countdown.Internal.cs:21-56`

Constants imply features that don't exist; funds accumulate untracked in the contract. Fix: either remove unused constants or implement the dividend/referral/platform-claim paths.

### M-10. `MiniAppMilestoneEscrow.CancelEscrow` is creator-only with no arbitration
**File:** `MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Methods.cs:181-208`

Even if C-3 is fixed, the structural issue remains: creator can unilaterally cancel before any approval, with no beneficiary veto. Acceptable for "soft escrow" but dangerous for adversarial parties. Fix: arbitration path or time-locked cancellation.

### M-11. Permissionless anchor app registration with no rate-limit
**File:** `contracts/platform/PlatformAnchor/PlatformAnchor.cs:140-145`

Any witness'd address can register unbounded anchor apps. Storage-cost DoS / state-bloat vector. Fix: per-caller rate-limit, registration fee, or admin allowlist.

### M-12. `os-{game-settle, leaderboard-reset, badge-*, storage-set, storage-delete}` lack developer-ownership checks
**Files:** `os-game-settle/index.ts:6-22`, `os-leaderboard-reset/index.ts:6-17`, `os-badge-{define,award,revoke}/index.ts`, `os-storage-{set,delete}/index.ts`

Endpoints accept `app_id` from the body and craft on-behalf-of intents without checking whether `auth.userId` is the developer. On-chain ACL is the ultimate gate but the edge exposes confused-deputy surface. Fix: `await isDeveloperOfApp(supabase, auth.userId, appId)` gating.

### M-13. SECRETS_MASTER_KEY deploy fan-out
**Files:** `deploy/scripts/apply_edge_secrets_from_env.sh:21`, `deploy/scripts/deploy_k8s.sh:508,551,580`, `platform/edge/functions/_shared/secrets.ts:62`, `deploy/supabase/functions/README.md`, `deploy/supabase/README.md`

The same key flows through multiple deploy paths; rotation will be operationally expensive. Fix: design rotation strategy now (e.g., dual-key transition window) before more secrets accrue.

### M-14. `NEXT_PUBLIC_ADMIN_API_KEY` foot-gun in `.env.example`
**File:** `.env.example:287-288`

Commented but the variable-name template invites operators to expose the admin API key in the browser bundle. Fix: delete the lines or rewrite as an explicit "do not do this" warning.

### M-15. Stale `apps/gasbox/chain-manifest.json` points to a different testnet contract
**Files:** `apps/gasbox/chain-manifest.json:13` vs `apps/gasbox/neo-manifest.json`

Different testnet contract addresses (`0x38f050...` vs `0x740671...`). Not loaded by source but bundled to Vercel. Fix: delete the orphan file.

### M-16. WIF wallet readable from window when enabled
**Files:** `platform/host-app/components/features/wallet/ConnectButton.tsx:25-28`, `platform/host-app/lib/wallet/store.ts:272-285`

Combined with C-4, miniapps can read the WIF from `window.parent.useWalletStore.getState()` when the flag is on. Fix: keep WIF in adapter-closure scope only; zero after use.

### M-17. `Makefile INSECURE ?= 1` default
**File:** `Makefile:25-29`

Default passes `--insecure` to `nitrorun` for local Nitro TEE testing. Fix: invert to `INSECURE ?= 0`; require explicit opt-in.

### M-18. Mock oracle-secrets endpoint in admin console
**File:** `platform/admin-console/src/app/api/oracle-secrets/route.ts:1-8`

`// MOCK: In-memory stub`. Operators may believe they've persisted oracle secrets when nothing is stored. Fix: gate behind a config flag or replace with real impl.

### M-19. Address case/format normalization inconsistencies
**Files:** edge audit §A5; various across `auth-wallet`, `auth-wallet-nonce`, `wallet-balance`, `_shared/neo.ts`

Mixing case-insensitive EVM with case-sensitive Neo Base58 in the same `users.address` column opens silent account-merge ambiguity. Fix: pick one canonical form per chain; reject all others at the boundary.

### M-20. `api-keys-create` accepts arbitrary scope strings
**File:** `platform/edge/functions/api-keys-create/index.ts:37-42`

Allows requesting `*` / `admin` / `super_admin` directly. Fix: server-side scope allowlist.

### M-21. `fix_rls_for_anon.sql` grants anon full write to 5 tables
**File:** `deploy/scripts/fix_rls_for_anon.sql:11-43`

Header says "DEVELOPMENT WORKAROUND" but lives next to production scripts. If accidentally applied to prod, anonymous browser clients can read/write `pool_accounts`, `account_balances`, `chain_txs`, `contract_events`, `simulation_txs`. Fix: move to `dev/`, rename `dev_only_*.sql`, add `\echo` guard hard-failing on `app.environment = 'prod'`.

### M-22. GitHub Actions pinned to mutable major tags
**Files:** `.github/workflows/ci.yml:36,71,110`, `:39,113`, `:74`, `.github/workflows/live-smoke.yml:37,136,290`

`@v6` / `@v7` major-tag pins are mutable. Compromised action repo can inject malicious code into a runner that has access to `secrets.FLAGSHIP_LIVE_WIF`, `secrets.MORPHEUS_ORACLE_UPDATER_WIF`, etc. Fix: pin every action to a 40-char commit SHA.

### M-23. `rejectUnauthorized: false` in three pg client scripts
**Files:** `deploy/scripts/backfill-miniapp-versions.js:55,66`, `deploy/scripts/run_migration.js:28`, `deploy/scripts/verify-publish-audit-chain.js:59,76`

Disabling TLS verification opens MITM-on-untrusted-network risk. Supabase's Postgres endpoints have valid certs. Fix: `ssl: { rejectUnauthorized: true, ca: <supabaseCABundle> }` or `ssl: 'require'`.

### M-24. npm audit: 4 high, 6 moderate, 6 low transitive vulns
Top: `lodash` (via `@cityofzion/neon-js`), `ws` (via `ethers`), `postcss` (via `next`, partially mitigated by overrides), `brace-expansion`. Fix: track upstream `@cityofzion/neon-js` lodash bump; add `ws` to root `overrides`.

### M-25. `@r3e/neo-js-sdk` pinned to mutable git tag
**Files:** `package.json:53`, `platform/host-app/package.json:22`

`tar.gz/refs/tags/v0.3.7-r3e.1` — tags can be re-pointed. Mitigated by `package-lock.json` integrity, but `npm install` (vs `npm ci`) re-fetches. Fix: pin by commit SHA or publish under a scoped npm name.

### M-26. Admin console CSP allows `'unsafe-inline'`; "fake" CSRF token
**Files:** `platform/admin-console/next.config.js:19`, `platform/admin-console/src/lib/host-admin-proxy.ts:22-36`

CSP doesn't use nonces; the proxy generates a CSRF token and immediately uses it as its own cookie — provides zero protection. Fix: use the host-app's nonce middleware pattern; remove the fake CSRF.

### M-27. Sentry/PostHog DSN format not validated
**File:** `.env.example:445-448`; validator at `deploy/scripts/validate-miniapp-env.js`

A misconfigured Sentry DSN containing a project secret can leak via the browser bundle. Fix: add a DSN format validator that rejects URLs with anything other than the standard `https://<publicKey>@<host>/<projectId>` shape.

---

## 5. Other findings (Low / Info)

A representative subset. Full lists in each agent's detailed output.

- **No `AdminChanged` / `OracleChanged` / `GatewayChanged` events** across `MiniAppCompactBase` and platform setters. Indexers cannot react to role rotations.
- **`_deploy` only initializes `PREFIX_ADMIN`** — subsequent bootstrap txs are needed to set gateway/oracle/pause registry. Undocumented assumption.
- **Setters don't validate target is a deployed contract** (no `ContractManagement.GetContract(addr) != null`). A typo'd gateway silently sinks attested calls.
- **`MiniAppEventTicketPass.Transfer`** calls `onNEP11Payment` via `CallFlags.All` without declaring the permission — transfers to contract accounts will fail at runtime.
- **Variable-length storage-key concat in `MiniAppQuadraticFunding.Internal.cs:80-87`** — small collision risk; fix with fixed-width keys or a length prefix.
- **`PlatformSocial.OnNEP17Payment` doesn't scope credits to an appId** (`PlatformSocial.Credit.cs:18-37`). Compare to `PlatformGame.Credit.cs:96-121` which requires `memo.StartsWith(appId + ":")`. Front-end MITM could route a user's funding into the wrong app.
- **`os-leaderboard-submit` uses `Number(score)` → `Math.floor`** — loses precision for large scores. Use `BigInt(String(score))`.
- **`gas-sponsor-check` uses `parseFloat`** while `gas-sponsor-request` correctly uses `BigInt`. Inconsistent math at quota boundary.
- **Stale wallet session on `onAccountChanged`** — `sb-access-token` isn't invalidated when wallet rotates. Fix: clear token + force re-login.
- **Console logging of `accountId` UUIDs** in `auth-wallet/index.ts:58,74` and `auth-social-sync/index.ts:64,81,93,…` — log infrastructure compromise → user-ID enumeration.
- **`SUPABASE_SERVICE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` share placeholder in `.env.example:13-15`** — verify intentional duplication in production.
- **`.env` is mode 664 (group-readable)** locally. Recommend `chmod 600`.
- **`auth-social-sync` merges identities by email without `email_verified` check** (`auth-social-sync/index.ts:73-97`).
- **Admin Console Dockerfile uses unpinned `node:20-alpine` base** (`platform/admin-console/Dockerfile:6`). Recommend pin by digest.
- **Existing security regression test suite** (`contracts/__tests__/ContractSecurityRegressionTest.cs`) covers envelope creator-zero check, range-pool double-claim prevention, GAS credit recovery — credit to the team for codifying these.

### Documentation/structure observations (not vulnerabilities)

- **Platform infrastructure contract source is not in this repo.** README §"Platform Contracts" lists Governance / PriceFeed / RandomnessLog / AppRegistry / AutomationAnchor / PauseRegistry as platform contracts with on-chain hashes in `.env`, but no C# source is present. Auditors cannot validate them from this repo alone. Either bring the source in or document where it lives.
- **`.oracle-edit` symlink** to `/home/neo/git/neo-morpheus-oracle` is unreferenced by any build/script (Info).

---

## 6. Positives — preserve these

Contracts:
- **Reentrancy guard around flash-loan repayment** (`PlatformDeFi.FlashLoan.cs:108-110,160`) — established before `GAS.Transfer` + callback, released only after balance check.
- **Exact-repayment invariant** (`PlatformDeFi.FlashLoan.cs:156-157`).
- **Dice oracle binding** (`PlatformGame.Dice.cs:216-222` — requestId>0 required, mapping deleted after use).
- **Scaled-remainder reward accounting** in staking pool preserves dust (`PlatformAnchor.Internal.cs:97-106`).
- **Precision-safe capsule yield math** (`PlatformDeFi.Capsule.cs:51-76`).
- **Capsule pause-resistant exits** (anchor reward invariant test codifies that withdraw/claim don't gate on `ValidateAnchorOpen`).
- **Soulbound enforcement** (`MiniAppSoulboundCertificate.Methods.cs:193-209`).
- **Per-app pause hierarchy** (`MiniAppCompactBase.ValidateNotGloballyPaused`).
- **Direct-payment memo discipline** in `MiniAppCompactBase.CreditDirect{Gas,Asset}Payment` (`MiniAppCompactBase.cs:146-196`).
- **Per-appId reentrancy locks for games** (`PlatformGame.Internal.cs:137-152`).
- **24-hour timelock** on `PlatformGame` admin change (`PlatformGame.Admin.cs:109-137`) — pattern worth extending platform-wide.
- **No `Destroy` method anywhere** (verified by grep).
- **Pessimistic balance pre-check on Dice payouts** (`PlatformGame.Dice.cs:85`).
- **Storage prefix discipline** — every contract documents its prefix range in header comments.
- **Existing contract-security regression test suite** (`contracts/__tests__/`).

Edge functions:
- **Supabase JWT verification correctly delegated to `supabase.auth.getUser(token)`** (`_shared/supabase.ts:47-61`).
- **Per-endpoint rate-limits keyed on user/key/IP** (`_shared/ratelimit.ts:97-143`).
- **AES-256-GCM at-rest secrets** with fresh 12-byte nonces (`_shared/secrets.ts:70-83`).
- **Production-only check on `SECRETS_MASTER_KEY` format** (`_shared/secrets.ts:49-51`).
- **Body-size cap of 1 MB + `Content-Type: application/json` enforcement** (`_shared/request.ts:3-19`).
- **CORS opt-in allowlist with no wildcard** (`_shared/cors.ts:17-49`).
- **`crypto.randomUUID()` for nonces and request IDs**.
- **Timing-safe comparison** for service-key check in `auth-social-sync`.
- **`requireHostScope` blocks bearer-token access in production**.
- **Cleanup-on-failure in `wallet-bind`** (deletes the binding if nonce rotation fails).
- **Manifest hash deterministic via `stableStringify` + SHA-256** (`_shared/manifest.ts:64-77`).
- **`upsertMiniAppManifest` enforces developer ownership** (`_shared/apps.ts:154-161`).
- **ILIKE wildcards escaped** in `_shared/events.ts:180-181`.

Frontend:
- **Strong main CSP** with nonces, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` for non-miniapp routes (`platform/host-app/middleware.ts:74,82-99`).
- **`X-Frame-Options: DENY`** for non-miniapp routes.
- **Server-side `assertServerOnly()` on Admin SDK** (`platform/sdk/src/admin.ts:55-61`).
- **`productionBrowserSourceMaps: false`** and Sentry `hideSourceMaps: true` (`platform/host-app/next.config.js:126,213`).
- **OAuth callback uses `safeJSON`** to escape `</script>` (`pages/api/oauth/github/callback.ts:114-125`).
- **postMessage handlers check `event.origin` and `event.source`** (`platform/host-app/lib/oauth/store.ts:135-153`).
- **WIF never sent to server** — signing client-side only.
- **`removeConsole` in production** with only `error`/`warn` retained.
- **Edge proxy strips upstream `set-cookie` and `access-control-allow-origin` headers** (`pages/api/edge/[endpoint].ts:161-169`).
- **API errors return generic shape** — no stack traces leaked.

Secrets / supply chain / CI:
- **`.env`, `.env.*`, `.vercel/` correctly gitignored** — `git ls-files` shows no tracked secret-bearing files.
- **Centralized env validator** (`deploy/scripts/validate-miniapp-env.js`) wired as `npm run validate:miniapp-env`.
- **Centralized Supabase env helper** — `getPublicSupabaseEnv()` (browser-safe) vs `getSupabaseEnv()` (server-only).
- **Secret-name allowlist in k8s edge deploy** (`deploy/scripts/apply_edge_secrets_from_env.sh:18-30`).
- **Secret-name denylist for k8s runtime deploy** (`deploy/scripts/apply_k8s_secrets_from_env.sh:18-49`).
- **Scoped CI permissions** (`contents: read`) on both workflows.
- **Secret-presence preflight in live-smoke** writes skip-summary if missing.
- **WIF status messages use `${VAR:+configured}` pattern** — never expose values.
- **Non-root Docker runtime user** in admin console.
- **SHA-pinned base images on nitro service** Dockerfile.
- **`.dockerignore` excludes secrets and `node_modules`**.
- **k8s secrets templates use placeholders only**.
- **Edge functions output dir gitignored**.
- **Service-role-only RLS** on all production migrations (except the dev-only `fix_rls_for_anon.sql`, M-21).
- **No `pull_request_target` triggers**; no self-hosted runners.
- **Lockfile present + integrity-checked**; `npm ci` in CI.
- **Pinned versions via root `overrides` block** (`package.json:55-79`).
- **No postinstall/preinstall/prepare scripts** anywhere.
- **Pickaxe-clean: no service-role JWTs ever committed**.
- **No deleted env files in history** (`git log --all --diff-filter=D -- '**/.env*'` empty).
- **Tracked `gitleaks.toml`** with 9+ rule categories.

---

## 7. Recommended fix order

**Critical / unblock production rollout:**

1. **C-1** `FlashWithdraw` — add per-LP share accounting or admin gate. Until fixed, do not deposit liquidity into any FlashLoan-registered app.
2. **C-2** `FinalizeRound` — lock round creator out, require independent multi-sig or attested match computation, prohibit self-contribution.
3. **C-3** `CancelEscrow` — protect approved-but-unclaimed milestones.
4. **C-4** Add `sandbox="allow-scripts"` to miniapp iframes; serve from a different origin.
5. **C-5** Wrap admin-console pages in real auth; remove auto-injection middleware.
6. **C-6** Rotate the testnet WIF; update `.env` and CI secrets; decide on history rewrite.
7. **C-7** Move secrets to per-user envelope encryption (or KMS) before more secrets accrue.

**High:**

8. **H-4 / H-5** Bind signed message to address in `auth-wallet`; rate-limit `auth-wallet-nonce`; replace hand-rolled JWTs with Supabase Admin Auth.
9. **H-1 / H-2** Tighten miniapp CSP (drop `unsafe-inline`); pin `frame-ancestors` subdomains.
10. **H-3** Make wallet signing explicit, not a side effect of any response shape.
11. **H-6** Edge-side ownership check on automation triggers.
12. **H-7 / H-8** HTTPS-only + hostname allowlist in `_shared/tee.ts`; default-closed rate-limit.
13. **H-9** Route social randomness through Morpheus VRF.
14. **H-10** Commit-reveal for `UnbreakableVault`.
15. **H-11** Replace `[ContractPermission("*", "*")]` with explicit allowlists.
16. **H-12** Remove direct `Resolve{CoinFlip,Gacha}` entry points or enforce `requestId>0` mapping.
17. **H-13** Adopt `PlatformGame`'s timelock pattern for admin transfer and `Update` platform-wide; emit role-change events.

**Medium:** burn down M-1 through M-27 in priority order — start with M-21 (`fix_rls_for_anon.sql` guard), M-22 (action SHA pins), M-12 (developer-ownership checks), M-13 (master-key rotation plan), M-5 (dead bet-count reset).

---

## 8. Methodology and limitations

- **Static analysis only.** No on-chain testing. No live request-replay. No dynamic browser testing.
- **Out of scope:** the platform infrastructure contracts (Governance, PriceFeed, RandomnessLog, AppRegistry, AutomationAnchor, PauseRegistry) — their C# source is not in this repo. Recommend a separate audit cycle against whatever repo owns their source, plus a follow-on audit of the `neo-morpheus-oracle` and `neo-abstract-account` repos which mediate the AA / Oracle / VRF integration.
- **Severity is best-effort given the static view.** A production triage should weight findings by current TVL exposure (FlashLoan pool, capsule balances, NEO staking), the deployed network (mainnet vs testnet), and operational compensating controls (admin-console network ACL, etc.).
- **File-line citations may shift** if the codebase is edited between audit and remediation. Re-verify before fixing.

---

## 9. Appendix — files and surfaces examined

**Smart contracts** (covered by direct review + smart-contract audit agent):
- `MiniApp.DevPack/MiniAppCompactBase.cs`
- `MiniAppEventTicketPass/*.cs`
- `MiniAppMilestoneEscrow/*.cs`
- `MiniAppQuadraticFunding/*.cs`
- `MiniAppSoulboundCertificate/*.cs`
- `platform/PlatformAnchor/*.cs`
- `platform/PlatformDeFi/*.cs`
- `platform/PlatformGame/*.cs`
- `platform/PlatformSocial/*.cs`
- `contracts/__tests__/ContractSecurityRegressionTest.cs`, `FinancialTransferSafetyTest.cs`, `AnchorRewardAccountingInvariantTest.cs`

**Edge functions** (covered by edge function audit agent): all 93 directories under `platform/edge/functions/` sampled with deep reads on auth-wallet, auth-wallet-nonce, secrets-*, gas-sponsor-*, _shared/*.

**Host-app + admin-console + SDK** (covered by frontend audit agent): middleware, CSP/headers, iframe rendering paths, wallet adapters, OAuth, EdgeClient, SDK boundary, admin auth middleware.

**Repo-level** (covered by secrets/supply-chain audit agent + direct review): `.env.example`, `.gitignore`, `.gitleaks.toml`, `.github/workflows/`, `Makefile`, `vercel.json`, deploy scripts under `deploy/scripts/`, supabase migrations, Dockerfiles, npm audit output, git history pickaxe sweeps.
