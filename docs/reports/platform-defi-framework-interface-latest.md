# PlatformDeFi Framework Interface

Generated: 2026-07-23T21:51:48.548Z

- Interface audit: **PASS**
- Tenant contract ABI: 58 methods
- Framework ABI operations: 58 methods
- Native prepaid deposit operations: 1
- Missing methods: none
- Extra methods: none
- Shared miniapp bindings: 0
- Live deployment status: `live-artifact-drift`
- Current local artifact match: false
- Chain writes performed: no

## Wiring

- options_config: PASS
- framework_surface: PASS
- composition_root: PASS
- manifest_binding: PASS
- scoped_write_guard: PASS

## Boundary

The framework covers the current local PlatformDeFi tenant ABI, exact appId:credit native deposits, app-scoped direct credits, tenant/global liabilities, and pause-immune withdrawals, but no miniapp manifest is bound to it. SelfLoan is now the named first-tenant source migration: PlatformDeFi v1.3 adds an explicit profile that enforces one active position and disables liquidation/abandonment, while the app keeps its standalone path and enables shared mode only after exact artifact attestation plus profile verification. Its deposit/create/read/recovery paths and atomic GAS-deposit-plus-repay lane have focused contract, framework, and composable tests. This is not live adoption: the retained deployment is artifact-drifted, shared bindings remain zero, and no registration, funding, or manifest cutover was performed. A fresh exact-artifact deployment, profile-1 tenant registration, funded lifecycle, rollback/drain proof, and explicit chain-write approval remain mandatory. FlashLoan and TimeCapsule still have materially different standalone ABIs and recovery state machines and require separate named migrations.
