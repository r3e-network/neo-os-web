# Joint Phase 0 Baseline — 2026-07-18

Baseline test results across the three repos, plus repo hygiene outcomes. Input to Phase 1 audit and Phase 7 final verification. Suites run against current working trees (no branch switches, no git mutations).

## Working-tree states

| Repo | Branch | Dirty files | Notes |
|---|---|---|---|
| neo-os-web | (main line) | ~70 modified + untracked v2 WIP (RewardGame partials, MiniAppEngineBase.cs, registry/platform-game surfaces, RealKernel test files) | mid-refactor, expected |
| neo-morpheus-oracle | `chore/solc-0.8.35-upgrade` | 71 dirty incl. uncommitted `config/networks/testnet.json` oracle-hash change | side branch, expected |
| neo-abstract-account | HEAD `f2d3b17` | 24 dirty + 2 untracked (`scripts/dotnet_env.sh`, `shared/registrationAccountId.mjs`) | fresh-clone breakage, see below |

## Hygiene outcomes (Task 1)

- **AA repo: 18 newline-junk directories deleted** (verified 0 were git-tracked before `rm -rf`). Working tree now shows only legitimate changes.
- **AA fresh-clone breakage — fix pending commit approval**: `scripts/dotnet_env.sh` (sourced by `contracts/compile.sh:7` and `scripts/verify_repo.sh:6`) and `shared/registrationAccountId.mjs` (required by tracked `sdk/js/src/index.js`) are untracked. Intended commit: `git add scripts/dotnet_env.sh shared/registrationAccountId.mjs` — `fix: track dotnet_env.sh and registrationAccountId.mjs (fresh-clone breakage)`. **Blocked on user git-approval.**
- `AA/.gitignore` verified clean (22 normal lines; the previously reported multi-line garbage entries are already gone).

## Suite results

### neo-os-web

| Suite | Command | Result | Counts |
|---|---|---|---|
| framework | `npm run -s test:framework` | PASS | 553/553 (39 files) |
| shared | `npm run -s test:shared` | PASS | 4424/4424 (394 files) |
| deploy-scripts | `npm run -s test:deploy-scripts` | **FAIL** | 205 pass / **4 fail** (209) |
| contracts (xunit) | `npm run -s test:contracts` | **FAIL** | 559 pass / **1 fail** (560) |
| integration | `npm run -s test:integration` | PASS | 32/32 (makes live testnet RPC calls — deployed state matches manifests) |
| host-app (jest) | `npm run -s test:host-app` | PASS | 1134/1134 (173 suites) |

Failures (all root-caused):
1. `goal_validation_report.test.mjs` — 7 apps lack live-chain harness: miniapp-asset-factory, miniapp-miniapp-factory, miniapp-neo-multisig, miniapp-neo-treasury, miniapp-nft-factory, miniapp-oracle-price-console, miniapp-timestamp-proof.
2. `live_harness_coverage.test.mjs` — hardcoded 71 active apps vs actual 77 (stale pin).
3+4. `morpheus_registry_sync.test.mjs` (×2) — generated registry/catalog pin testnet oracle `0x4b882e94…ad52`; morpheus repo's canonical export now says `0xf54d8584…d5ef` (see drift note below).
5. `PlatformGameRealKernelIntegrationTests.RewardGameSettlesThroughRealKernelGates` — `ABORTMSG: invalid verification signature`; test files are **untracked WIP**; either in-test FulfillmentDigest reconstruction drifted from the kernel NEF, or the copied fixture NEF (`contracts/__tests__/fixtures/real-kernel/`) is stale vs the morpheus repo kernel.

### neo-abstract-account

| Suite | Command | Result | Counts |
|---|---|---|---|
| contracts (MSTest) | `dotnet test neo-abstract-account.sln` | PASS | 180/180 (suite grew from 157) |
| sdk/js unit | `node --test tests/*.unit.test.js` | PASS | 78/78 |
| frontend | `node --test tests/*.test.js` | **FAIL** | 394 pass / **2 fail** (58 files) |

Failures: both in `frontend/tests/morpheusCanonicalSync.test.js` — same oracle-hash drift (below). Root cause verified: **uncommitted** edit in morpheus repo `config/networks/testnet.json` (`morpheus_oracle`: `0x4b882e94…` → `0xf54d85…`, with `morpheus_oracle_legacy_v1_retired: 0x4b882e94…` added). At morpheus committed HEAD, AA suite is green.

### neo-morpheus-oracle

