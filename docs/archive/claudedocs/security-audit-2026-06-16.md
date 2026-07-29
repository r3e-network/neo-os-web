# Cross-Repo Security & Correctness Audit — 2026-06-16

Comprehensive review/refactor/validate pass across the three repos:
`neo-os-web`, `neo-morpheus-oracle`, `neo-abstract-account`.

Method: per-domain deep review by independent agents, **every finding adversarially
verified** (2–3 skeptics defaulting to "refute"; kept only on majority confirmation).
False positives were rejected (platform 3, AA 1). Severity reflects the adjusted verdict.

> Contracts are deployed and immutable. Source fixes here take effect **only on redeploy**.
> Mainnet bankrolls/pools are small, which limits live exposure of the game/pool findings.

## Validation baseline (all green)

| Repo | Lint | Tests |
|---|---|---|
| neo-morpheus-oracle | clean (fixed 11 unused-var errors) | worker 250 + relayer 339 + control-plane 31 + ops 86 = **706 pass** |
| neo-os-web | clean (fixed irregular-whitespace error) | `npm test` pass; C# contracts **185/185** |
| neo-abstract-account | — | C# contracts **115/115** |

(`build:contracts` needed `DOTNET_ROOT` exported — env only, not a code defect; dotnet 10 present.)

---

## A. Platform contracts — 14 confirmed (1 Crit, 7 High, 6 Med) + 17 Low

### FIXED this session (committed, 185/185 throughout)

| # | Sev | Contract | Issue | Fix |
|---|---|---|---|---|
| A1 | **Critical** | MiniAppDiceGameV2 | `Settle` is permissionless + atomic payout and drew the roll from `Runtime.GetRandom()` at settle time, which **re-rolls every block**. A wrapper contract aborts on a loss and retries until a win → bankroll drain. The v2 "commit/reveal across blocks" did NOT close the v1 abort-on-loss class. | Roll now derives from a **fixed beacon** = hash of block `commitIndex+1` (unknown at commit, immutable after). Retrying yields the same roll, so abort-and-retry gains nothing. |
| A2 | High | MiniAppGasBoxV2 | Same re-rollable settle → grind for the jackpot. | Same fixed-beacon fix for the weighted draw. |
| A3 | High | MiniAppLastSurvivor | `Settle` push-transfers the pot to the winner and asserts success → a contract winner that rejects GAS **permanently bricks settle**, stranding the pot and freezing all future rounds. | Pull-payment: credit the winner; they claim via `Withdraw`. |
| A4 | High | PlatformSocial | Deposited NEO direct-credit had **no withdrawal path** (only GAS did) → over-/unused NEO stranded. | Added witness-gated `WithdrawNeoCredit` + `GetDirectNeoCredit`. |
| A5 | High | PlatformGame (Gacha) | Per-pull GAS banked into `machine.Revenue` had **no collection path** → permanently trapped. | Added owner/admin-gated `WithdrawGachaRevenue`. |
| A6 | Med | MiniAppBurnLeague | Same push-payment settle-brick as A3. | Pull-payment (credit + `Withdraw`). |
| A7 | Med→ | MiniAppQuadraticFunding + MiniAppMilestoneEscrow | Stranded direct-asset (NEP-17) credit — no reclaim for unspent/over-deposited amounts (a **shared-base** gap). | Added witness-gated `ReclaimDirectAssetCredit` + `DirectAssetCreditOf` to `MiniAppBase` (fixes all base-credit contracts; rebuilt all inheriting NEFs). |
| A8 | Low | MiniAppSelfLoan | `WithdrawRepayCredit` (GAS) emitted the NEO `CollateralWithdrawn` event. | Added dedicated `RepayCreditWithdrawn` event. |

### REMAINING — documented for follow-up (need design + tests + redeploy)

