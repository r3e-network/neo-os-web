# PlatformDeFi Framework Interface

Generated: 2026-07-23T04:43:26.197Z

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

The framework covers the current local PlatformDeFi tenant ABI, exact appId:credit native deposits, app-scoped direct credits, tenant/global liabilities, and pause-immune withdrawals, but no miniapp is bound to it. The deployed contract stores legacy credits by payer under the same 0x14/0x15 prefixes that v1.2 rekeys to appId plus payer. The local candidate now auto-pauses an upgraded legacy contract and exposes an exact-snapshot, deficit-top-up, payer-withdrawal recovery bridge, but that bridge still requires public snapshot reconciliation, separate deficit authorization, and full TestEngine plus RPC simulation before any chain write. With zero bindings, a fresh v1.2 deployment remains preferred. Existing SelfLoan, FlashLoan, and TimeCapsule apps use materially different standalone ABIs and money/recovery state machines; they must not be rebound without a named migration, compatibility adapter, invariant suite, drain/rollback plan, deployed-artifact equality, and funded lifecycle proof.
