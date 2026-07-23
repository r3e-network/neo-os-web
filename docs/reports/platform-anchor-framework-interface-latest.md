# PlatformAnchor Framework Interface

Generated: 2026-07-23T09:08:10.035Z

- Interface audit: **PASS**
- Tenant contract ABI: 32 methods
- Framework ABI operations: 32 methods
- Native NEO deposit operations: 1
- Missing methods: none
- Extra methods: none
- Live deployment status: `live-artifact-drift`
- Current local artifact match: false
- Chain writes performed: no

## Wiring

- options_config: PASS
- framework_surface: PASS
- composition_root: PASS
- manifest_binding: PASS
- scoped_write_guard: PASS

## Consumers

- trust_runtime_surface: PASS
- trust_runtime_config: PASS
- profit_runtime_shared: PASS
- profit_runtime_config: PASS

## Boundary

The framework and TrustAnchor/ProfitAnchor user runtimes cover the current local tenant ABI, but the retained testnet PlatformAnchor bytecode differs from the local artifact. The existing deployment must not be described as local-source compatible until an approved upgrade and live compatibility validation complete.