| # | Sev | Contract | Issue | Recommended fix |
|---|---|---|---|---|
| A9 | High | PlatformDeFi (Capsule) | Capsule "compound yield" is paid in GAS but never funded → draws down GAS belonging to other products (flash-loan LP, lending liquidity). | Require an app-funded yield reserve and assert it covers the compound before payout; or make yield a share of actual fees. |
| A10 | High | PlatformDeFi (Lending/FlashLoan) | All products on one deployed contract share one GAS balance → lending/capsule payouts can strand FlashLoan LP deposits. | Segregate per-product GAS accounting (separate deposit counters); assert product balance covers each disbursement. |
| A11 | High | MiniAppFactory | Artifact-backed templates deploy a single fixed NEF → deterministic-hash collision means only the **first** user can deploy; bricks the "everyone deploys their own token" use case. | Accept per-user NEF/manifest as params (validated against recorded hashes), or vary the deploy salt per user. |
| A12 | Med | PlatformDeFi (Lending) | `CreateLoan` disburses opportunistically with no required-liquidity backing. | Explicit lending liquidity pool; require `netLoan <= pool`. |
| A13 | Med | PlatformGame (Gacha) | NEP-11 prizes non-functional: no deposit path, `OnNEP11Payment` unimplemented → NEP-11 items silently undistributed. | Implement `OnNEP11Payment` escrow, or reject NEP-11 items until supported. |
| A14 | Med | PlatformGame (CoinFlip) | No payout-solvency guard and no timeout refund → underfunded bankroll locks a winning stake. | Mirror Dice: assert bankroll covers `2x` at bet time; add expiry refund. |
| A15 | Med | MiniAppMilestoneEscrow | Approved-but-unclaimed milestone (lost key / malicious beneficiary) freezes the whole escrow, no timeout escape. | Per-milestone approval deadline → creator reclaim after grace. |

Plus **17 Low** (modulo bias on small bounds — negligible/documented; `MiniAppMultisig` single-signer cancel griefing; `BreakupPact` missing expiry check on `SignPact`; QF `FinalizeRound` projectId dedup; PlatformDeFi unique-borrower off-by-one; etc.). The known **SelfLoan owner-can-drain-pool** is the NR3E4D8N custody risk already tracked for key rotation.

---

## B. neo-abstract-account contracts — 14 confirmed (1 Crit, 4 High, 8 Med) + 6 Low

