# PlatformDeFi Framework Interface

Generated: 2026-07-23T03:43:43.023Z

- Interface audit: **PASS**
- Tenant contract ABI: 55 methods
- Framework ABI operations: 55 methods
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

## Boundary

The framework covers the current local PlatformDeFi tenant ABI and native prepaid deposits, but no miniapp is bound to it. Existing SelfLoan, FlashLoan, and TimeCapsule apps use materially different standalone ABIs and money/recovery state machines; they must not be rebound without a named migration, compatibility adapter, invariant suite, drain/rollback plan, deployed-artifact equality, and funded lifecycle proof.
