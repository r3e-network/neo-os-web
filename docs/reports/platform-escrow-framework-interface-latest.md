# PlatformEscrow Framework Interface

Generated: 2026-07-30T10:27:23.793Z

- Interface audit: **PASS**
- Tenant contract ABI: 18 methods
- Framework ABI operations: 18 methods
- Native funding operations: 1
- Missing methods: none
- Extra methods: none
- Live deployment: no deployment record
- Chain writes performed: no

## Wiring

- options_config: PASS
- framework_surface: PASS
- composition_root: PASS
- scoped_write_guard: PASS

## Boundary

PlatformEscrow is source/build/test accepted and exposed through a guarded framework surface, but it has no retained deployment record or live binding. MiniAppMilestoneEscrow remains a separate legacy consumer until an approved migration, registry binding, funded lifecycle, and exact read-back are proven.
