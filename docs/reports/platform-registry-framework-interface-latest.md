# PlatformRegistry Framework Interface

Generated: 2026-07-23T00:58:53.658Z

- Interface audit: **PASS**
- Non-control-plane contract ABI: 48 methods
- Framework ABI operations: 48 methods
- Native GAS credit operations: 1
- Missing methods: none
- Extra methods: none
- Configured production consumers: 0
- Live tenant ABI availability: 40/48
- Live deployment status: `live-artifact-drift`
- Current local artifact match: false
- Chain writes performed: no

## Wiring

- options_config: PASS
- framework_surface: PASS
- composition_root: PASS
- react_passthrough: PASS
- guarded_writes: PASS

## Live Missing Tenant Methods

abstractAccountCore, abstractAccountCoreAvailableAt, appIdOfAbstractAccount, cancelSpendThresholdRaise, executeSpendThresholdRaise, getAppAbstractAccount, materializeAbstractAccount, pendingAbstractAccountCore

## Boundary

The framework now covers every current local non-control-plane PlatformRegistry ABI method plus the native GAS credit prepayment required by permissionless registration. No production miniapp is configured against it: the retained testnet Registry checksum differs from the local artifact and lacks the shared-AA materialization and spend-threshold methods. Production binding remains closed until the exact Registry artifact is upgraded and verified, the reciprocal UnifiedSmartWallet registrar/core configuration matures, the 77-account dry-run proves uniqueness and reverse indexes, and a separately approved write run materializes accounts. Platform-admin governance, artifacts, engine registration, fees, and updates are intentionally not exposed through app.registry.
