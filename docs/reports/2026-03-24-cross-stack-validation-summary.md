# Cross-Stack Validation Summary

Date: 2026-03-24

## Scope

This summary consolidates the latest validation state across:

- `neo-morpheus-oracle`
- `neo-abstract-account`
- `neo-miniapps-platform`

It covers:

- Oracle local and live testnet validation
- Oracle runtime stress and protection tuning
- AA local, frontend, and testnet contract/business validation
- Miniapps full-stack, flagship, selected-beta, remaining-beta, and governance live validation

## Oracle

### Local validation

Passed:

- `test:worker`
- `test:relayer`
- `check:worker`
- `check:relayer`
- `test:control-plane`
- `build:web`

### Live/service validation

Passed:

- `verify:edge-gateway`
- `smoke:control-plane`
- `once:relayer`
- `smoke:n3`
- `verify:n3`
- `check:phala-env`
- `check:signers`

### Stress and stability

Validated:

- `oracle_query`
- `oracle_smart_fetch`
- `compute_builtin`

Key findings:

- `oracle_query`
  - lossless concurrency: `4`
  - latency-friendly concurrency: `2`
- `oracle_smart_fetch`
  - effective safe concurrency: `1`
  - bottleneck is runtime script timeout, not edge or queue saturation
- `compute_builtin`
  - lossless concurrency: `4`

Applied follow-up:

- testnet signer resolution stabilized
- rendered signer config now validates green
- testnet defaults should converge on:
  - `MORPHEUS_MAX_INFLIGHT_ORACLE_QUERY=4`
  - `MORPHEUS_MAX_INFLIGHT_ORACLE_SMART_FETCH=1`
  - `MORPHEUS_MAX_INFLIGHT_COMPUTE_EXECUTE=4`

## Abstract Account

### Local validation

Passed:

- `sdk/js test`
- `frontend test`
- `frontend build`
- `scripts/verify_repo.sh`

### Testnet validation

Passed:

- `v3_testnet_smoke.js`
- `v3_testnet_plugin_matrix.js`
- `v3_testnet_paymaster_policy.mjs`
- `v3_testnet_paymaster_relay.mjs`
- `v3_testnet_market_escrow.js`

Confirmed:

- native and Web3Auth `executeUserOp`
- verifier matrix:
  - Web3Auth
  - TEE
  - WebAuthn
  - SessionKey
  - MultiSig
  - Subscription
- hook matrix:
  - Whitelist
  - DailyLimit
  - TokenRestricted
  - MultiHook
  - NeoDIDCredentialHook
- rejection matrix:
  - tamper
  - replay
  - wrong target
  - over amount
  - restricted token
  - daily overflow
- paymaster policy denial cases
- paymaster relay happy path
- address market escrow transfer

Critical business rule confirmed on-chain:

- after address resale:
  - `verifierAfterSale = 0x0000000000000000000000000000000000000000`
  - `hookAfterSale = 0x0000000000000000000000000000000000000000`

### Frontend browser regression

Added and passed:

- browser smoke for:
  - `/`
  - `/app`
  - `/market`
  - `/docs`

Browser smoke also exposed and validated a real production-route fix in `AbstractAccountTool.vue`.

## Miniapps Platform

### Local/platform validation

Passed:

- `test:host-app`
- `host-app build`
- `test:admin-console`
- `admin-console build`
- `verify_testnet_workflows.sh`

Platform workflow coverage confirmed:

- pricefeed availability
- governance workflow
- stats rollup RPC compatibility

### Cross-repo validation

Passed:

- `verify_cross_repo_testnet.sh`
- `run_full_stack_testnet_validation.sh`

### Flagship miniapps

Passed real testnet live flows:

- `daily-checkin`
- `last-survivor`
- `gasbox`
- `fogplay`
- `red-envelope`
- `self-loan`
- `neo-pay`

### Selected beta miniapps

Passed real testnet live flows:

- `flashloan`
- `exfiles`
- `masqueradedao`
- `millionpiecemap`
- `graveyard`
- `heritagetrust`
- `dicegame`
- `gascircle`
- `turtlematch`

### Remaining beta miniapps

Part 1:

- `breakup`
- `burnleague`
- `devtipping`
- `tarot`
- `vault`

Part 2:

- `eventticket`
- `gassponsor`
- `memorial`
- `milestone`
- `soulbound`
- `trustanchor`

Part 3:

- `govmerc`
- `quadratic`
- `timecapsule`

### Governance miniapp

Passed:

- `live_validate_council_governance.js`

### Validation-tooling improvements

Applied:

- shared live Neo helper extraction
- deploy-script regression tests
- obsolete archived live target removal
- noisy manifest warning suppression
- live smoke log noise reduction for expected pending-log polling

## Current Residual Gaps

The main active apps not covered by testnet contract live-smoke are mostly:

- front-end-only tools
- AA/oracle lab consoles
- mainnet-oriented wrappers
- third-party protocol entry points without owned testnet contracts

That means the remaining gap is mostly integration/UI breadth, not owned testnet contract business logic.

## Overall Assessment

Current state is green at the levels that matter most:

- Oracle:
  - local code
  - deployed testnet service path
  - signer/config consistency
  - runtime stress characterization
- AA:
  - local SDK/frontend
  - testnet business flows
  - paymaster
  - escrow resale reset invariant
  - browser smoke
- Miniapps:
  - platform local gates
  - cross-repo integration
  - flagship live flows
  - selected and remaining beta live flows
  - governance live flow

The dominant remaining work is continuous hardening:

- richer browser E2E breadth
- external-wrapper app validation
- translating Oracle stress guidance into enforced production/testnet defaults everywhere they are rendered
