# Cross-Repo Security & Correctness Audit — 2026-06-16

Comprehensive review/refactor/validate pass across the three repos:
`neo-miniapps-platform`, `neo-morpheus-oracle`, `neo-abstract-account`.

Method: per-domain deep review by independent agents, **every finding adversarially
verified** (2–3 skeptics defaulting to "refute"; kept only on majority confirmation).
False positives were rejected (platform 3, AA 1). Severity reflects the adjusted verdict.

> Contracts are deployed and immutable. Source fixes here take effect **only on redeploy**.
> Mainnet bankrolls/pools are small, which limits live exposure of the game/pool findings.

## Validation baseline (all green)

| Repo | Lint | Tests |
|---|---|---|
| neo-morpheus-oracle | clean (fixed 11 unused-var errors) | worker 250 + relayer 339 + control-plane 31 + ops 86 = **706 pass** |
| neo-miniapps-platform | clean (fixed irregular-whitespace error) | `npm test` pass; C# contracts **185/185** |
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

## Redeploy / operational notes

- The **shared-base** `ReclaimDirectAssetCredit` addition changed the NEF + manifest (hence
  contract hash) of **all 22 `MiniAppBase`-inheriting contracts**. A fleet redeploy would
  re-hash them; if only specific contracts are redeployed, expect source/deployed divergence
  for the others (cosmetic — the added method is additive and safe).
- The Critical/High game fixes (Dice, GasBox, LastSurvivor, BurnLeague) change settlement
  semantics; redeploying requires the frontend to claim winnings via `Withdraw` (pull-payment)
  and is unaffected for the beacon fixes.
- Owner-key custody (NR3E4D8N) and the leaked-key rotation remain separate standing items.
