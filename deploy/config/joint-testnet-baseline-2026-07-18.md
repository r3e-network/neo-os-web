# Joint Testnet Baseline — 2026-07-18

Three-repo joint verification record (neo-miniapps-platform × neo-morpheus-oracle × neo-abstract-account). Operator signer: `NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu` (hash `0x13ef519c362973f9a34648a9eac5b71250b2a80a`), well-funded (73,061 NEO / ~112.5k GAS). Network: neo-n3-testnet (magic 894710606), RPC `https://testnet1.neo.coz.io:443`.

## Deployed / live contracts (operator-controlled)

| Contract | Hash | Notes |
|---|---|---|
| PlatformRegistry | `0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b` | deployed 2026-07-17; admin = operator; two 24h timelocks (AppAccount artifact + platform-game engine row) matured 2026-07-18T10:48:51Z |
| PlatformGame v2 | `0xc75b181b4561462903bb27d8d9e0b32b637bec12` | multi-tenant engine (gameType 1-5); oracle repointed to private kernel 2026-07-18 |
| Private MorpheusOracle kernel | `0x2e67d3a62d0020675fd7ba0fa0611fe4d3767a35` | deployed 2026-07-18 (tx `0x8ff03718…4ac6df`); OR-D-03-fixed source, 70-method ABI; admin=updater=verifier=operator; game.session module registered; report `deploy/config/private-kernel-testnet-2026-07-17.json` |
| AA core (smoke deploy) | `0x0c6a9a3213e727516280cade234d17ee6afad734` | fresh validation instance (canonical testnet core remains `0xdbf38e7b…b6f2`) |
| Web3AuthVerifier (smoke) | `0x1fc2bacb82e5358889b3e0bd67264b5dd0382f91` | validation instance |
| WhitelistHook (smoke) | `0x6e133019feb22300f9bf63049376da6d10f7b8e3` | validation instance |

## Canonical vs retired (cross-repo registry state)

- Morpheus kernel: canonical testnet = `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` (64-method, on-chain verified); legacy v1 `0x4b882e94…` retired (31-method, updatecounter 8). All three repos' generated registries/catalogs regenerated to canonical; all drift tests green.
- Miniapps game lane additionally runs on the private kernel `0x2e67d3a6…` (operator-controlled; the shared kernel `0xf54d85…` is morpheus-operator-administered and lacks the 8-arg onMiniAppResult dispatch on-chain).
- PlatformAnchor testnet: working canonical = `0xab079b4f9a0a2471d136392e25eb8e99898dcad0` (bound by 5 app manifests); `0xeb6b3725…` is a newer unbound build (Phase 5 decision).

## On-chain verification executed (operator WIF)

- **AA validation suite** (dry-run + live smoke): 3 contract deploys, native+EVM account registration, ExecuteUserOp (native + EVM-signed), hook whitelist gating, timelocked maintenance, escape flow. 2 paymaster stages env-gated (morpheus operator tokens absent).
- **RewardGame settle loop ×4** (`live_validate_rewardgame_settle.mjs`): registerGame → fund → entry → startGame → finalizeGame → private-kernel fulfill (operator verifier signature) → rich-dispatch settle → withdraw. Winner credit 0.1 GAS, status 2, pool/liability identities exact.
- **7 live-chain harnesses** (all 77 apps now covered, `missingLiveChainHarness: []`):
  - `live_validate_oracle_price_console.mjs` (read-only: DataFeed pairs/records/prefixes; live prices NEO 1.944 / GAS 1.0224 / ETH 2097.23)
  - `live_validate_miniapp_factory.mjs` (read-only: template registry; covers all 3 factory apps)
  - `live_validate_timestamp_proof.mjs` (write: anchor memo verified in confirmed tx script)
  - `live_validate_neo_treasury.mjs` (write: disburse + NEP-17 index reconciliation + script memo)
  - `live_validate_neo_multisig.mjs` (write: full multisig lifecycle; event-id extraction)
  - + existing fleet harnesses (all previously live)
- **Cohort-0 dry-run**: all 77 appIds valid, 0 registered, 77 planned, 0 failures (`deploy/config/cohort0-registration-testnet-2026-07-18.json`).

## Pending (this record to be appended by the 19:05 CST execution)

- [ ] execute-timelocks (AppAccount artifact + platform-game engine row)
- [ ] wire-engine (setRegistry on PlatformGame, read-back)
- [ ] full-loop (first registry-minted AppAccount, engine activation, descriptor, pool funding)
- [ ] cohort-0 lite registration ×77
- [ ] deployment record finalization

## Local verification matrix (all green 2026-07-18)

- miniapps: contracts 576/576, shared 4424/4424, framework 553/553, deploy-scripts 209/209, host-app 1134/1134, edge 151/151, e2e 26/26, Go suites PASS, verify:repo exit 0
- AA: contracts 210/210, frontend 415/415, sdk 78/78, browser smoke ✓
- morpheus: contracts 58/58, worker 464/464, relayer 437/437, shared 95/95, web 190/190
- a11y (axe WCAG 2.1 A/AA): miniapps 0/77, AA frontend 0, morpheus web 0, admin-console 0

## Audit/fix record

See `docs/reports/joint-audit-2026-07.md` (41 findings: 6 high + 11 medium fixed with TDD; 11 low fixed/pinned; rest documented) and `docs/reports/joint-baseline-2026-07-18.md`.
