# Deprecated Contracts (MiniApp-OS v1 → v2 Migration)

These contracts were part of the v1 composable module registry architecture
and have been replaced by direct OS system service contracts in v2.

## What was deprecated

### Registry Chain (4-hop routing)
- **ModuleRegistry** — Shared module discovery/versioning → replaced by direct OS service contracts
- **RecipeRegistry** — Module combination recipes → replaced by manifest declarations
- **MiniAppInstanceRegistry** — Instance tracking with recipe bindings → replaced by AppRegistry
- **ServiceGateway** — Routing kernel for module invocations → replaced by direct service calls

### Base Classes
- **MiniAppGameBase** — Game contract base → absorbed by GameService
- **MiniAppServiceBase** — Service callback base → absorbed by OS service hooks
- **MiniAppComputeBase** — Compute bridge base → replaced by ScriptEngine
- **MiniAppGameComputeBase** — Game + compute base → replaced by GameService + ScriptEngine

## Why

The 4-hop routing chain (MiniApp → ServiceGateway → resolve binding → ModuleRegistry
→ RecipeRegistry → Module Contract) was over-engineered. Following the Android OS model,
miniapps now call OS system services directly via their appId:

```
MiniApp → OS.CheckinService.CheckIn(appId, user)  // Direct call, no routing
```

See `docs/superpowers/specs/2026-03-31-miniapp-os-v2-design.md` for the full architecture.

## Date
Archived: 2026-03-31