> The AA repo is on branch `security/audit-remediation-2026-06` (owner's active remediation).
> These are **documented, not patched here**, to avoid conflicting with in-flight work on
> safety-critical recovery/auth code. Reviewer-proposed fixes included.

| # | Sev | Unit | Issue | Recommended fix |
|---|---|---|---|---|
| B1 | **Critical** | recovery | `DepositOracleCredits` has no caller auth and no per-account accounting → anyone can drain the contract's pooled GAS to an attacker-controlled oracle. (Real-world impact currently low: the pool appears unfunded.) | Credit GAS per-account in `OnNEP17Payment` (accountId in memo); gate `DepositOracleCredits` on the account owner's witness and spend only that account's balance. |
| B2 | High | UnifiedSmartWallet (Admin) | Core `Update` is instant single-admin-witness — one key can replace authorization logic for **every** account, with no timelock/escape window. | Propose/confirm timelock (≥7d, pinned by nef+manifest hash), mirroring `VerifierAuthority`; route admin to multisig. |
| B3 | High | UnifiedSmartWallet (MarketEscrow) | Market escrow can permanently brick an account with no owner-side exit. | Timelocked owner `CancelMarketEscrow`. |
| B4 | High | hooks (DailyLimitHook) | Only meters the directly-targeted token → bypassed via a router/intermediary or the native NEO/GAS path. | Iterate all configured limits in `PreExecute` (like TokenRestrictedHook M-5); cover native transfers. |
| B5 | High | recovery | Action-session signature lacks account/contract/expiry domain separation → cross-account session replay. | Bind `ExecutingScriptHash`, network, accountId, expiresAt into the action digest (as the recovery digest already does). |
| B6 | Med | UnifiedSmartWallet (VerifyContext) | During a UserOp, `Verify` blanket-authorizes ALL native NEO/GAS transfers from the account → session-key target/method scoping is bypassed for fund movement. | Don't blanket-allow NEO/GAS; bind the authorized asset/amount/recipient into VerifyContext, or have ExecuteUserOp move assets under explicit params. |
| B7 | Med | Paymaster (×3 findings) | Sponsored `reimbursementAmount` is relay-controlled and not bound to actual gas; sponsor deposit drainable at MaxPerOp when budgets unset (0=unlimited). | Bind reimbursement to `Transaction.SystemFee+NetworkFee` (cap by MaxPerOp); make budgets mandatory / allowlist relays. |
| B8 | Med | UnifiedSmartWallet (Escape) | `FinalizeEscape` rotates the verifier but doesn't configure/clear the new verifier's config and leaves a possibly-compromised hook installed. | Accept + atomically configure new verifierParams; clear old config; reset hooks. |
| B9 | Med | verifiers (SessionKey) | Spending limit enforced only for the literal `transfer` method → a wildcard/non-transfer session key has an unenforced (false) limit. | Reject `spendingLimit>0` unless method=="transfer" (fail-closed), or generalize enforcement. |
| B10 | Med | market (AAAddressMarket) | Non-atomic purchase: seller can cancel/reprice after the buyer's GAS is escrowed → locks buyer capital (griefing). | Single-tx settle, or block invalidation of an in-flight deposit. |

Plus **6 Low** (no minimum recovery timelock; post-exec hook runs inside the native-transfer authorization window; rolling daily-budget ~2x burst; single-key market upgrade; recovery relies on one Morpheus ECDSA key).

---

## C. Oracle services + platform OS/host — 15 confirmed (5 High, 10 Med) + 23 Low

### FIXED this session (oracle branch)

| # | Sev | Unit | Issue | Fix |
|---|---|---|---|---|
| C-fix | High | oracle-edge-gateway | Edge `isTrustedAutomationRequest` still accepted the retired `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET` as trusted credentials after the control plane revoked Phala. | Removed both from the trusted-token set (commit on oracle `chore/validation-pass-2026-06-16`). |

### REMAINING — documented (config/infra/design; some surgical)

| # | Sev | Unit | Issue | Recommended fix |
|---|---|---|---|---|
| C1 | High | oracle-enclave-TEE | Attestation is **advisory**: `/oracle/fulfill` returns `trust_tier:'enclave-attested'` without an NSM doc bound to the signed digest; the relayer/contract verify only the signature against the pinned key, never PCRs. Effective trust root = "whoever holds the verifier key", not "a measured enclave". | Fold an attestation doc (`user_data=sha256(digest)`, verifier pubkey) into the fulfill response; relayer/on-chain verifier validates the COSE_Sign1 chain + expected PCR0 before trusting. Derive `trust_tier` from a verified doc, never copy it from the body. |
| C2 | High | oracle-enclave-TEE | `handleProvision` writes any caller-supplied key into `process.env`, and `materialize*FromKms()` no-ops when a plaintext key is already set → host can provision **plaintext** signing keys, bypassing the KMS-attested path, still labeled attested. | Reject plaintext key env vars in-enclave (accept only `*_KMS_CIPHERTEXT_BASE64`), or gate behind an explicit transition flag defaulting OFF in the prod image; expose `key_source` in `/health`+fulfill. |
| C3 | High | oracle-nitro-worker | `/oracle/decrypt` time-lock/binding gating is **opt-in**; default config is a universal decryption oracle if the box token leaks. | Default `MORPHEUS_ORACLE_DECRYPT_REQUIRE_BINDING=true` (require chain+contract+messageId binding + unlock re-assertion). |
| C5 | High | platform-host-app | Paymaster sponsor spend/rate limits in `pages/api/rpc/sponsor.ts` are **in-memory only** → reset per serverless instance, bypassable → GAS drain. | Back the spend ledger + per-user counters with a durable atomic store (Supabase/Upstash). |
| C6 | Med | oracle-relayer | `logger.serializeError()` ships full error message+stack to BetterStack; Neo/Supabase errors can embed credentialed URLs. The on-chain path is scrubbed, the log lane is not. | Apply the `trimOnchainErrorMessage` URL/secret redaction to the structured-log path. |
| C7 | Med | oracle-web-api | Operation-log redaction matches only leaf key names; raw-string/`raw_body` payloads bypass it → persisted cleartext to Supabase + BetterStack. | Redact by value-shape too (treat raw-string/raw_body as opaque/hashed). |
| C8 | Med | platform-edge | `auth-social-sync` merges social identity into an existing account by email with no provider-verified-email guarantee → **account takeover**. | Require explicit `email_verified=true` for email-based merge; else create a separate account. |
| C9 | Med | platform-edge | `os-storage-grant-access` returns `granted:true` unconditionally with no persistence/enforcement → broken access control / false trust. | Persist grants + enforce in `os-storage-read-shared`, or remove the stub until implemented. |
| C10 | Med | oracle-edge / nitro-worker | Confidential decrypt/reveal passthrough has no edge rate limiting; rate limiting **fails open** when no backend configured; NeoDID `provider_uid` forgeable (default-allow) for non-web3auth providers; bootstrap `/provision` unauthenticated. | Add a `confidential` route limit; fail-closed when a configured limit has no backend; require in-enclave credential verification; image-pinned bootstrap token. |

Plus **23 Low** (host-app `invoke`/read bridge consent granularity + identity leakage to embedded origins; SDK `targetOrigin "*"` fallback for opaque iframes; relayer idempotency-off-during-backoff double-delivery window; non-constant-time cron secret; client-controllable rate-limit IP headers; signMessage message/echo mismatch; etc.). Several reconfirm items from the 2026-06-15 exec-edge audit (attestation/keying are transition gaps).

> Net: oracle service **tests are green (706)** and the hardening from prior audits holds; the
> services findings are mostly **trust-model enforcement** (make attestation/keying mandatory),
> **fail-closed defaults** (decrypt binding, rate limiting), **durable limits** (paymaster), and
> **log/edge redaction** — not new fund-loss bugs. The one revoked-credential gap (Phala) is fixed.

---

## Remediation update — round 2 (all confirmed contract findings fixed)

After the initial report, the remaining findings were remediated. Each fix has regression
tests and was validated against the full suites (platform contracts **196/196**, AA **156/156**,
oracle relayer **339/339**).

**AA — ALL 14 fixed** (commit `919b570`, neo-abstract-account `security/audit-remediation-2026-06`):
B1 Crit (per-account oracle-credit accounting + owner gate), B2/B3/B4/B5 High (Update timelock;
market-escrow owner force-cancel; DailyLimitHook all-token metering; action-session domain
separation), B6–B10 Med (native-transfer scoping; paymaster reimbursement cap + mandatory
budgets; FinalizeEscape verifier/hook reset; SessionKey fail-closed; market in-flight-deposit
lock) + the recovery min-timelock Low.

**Platform — A9–A15 + Lows fixed** (commits `0be6c55a8`, `40cdaa3ce`):
A9/A10/A12 High/Med (per-product GAS segregation in PlatformDeFi), A11 High (factory
per-user-NEF deploy, no hash collision + digest verify), A13 Med (gacha NEP-11 fail-closed),
A14 Med (coinflip solvency guard + permissionless expiry refund), A15 Med (milestone
grace-period reclaim), QF duplicate-projectId Low, breakup expired-pact Low.

**Services — fixed** (oracle commits `a7ab546`, `80c5e90`; platform `d353ed742`):
edge Phala-token revoke (High), relayer log credential-redaction (Med), auth-social-sync
verified-email merge gate (Med, account-takeover).

**Intentionally NOT changed (documented decision):**
- MiniAppMultisig any-signer cancel (Low): this is a deliberate prior fix (MP-D-04) to avoid
  creator-only-cancel deadlock when a key is lost. Restricting it would re-introduce that
  deadlock; the residual "griefing" requires an already-trusted vault signer. Left as-is.

**Remaining services items — need infra/design/coordination (not safe one-line fixes):**
- C1 (attestation advisory): make attestation enforcing requires an on-chain/relayer COSE_Sign1
  + PCR verifier on the fulfillment path — an architecture change.
- C2 (host can provision plaintext keys): gate behind an image-pinned transition flag / reject
  plaintext key env vars in the prod enclave image.
- C3 (decrypt-binding default): defaulting `MORPHEUS_ORACLE_DECRYPT_REQUIRE_BINDING=true` must
  be paired with the relayer sending chain+contract+messageId binding fields, else it breaks the
  live `{envelope}`-only decrypt lane (the in-TEE recipient-sig + time-lock gates still apply).
- C5 (paymaster in-memory limits): needs a durable shared store (Supabase/Upstash atomic counter).
- C9 (os-storage-grant returns true): needs a grants table that `os-storage-read-shared` enforces.
- C10 (edge rate-limit fails open): flip to fail-closed when a configured limit has no backend.
- The ~20 services Lows (constant-time cron compare, IP-header rate-limit keying, bridge consent
  granularity, etc.) are tracked here for a follow-up hardening pass.

## Remediation update — round 3 (services hardening + merged to main/master)

All fix branches were fast-forward **merged into main/master and pushed** (platform `→ acbb4fe8d`+,
oracle `→ 21426c0`, AA `→ 919b570`). Additional services hardening landed:

**Oracle (commit `21426c0`, validated lint + worker 252 / relayer 339 / control-plane 31 / ops 91):**
- enclave-server (C2 High): reject host-provisioned plaintext signing keys unless an explicit
  `MORPHEUS_ALLOW_PLAINTEXT_KEY_PROVISION` opt-in (default off); accept only `*_KMS_CIPHERTEXT`;
  expose `key_source` in `/health`; image-pinned bootstrap-token gate on first `/provision`;
  exact/prefix route matching (no `endsWith` spoofing).
- edge gateway (C10 Med): rate-limit **fails closed** when a configured limit has no backend;
  dedicated limit on the confidential decrypt/reveal passthrough; no origin-hostname leak in
  errors; feed-symbol whitelisted before path interpolation.
- web-api (Med/Low): operation-log value-shape redaction (apps/web vitest 5/5); constant-time
  cron-secret compare; automation-execute rejects raw signer material.
- nitro-worker (Med/Low): default-deny unverified NeoDID providers; reject caller-supplied raw
  keys on enclave-signing lanes; separate trusted-service rate-limit bypass credential.

**Platform (commits `acbb4fe8d`, `01a39ea3a`):**
- sdk (Low): bridge `postMessage` fails closed when the target origin can't be derived (no `'*'`
  broadcast); `messageVerified` flag so an un-echoed signed message isn't presented as verified;
  intent recipient(Hash160)/amount(Integer) sanity checks before signing. (SDK vitest 32/32)
