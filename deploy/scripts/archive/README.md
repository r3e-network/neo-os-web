# deploy/scripts/archive

Stale / completed one-off scripts moved here in the 2026-07 cleanup program
(整理重复/失效代码). Nothing here is referenced by `package.json`, the
`Makefile`, CI workflows, sibling scripts, `scripts/`, `docs/`, `docs/archive/claudedocs/`
or `README.md` (verified by repo-wide basename search on 2026-07-18).
Files are kept for history, not for execution — most will not run against the
current repo layout.

## Archived files

| File | Reason archived |
| --- | --- |
| `add_tx_hash_column.sql` | Completed one-off incremental migration (2026-03); `simulation_txs` is managed outside this repo's migration chain. |
| `audit_miniapp_business_completeness.js` | One-off business-completeness review (2026-05); report committed at `docs/reports/miniapp-business-completeness-latest.*`; not part of the wired `audit:*` gates. |
| `audit_miniapp_runtime_ui.js` | One-off runtime-UI audit; report + screenshots committed under `docs/reports/`; ongoing UI e2e coverage lives in `platform/host-app` (`test:e2e`, playwright). |
| `configure_flagship_testnet_dependencies.js` | Completed one-off flagship testnet wiring (`setOracle` + oracle callback credit); subsumed by the post-deploy conditional wiring in `deploy_selected_miniapp_contracts.go`. |
| `consistency_check.sh` | Validates the removed Go service-layer layout (`services/`, `cmd/`, `infrastructure/logging` import path) — those directories no longer exist. |
| `deploy_master.go` | Client for the `neo-accounts` service `/deploy-master` HTTP endpoint; the Go service layer moved to external repos. |
| `deploy_miniapp_consumer.go` | Deploys `MiniAppServiceConsumer`, a contract no longer present in `contracts/`. |
| `mainnet_functional_validate.mjs` | Hardcoded one-off mainnet validator (2026-06); superseded by the manifest-driven wired gate `verify_mainnet_miniapp_contract_methods.js` (`test:mainnet:miniapp-contract-methods`). |
| `migrate_anchor_agents_to_aa_proxy.mjs` | Completed one-off migration; execution evidence at `docs/reports/anchor-aa-proxy-migration-mainnet.json`. |
| `migrate_miniapp_contracts.py` | One-off 2026-03 repo restructuring; references the removed root `miniapps/` directory. |
| `production_readiness_check.sh` | 2026-03 service-era TODO scanner; calls a broken path (`scripts/check_enclave_signing_key.sh` — the real script lives in `deploy/scripts/`). |
| `register_candidate.go` | One-off Neo N3 testnet consensus-candidate registration from initial infra setup. |
| `register_miniapps.go` | Registers apps on the retired on-chain `AppRegistry`; binding is now a static table + manifest write-back (see `register_apps_on_platform_registry.go`, `deploy_selected_miniapp_contracts.go`). |
| `run_sql.go` | Generic postgres runner (`lib/pq`, `DATABASE_URL`) left over from the removed Go service layer. |
| `scaffold-miniapp-definitions.sh` | References the removed root `miniapps/` directory (miniapps now live in `apps/`; definitions are built by `scripts/build-miniapp-dapps.mjs`). |
| `sync-miniapp-card-assets.sh` | References the removed root `miniapps/` directory (card assets now under `apps/*/public`, optimized via `assets:miniapps:optimize`). |
| `validate_miniapp_workflows.go` | Targets the removed service-era contract generation (`Governance`/`PriceFeed`/`RandomnessLog`/`AppRegistry`/`AutomationAnchor` env hashes) — none exist in `contracts/` anymore. |

## Gate status

After archiving, `npm run -s test:deploy-scripts` remains **208 pass / 1 fail**
(the single failure is the deliberate live-harness goal gate in
`lib/goal_validation_report.test.mjs` — pre-existing, unchanged).
No archived file had a `lib/*.test.mjs` test.