| Suite | Command | Result | Counts |
|---|---|---|---|
| contracts (xunit) | `dotnet test contracts/__tests__/NeoContracts.Tests.csproj` | PASS | 55/55 |
| scripts | `npm run -s test:scripts` | **FAIL** | 84 pass / 3 fail (87) |
| control-plane | `npm run -s test:control-plane` | PASS | 31/31 |
| ops | `npm run -s test:ops` | PASS | 93/93 |

Failures:
1. `contract-build-regressions.test.mjs` — **env-gated**: `nccs` apphost can't find dotnet (Homebrew install, `DOTNET_ROOT` unset). Works with `DOTNET_ROOT=/opt/homebrew/Cellar/dotnet/10.0.108/libexec`. Harness trap: skip-probe uses `dotnet --info` via PATH so it doesn't skip.
2. `export-public-network-registry.test.mjs` — **real**: `config/networks/testnet.json:37` carries mainnet oracle hash (the drift).
3. `runtime-service-matrix.test.mjs` — **real**: `capabilities.js:426-439` registers `session/start|step|finalize` but `RUNTIME_SERVICE_MATRIX` has no entries for them; session endpoints may lack live-validation coverage.

## Cross-cutting: the testnet oracle-hash drift

One coherent story behind 6 of 10 total failures: the morpheus repo's working tree retires testnet kernel `0x4b882e94ed766807c4fd728768f972e13008ad52` (marked `legacy_v1_retired`) and promotes `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` (currently also the mainnet kernel). Downstream generated copies (miniapps `generated-morpheus-*.ts`, AA `generatedMorpheus*.js`) still pin the retired hash. **Resolution is a Phase 2 on-chain question**: query both hashes on testnet (`getcontractstate`), confirm which is the intended kernel, then either commit the morpheus edit + regenerate downstream copies, or revert it.

## Environment note

On this machine `nccs` needs `DOTNET_ROOT=/opt/homebrew/Cellar/dotnet/10.0.108/libexec` (or AA's `scripts/dotnet_env.sh`). Miniapps' `test:contracts` npm script sets DOTNET_ROOT itself; morpheus' build-regression test does not. Deno edge tests require the env permission flag: `cd platform/edge && deno test --allow-env functions/_shared/` (without it, 33 tests fail on `NotCapable: Requires env access` — a harness invocation detail, not test failures).

## Drift resolution log (2026-07-18, resolved)

1. **Oracle-hash drift — RESOLVED at file level in all 3 repos.** On-chain verification: `0xf54d8584…` (64 methods, id 7508) is the new canonical kernel; `0x4b882e94…` (31 methods, id 3840, updatecounter 8) is retired legacy v1. Actions: miniapps regenerated `generated-morpheus-{registry,runtime-catalog}.ts` (registry_sync tests 3/3 green); AA updated stale envelope pin in `scripts/sync_morpheus_registry.mjs` (roundtrip 5/5 green first, proving wire compatibility) + regenerated (frontend suite now 396/396); morpheus updated stale expectation in `export-public-network-registry.test.mjs` (green).
2. **Envelope "divergence" — not a wire-format divergence.** AA vendored copy (d967bb98…) vs canonical (508329d6…) differ in structure (exports/header/EC import) but the roundtrip golden-vector test passes 5/5; AA pin was simply stale. Canonical single-source + exports-map fix remains Phase 4.
3. **NEW-DRIFT found + fixed: phala→nitro schema rename.** Morpheus commit `9726af1` renamed network-registry key `phala`→`nitro`; `verify_cross_repo_testnet.sh:219` now reads `nitro.public_api_url` with `phala` fallback.
4. **Remaining live-verification blockers (external):** (a) morpheus operator secrets absent (`MORPHEUS_UPDATER_NEO_N3_WIF_TESTNET`, verifier signer, `MORPHEUS_RUNTIME_TOKEN`, runtime URL) — direct-oracle + paymaster live paths env-gated; (b) `https://oracle.meshmini.app/testnet/api/runtime/status` returns HTTP 503 (deployed runtime unhealthy).

## Intended-but-unapproved commits (all repos)

1. AA: add `scripts/dotnet_env.sh` + `shared/registrationAccountId.mjs` (fresh-clone breakage).
2. Morpheus: resolve `config/networks/testnet.json` oracle-hash edit (commit or revert) — after Phase 2 on-chain check.
3. Miniapps: commit v2 WIP (RewardGame partials, MiniAppEngineBase, new surfaces, RealKernel tests) — after Phase 2 full-loop verification.
4. This repo's new docs (`docs/superpowers/`, `docs/reports/`) — with the batch above.