- edge (Med/Low): secrets-get returns a generic decrypt error (detail server-side only);
  auth-wallet consumes the login nonce atomically (conditional update) closing the replay race.

## STILL OPEN — need infra / architecture / coordination / real-env testing (documented, not patched)

These are intentionally NOT patched blind because each needs a deployment-side change or a live
environment to validate safely:
- **C5 (High) paymaster durable spend limits** (`platform/host-app/pages/api/rpc/sponsor.ts`):
  in-memory counters must move to a durable atomic store. Fix = a `sponsor_spend` table + a
  Postgres atomic-increment RPC (`INSERT … ON CONFLICT DO UPDATE SET spent = spent + delta
  RETURNING spent`), checked against `MAX_GAS_PER_DAY` / per-user-hour; the host-app already has
  `supabaseServiceClient`. Needs a migration + DB-backed test; shipping it unvalidated risks the
  live GAS-sponsorship path.
- **C1 (High) attestation is advisory**: make it enforcing — relayer/on-chain verifier validates a
  COSE_Sign1 attestation bound to `sha256(fulfillment_digest)` + expected PCR0 before trusting a
  result. Architecture change on the fulfillment path.
- **C3 (High) decrypt-binding default**: defaulting `MORPHEUS_ORACLE_DECRYPT_REQUIRE_BINDING=true`
  must be paired with the relayer sending chain+contract+messageId binding, else it breaks the live
  `{envelope}`-only decrypt lane (in-TEE recipient-sig + time-lock still gate it).
