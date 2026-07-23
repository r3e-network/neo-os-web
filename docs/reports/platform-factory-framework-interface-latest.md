# MiniAppFactory Framework Interface

Generated: 2026-07-23T09:08:10.237Z

- Interface audit: **PASS**
- Tenant contract ABI: 13 methods
- Framework operations: 13 methods
- Missing methods: none
- Extra methods: none
- Configured consumers: asset-factory, nft-factory, miniapp-factory
- Live deployment status: `live-artifact-drift`
- Current local artifact match: false
- Chain writes performed: no

## Wiring

- options_config: PASS
- framework_surface: PASS
- composition_root: PASS
- scoped_write_guard: PASS

## Consumers

- shared_factory_runtime: PASS
- miniapp_factory_runtime: PASS
- asset_factory_config: PASS
- nft_factory_config: PASS
- miniapp_factory_config: PASS

## Boundary

All three Factory applications now route deployment writes through the guarded framework surface, but this does not unlock every product lane. The retained testnet Factory differs from the local artifact and lacks deployArtifactFromTemplate; Asset/NFT execution must remain closed until the governed artifacts, exact live ABI, durable recovery, event confirmation, record readback, and funded lifecycle are certified. Direct JSON-RPC remains only for read-only contract-state/signers fee probes that the wallet bridge cannot express.
