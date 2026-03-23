# 2026-03-23 Cross-Repo Validation Summary

## Scope

This report summarizes the latest cross-repo validation pass across:

- `neo-morpheus-oracle`
- `neo-abstract-account`
- `neo-miniapps-platform`

Focus areas:

- oracle runtime / relayer / control plane robustness
- AA contract + SDK + frontend integrity
- miniapp host/admin frontend integrity
- flagship and non-flagship testnet live miniapp flows
- signer stability and testnet operational readiness

## Pushed Revisions

### neo-morpheus-oracle

- `d3c8f9c` Harden oracle testnet smoke and signer validation
- `3b4830f` Add oracle contract solution file
- `0997870` Stabilize oracle signer routing and feed sync

### neo-abstract-account

- `6942d2a` Refactor UnifiedSmartWallet into partial modules
- `29eee71` Migrate contract tests to UnifiedSmartWallet V3
- `a3a8237` Tighten AA frontend audit gating

### neo-miniapps-platform

- `e666fd48f` Fix host app build regressions
- `731b0e24e` Fix flagship testnet RNG fallback routing
- `45989ef33` Improve admin console resilience and accessibility
- `ef02e523c` Harden platform edge and host diagnostics
- `d63c6c3b0` Polish miniapp accessibility and interaction flows
- `3e99fc27a` Improve blueprint live preview accessibility
- `d5d39cd48` Harden deployment and validation scripts
- `00f98cb00` Mark non-flagship miniapps as beta
- `513f0f878` Add beta defaults coverage for miniapp catalog
- `e079d828d` Harden miniapp live smoke validation scripts
- `e1bd8cd30` Make selected miniapp smoke flows state-aware

## Validation Results

### neo-morpheus-oracle

Passed:

- `npm run test:worker`
- `npm run test:relayer`
- `npm run test:control-plane`
- `npm run check:control-plane`
- `npm run verify:edge-gateway`
- `env MORPHEUS_CONTROL_PLANE_URL=https://control.meshmini.app npm run smoke:control-plane`
- `npm run once:relayer`
- `dotnet test neo-morpheus-oracle.sln -c Release --nologo`

Operational findings:

- testnet signer routing is now stable and deterministic
- feed sync now forwards the intended updater signer to the worker runtime
- legacy `OIL-USD` feed usage is normalized to `WTI-USD`
- pricefeed resumed healthy execution after refueling the testnet updater accounts

### neo-abstract-account

Passed:

- `dotnet build contracts/UnifiedSmartWallet.csproj -c Release -p:WarningsAsErrors=nullable`
- `dotnet test neo-abstract-account.sln -c Release --nologo`
- `npm --prefix sdk/js test`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `bash scripts/verify_repo.sh`

Operational findings:

- legacy .NET contract tests are now migrated to `UnifiedSmartWallet V3`
- solution-level verification works again
- frontend audit gate no longer blocks on resolved moderate/high issues
- remaining frontend audit issues are low-severity transitive `@web3auth` findings

### neo-miniapps-platform

Passed:

- `npm run test:host-app`
- `npm run test:admin-console`
- `npm --prefix platform/host-app run build`
- `npm --prefix platform/admin-console run build`
- `npm run audit:miniapps:layout`
- `npm run test:flagship-miniapps`
- `npm run test:flagship-deployed-abi`
- `npm run test:flagship-active-state`
- `npm run test:testnet:direct`
- `npm run test:testnet:full-stack`

Frontend findings:

- non-flagship miniapps now default to `beta`
- flagship miniapps remain primary and retain normal status handling
- host/admin surfaces remain buildable and testable after status-model changes

## Testnet Live Flow Coverage

### Flagship miniapps

Validated green in full-stack testnet flow:

- `dailyCheckin`
- `lastSurvivor`
- `gasBox`
- `fogPlay`
- `redEnvelope`
- `selfLoan`
- `neoPay`

### Additional miniapp live smoke coverage

Validated green:

- `breakup`
- `burnleague`
- `devtipping`
- `tarot`
- `vault`
- `eventticket`
- `gassponsor`
- `memorial`
- `milestone`
- `soulbound`
- `trustanchor`
- `govmerc`
- `quadratic`
- `timecapsule`
- `flashloan`
- `exfiles`
- `masqueradedao`
- `millionpiecemap`
- `graveyard`
- `halloffame`
- `heritagetrust`
- `dicegame`
- `gascircle`
- `turtlematch`

Script hardening completed during this pass:

- selected miniapp smoke now uses a dedicated oracle updater signer for manual oracle fulfillment
- remaining part1 smoke now uses the real oracle request id emitted by `OracleRequested` for tarot
- hall of fame season rollover now handles ended-but-still-active seasons correctly
- smoke execution is materially more reliable when admin/user are distinct test accounts

## Testnet Account Stability

Refueled and verified balances:

- `NiUs458jFbTH1DA3b9QyeDhMaD282h3iJg`: ~999.81 GAS
- `NLjQR6uvgaW1nbifSmZbgLpAkkhnPvGpRh`: ~1002.48 GAS
- `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu`: ~16338.18 GAS
- `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`: ~46796.14 GAS

Refuel transactions executed during this pass:

- `0xb8caec1eeb9e092c9f1a93ce081f598dd4f7cbc49c11a885138cc202a1c2e309`
- `0x3eabc86eaa2b22789a886b1b12c76f9fc8b870d9295e8468a30e22580d508461`
- `0x716578df16dddbd60d5321c4c786d403d71840cb1aaed318dc9a9ca3ba1c2b10`
- `0x279ecadab7e4e28c12a5d0be9e00856249038effac8493a62e839bc68a5c97aa`

## Remaining Risks

- `Unknown script container` appears transiently while polling `getApplicationLog` on testnet. Current validation scripts already tolerate and retry through it, and all key suites completed successfully despite it.
- `neo-abstract-account` frontend still reports low-severity transitive audit findings from `@web3auth`. No moderate/high frontend audit issue remains in the current verification gate.
- Non-flagship live smoke coverage is now significantly stronger, but it is still tied to scripted state manipulation on long-lived shared testnet contracts. Future regressions are more likely to arise from state drift than from core framework breakage.

## Overall Assessment

The current integrated state is operationally healthy:

- oracle services are functional, signer selection is stabilized, and pricefeed execution is healthy
- AA contract / SDK / frontend validation is green end-to-end
- flagship miniapp live flows are green
- the major non-flagship smoke suites now run green after script hardening and testnet account refueling
- all three repos are clean locally after the pushed commits in this validation cycle