- **C2-residual / C9 (Med)**: os-storage grant enforcement needs a grants table + read-side check
  (low impact — the "shared" data is public on-chain kernel state, so the unenforced grant is
  false-trust, not data exposure).
- **neo-sig (Low)**: `_shared/neo.ts` verifies `sha256(message)` while NEP-dapi wallets sign a
  salted/parameterized payload — reconcile the exact format + test against real wallets (changing
  it blind risks breaking login).
- **host-app bridge Lows**: gate wallet identity/balance reads behind per-app consent; show invoke
  args + full signMessage text in the approval prompt; don't reflect ACAO `null` with credentials.
- **Relayer trust-model Lows**: flag-off topology holds the verifier key in process memory;
  classifyError substring matching; idempotency-during-Supabase-backoff window; enclave digest
  cross-check doesn't verify the signature against the expected verifier key.

## Remediation update — round 4 (the "hard" remaining items)

- **C1 (High) attestation now ENFORCING** (oracle `d8ee729`): the enclave folds an attestation
  doc bound to `sha256(fulfillment_digest)` + verifier pubkey into `/oracle/fulfill`; the relayer
  `verifyEnclaveAttestation()` parses the COSE_Sign1, **hard-fails on a wrong-digest binding**,
  asserts the pinned PCR0 (`MORPHEUS_EXPECTED_PCR0` / `config.nitro.expectedPcr0`), and derives
  `trust_tier` from the verified doc — downgrading to host-unattested when absent/unpinned
  (backward-compatible: still submits). Plus opt-in enclave-signature verification against the
  on-chain-pinned verifier pubkey. Relayer 353 / worker 253 / ops 93 green.
- **C3 (High) decrypt-binding coordinated** (`d8ee729`): the relayer now sends chain+message_id+
  contract to `/oracle/decrypt`, **`neox.js` preserves the on-chain messageId** (was decoded then
  discarded — this was the gap that would have broken the live neox lane), and the worker requires
  binding by default.
- **Idempotency fail-closed** (`d8ee729`): no local claim during Supabase backoff, in both
  `queue.js` and `config.js` (was defaulting open); explicit opt-in for single-instance. Plus
  `classifyError` word-boundary matching (don't finalize a recoverable failure as permanent).
- **C9 (Med) storage grants enforced** (platform `1bbb785f6`): new `miniapp_storage_grants` table +
  `recordStorageGrant`/`hasStorageGrant`; `os-storage-read-shared` now denies reads without a
  matching owner/prefix grant (was unconditionally `granted:true`).
- **host-app bridge read-consent** (`1bbb785f6`): wallet identity/balance reads now require a
  one-time per-origin consent (persisted); opaque/un-consented cross-origin embeds are denied.

### Findings that turned out NOT to apply in this repo (verified by reading the code)
- **C5 (paymaster durable limits)**: `platform/host-app/pages/api/rpc/sponsor.ts` and all the
  `MAX_GAS`/`dailyGasSpent`/`userTxCounts` logic the review cited **do not exist in this repo** —
  the only rpc routes are thin edge proxies. The sponsor/paymaster code lives in a different
  app/repo; the durable-store fix belongs there. (No fabricated endpoint was added.)
- **host-app invoke-prompt truncation + ACAO `null` reflection**: no such code here — the bridge is
  `lib/bridge/handler.ts` (send/call stubbed) and `pages/api/rpc/[fn].ts` sets no CORS headers.

### Genuinely deferred (1 item) — needs a coordinated change + real-wallet testing
- **neo-sig (Low)**: `platform/edge/functions/_shared/neo.ts` verifies `sha256(message)` while
  NEP-dapi wallets sign a salted/parameterized payload. The current login flow works because both
  the signing adapter AND the verifier use the raw form; changing only the verifier would break
  logins. The correct fix is a coordinated adapter+verifier change to the NEP-dapi salted format,
  validated against real wallets — out of scope for an isolated code edit.
- The **flag-off relayer trust-root** (verifier key in process memory) is the pre-cutover topology
  by design; the **enclave-fulfill cutover path is now the hardened, attestation-enforcing one**
  (C1 above). Flipping `MORPHEUS_RELAYER_ENCLAVE_FULFILL` on (with PCR0 pinned) is the operational
  step that retires the in-memory-key path.

## Redeploy / operational notes

- The **shared-base** `ReclaimDirectAssetCredit` addition changed the NEF + manifest (hence
  contract hash) of **all 22 `MiniAppBase`-inheriting contracts**. A fleet redeploy would
  re-hash them; if only specific contracts are redeployed, expect source/deployed divergence
  for the others (cosmetic — the added method is additive and safe).
- The Critical/High game fixes (Dice, GasBox, LastSurvivor, BurnLeague) change settlement
  semantics; redeploying requires the frontend to claim winnings via `Withdraw` (pull-payment)
  and is unaffected for the beacon fixes.
- Owner-key custody (NR3E4D8N) and the leaked-key rotation remain separate standing items.

## Phala retirement (2026-06-17)

The production runtime is fully AWS Nitro; the Phala TEE runtime is decommissioned. Code-level
Phala retirement across all three repos:

- **Platform** (`5d1a1aad8`): `host-app/lib/morpheus-endpoints.ts resolveMorpheusRuntimeToken`
  and `edge/functions/_shared/tee.ts` no longer accept `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`
  fallbacks; `host-app/lib/morpheus-neodid.ts` stops emitting the legacy `x-phala-token` header
  (Bearer + `x-nitro-token` remain). Tests updated to assert retired Phala creds are ignored and
  the legacy header is no longer sent (host-app jest 115 suites / 550 tests green).
- **Oracle** (`a49f669`): the relayer `nitro.js` no longer emits the dead `x-phala-token` header.
  Verified the live Nitro worker (`nitro-worker/src/platform/auth.js`, `request-guards.js`)
  authorizes via `Bearer` / `x-nitro-token` only and intentionally dropped Phala tokens, so the
  emission was inert. (worker 253 / relayer 365 green.)
- **AA** (already landed + guarded): production relay/proxy code is Phala-free, locked in by
  `frontend/tests/apiSecurity.test.js` (asserts no `phala-remote` / `x-phala-token` / `PHALA_` /
  `resolvePhalaCliCommand` in source) and `morpheusApiProxy.test.js`.

### Deferred (load-bearing or inert — not defects, need operator coordination)

1. **Oracle key-material env-name aliases.** `workers/morpheus-relayer/src/lib/neo-signers.js`,
   `nitro-signer.js`, `config.js`, and `scripts/render-nitro-env.mjs` still read/emit `PHALA_*`
   names for signer keys (e.g. `PHALA_ORACLE_VERIFIER_WIF_*`, `PHALA_NEO_N3_WIF`). These name the
   **live** Nitro enclave/relayer deployment env. `MORPHEUS_RUNTIME_TOKEN` is already the primary
   token, so auth is Nitro-first; only the signer-key variable *names* remain legacy. Fully
   excising them requires atomically re-rendering and redeploying the live env (AWS SSM), which
   needs operator credentials — doing it code-only would cause a signing/auth outage.
2. **AA legacy live-validation tooling.** `sdk/js/tests/phala-cli.js` plus the
   `testnet:validate:*` suites use `phala cp` / `phala ssh` to provision a Phala CVM. This is
   **inert at runtime** today: with no `phala` binary present, `resolvePhalaCliCommand` returns
   null and every Phala branch is guarded and skipped. These are manual scripts (not in `npm
   test`); rewriting them carries regression risk for no functional gain.
3. **Historical reports.** `docs/reports/*.json` and `claudedocs/*.json` reference Phala as
   immutable audit artifacts of past runs.

## Round 9 — end-to-end dataflow + attack + misuse validation (2026-06-17)

Systematic validation of all major flows across the three repos.

### Phase A — executable validation
All offline/gated suites pass: platform root `npm test` (deploy-scripts + host-app 977 + admin-console + shared 1523 + 16/16 miniapp suites) and contracts 211; AA contracts 164 / frontend 369 / sdk 76; oracle worker 253+ / relayer 378 / ops 93 / control-plane 31.

The live-testnet `test:integration` reports 7 failures — **all the deployed-vs-committed drift this campaign created** (e.g. `MiniAppBreakupPact.getOwner` method-not-found from the round-7 upgradability additions; `CoinFlip.getGame` / `daily-checkin.checkIn` missing on the old deployed contracts; a pre-existing `dice-game → MiniAppDiceGameV2 vs PlatformGame` binding). These are **not regressions** — the integration suite is correctly detecting that the contract fixes + upgradability **need a redeploy**, and they resolve once deployed.

### Phase B — fixed (all pushed)
- **QF match-sweep strand (regression in the round-6 QF reclaim fix)** — `ReclaimUnclaimedMatch` set the shared `Claimed` flag, locking out contributors who had not yet reclaimed. Split into a `MatchClaimed` flag; contributors can always reclaim their own ledger.
- **neo-treasury stale price shown as live (HIGH misuse)** — consumer now reads `getPriceWithMeta` + enforces a 1h on-chain staleness window (null/dash or amber-stale); corrected the false "signed on-chain" comment.
- **AA relay fee drain (HIGH/MED)** — added network-fee + total-fee caps enforced before signing, fail-closed when sponsoring without a ceiling, and bound the paymaster approval to the operation_hash + approved max.
- **Wildcard session-key uncapped (MED misuse)** — `SessionKeyGranted{uncapped}` event + a distinct value-UNCAPPED warning in the grant UI.
- **Automation idempotency (HIGH robustness)** — durable atomic claim pins execution_count + last_queued_request_id so a crash/second-instance cannot double-execute.
- **GasBoxV2 doc (LOW honesty)** — corrected stale `Runtime.GetRandom()` doc to describe the fixed beacon the code actually uses.

### Deferred (need a product/ops decision or a larger change — tracked, not silently dropped)
- **[2] Price feed is single-source** — only `twelvedata` is configured, so the multi-source aggregation never runs on the value the consumer reads. Operational fix: configure ≥2 providers (and write the aggregated value as the consumed record).
- **[3] Sponsored-fee drain** — anyone can spam requests against a fee-sponsoring app to drain its MorpheusOracle fee credit. Needs an optional per-app requester allowlist / rate-cap so a sponsor can bound exposure.
- **[6] Single-block beacon grinding** — a colluding block producer can withhold/influence the single beacon block for the V2 games. Route high-stakes bets through the Morpheus VRF (the single-block beacon is acceptable only for low `MAX_BET`).
- **[8] On-chain Paymaster budget unreachable via relay** — `executeSponsored*` is not allowlisted in the relay, so the on-chain `CapReimbursement`/`MaxPerOp`/`DailyBudget` budget never applies; gasless sponsorship relies on off-chain trust plus the new fee caps until sponsored relays are routed through `executeSponsoredUserOp`.

### Remaining LOW / INFO (design-acknowledged or minor)
- **LOW / correctness** — Oracle PRICE FEED dataflow: Swap staleness gate is bypassed when the feed returns a zero-record (recordTimestamp=0 treated as fresh)
- **LOW / misuse** — Oracle REQUEST -> FULFILL dataflow with attestat: Expiry writes no inbox item, so inbox-only consumers can never observe a TTL-expired (refunded) request
- **LOW / misuse** — Oracle REQUEST -> FULFILL dataflow with attestat: Example consumer (OracleCallbackConsumer / UserConsumerN3) accepts any kernel callback requestId without verifying it issued that request
- **LOW / misuse** — Oracle CONFIDENTIAL decrypt + AUTOMATION dataflo: Cancel-after-claim consumes the user's request fee for a no-op execution with no refund or pre-cancel warning
- **LOW / misuse** — Platform miniapp MONEY flow: ChainService.invoke reports success on relay (txid) even when the act transaction FAULTs / the confirming event never appears
- **LOW / dataflow-gap** — Platform miniapp MONEY flow: BreakupPact SettlePact pushes GAS to both parties with no pull fallback (settle can be bricked / stake stranded if a party rejects GAS)
- **LOW / correctness** — Platform GAME randomness/settlement flow: GasBoxV2 class documentation describes Runtime.GetRandom() at settle but the code uses a fixed-block beacon
- **LOW / dataflow-gap** — Bridge and OS edge dataflow: OS storage write intent faults for users, kernel needs app-admin witness
- **LOW / misuse** — Bridge and OS edge dataflow: app_id from body unbound to session
- **LOW / misuse** — AA UserOp EXECUTE flow: SDK simulateUserOperation reports passed=true WITHOUT verifying the signature (optimistic preview)
- **LOW / misuse** — AA UserOp EXECUTE flow: Deprecated buildEIP712PayloadForWeb3AuthVerifier argsHash fallback diverges from on-chain serialization (fails closed)
- **INFO / misuse** — AA UserOp EXECUTE flow: SDK autoDeadline default (1h) and far-future deadlines only bounded by an advisory warning
- **LOW / dataflow-gap** — AA RECOVERY/ESCAPE + SESSION-KEY + MARKET-ESCROW: Owner force-cancel of a stuck escrow leaves the market listing in a permanently-unsettleable zombie state while a buyer's GAS is still locked
- **LOW / dataflow-gap** — AA RECOVERY/ESCAPE + SESSION-KEY + MARKET-ESCROW: SettleMarketEscrow/FinalizeEscape do not clear stale pending-module-call and escape-cooldown markers handed to the new owner
- **LOW / misuse** — AA RECOVERY/ESCAPE + SESSION-KEY + MARKET-ESCROW: Recovery request path lets an attacker-chosen newOwner/executor spam oracle requests and unbounded storage writes (no rate limit / bond)

## Round 10 — "fix everything": deferred items + lows fixed (2026-06-17)

Fixed and pushed across all three repos (then adversarially re-verified, which caught two
self-inflicted regressions — both fixed):

**Fixed:** C3 oracle opt-in per-app sponsorship allowlist/cap; L1 expiry inbox item; C1+C2
datafeed on-chain signature verification + canonical aggregate record; L2 example consumers
track issued requestIds; L3 automation-cancel surfaces the in-flight execution; L12 market
zombie listing + L13 clean-shell markers; C8 relay allowlist for executeSponsored*; L9/L10 SDK
simulate-signature flag + deprecated argsHash throws; L5 BreakupPact pull-payment; C6 V2 games
mix K=3-block entropy + validator caveat; L0/C2-consumer/L4 feed-staleness + AGG-pair +
ChainService.verified.

**Adversarial re-verify caught + fixed 2 regressions this batch introduced:**
- The C1 datafeed fix was caller-opt-in (an unsigned write still anchored an arbitrary price
  even with a key registered). Now signatures are **mandatory** once a key is registered, the
  worker signs the canonical message and submits via `updateFeedSigned`, and providers are
  de-duplicated. Inert until an admin registers the key.
- The L12 market fix let `abandonListing` cancel any listing on the shared core. Now
  `EnterMarketEscrow` requires the caller to be the market and `AbandonListing` is bound to the
  account.

### Genuinely deferred — by-design or operator/deployment-only (not source-fixable here)
- **C1/C2 activation**: an admin must register the on-chain verification key (and provision the
  matching `oracle_verifier` signing key in the worker) and configure ≥2 providers with consumers
  reading the `AGG:<pair>` record. Validate on testnet before registering the key on mainnet — a
  worker/contract canonical-message mismatch would reject feed writes (the contract verifies the
  exact `symbol|price|timestamp|round` bytes the worker now signs).
- **C8 full on-chain budget**: the relay now allows `executeSponsored*`, but the frontend must
  BUILD sponsored ops (`createSponsoredUserOpPayload`) for the on-chain `MaxPerOp`/`DailyBudget`
  to actually apply; the off-chain fee caps bound exposure meanwhile.
- **L7** OS shared-storage writes require the app admin/updater witness — intended access control.
- **L8** `app_id` is taken from the request body — bounded by the caller signature + the kernel
  witness; round-6 (C9) closed the storage-grant boundary. A full session↔app_id binding is a
  larger auth change.
- **L11** the SDK `autoDeadline` allows far-future deadlines — by design; a long deadline does not
  enable replay (the nonce is one-shot).
- **L14** the recovery request path allows attacker-chosen `newOwner`/`executor` to generate
  oracle-side work — bounded griefing (the attacker bears their own GAS cost, no privileged effect,
  cannot arm a recovery without a valid Morpheus signature).
- **Operator**: rotate the shared `NR3E4D8N` deployer/owner key to a cold/multisig before any
  redeploy of the upgradable contracts; all contract fixes need a redeploy to take effect on-chain.
