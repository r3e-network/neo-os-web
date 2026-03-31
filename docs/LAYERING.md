# MiniApp Platform Layering (Current — OS v2)

This repository no longer owns the old in-repo Oracle / AA service layer.
Since MiniApp-OS v2, the platform uses a direct OS service call model.

Current layering is:

1. `apps/`
   - MiniApp frontends using `defineMiniApp()` — all on modern pattern
   - `apps/shared/services/os/` — 10 typed OS proxy classes + EdgeClient
   - `apps/shared/services/` — PlatformServices, core services (chain, balance, etc.)
   - user-facing app logic calls `ctx.os.*` and `ctx.services.*`

2. `platform/host-app`
   - Next.js host shell
   - embeds MiniApps
   - same-origin proxying to Edge / AA relay
   - SaaS integrations: Sentry, PostHog, Supabase Realtime

3. `platform/admin-console`
   - operator UI for manifests, health, services, and contract metadata

4. `platform/edge/functions`
   - **45 OS Binder proxy functions** (`os-storage-*`, `os-payment-*`, etc.)
   - existing thin gateway layer for auth, rate limits, usage caps, policy
   - forwarding to external Oracle / AA systems

5. `contracts/`
   - **10 OS system service contracts** (`contracts/os-*/`)
   - platform infrastructure contracts (AppRegistry, Governance, etc.)
   - direct Oracle / direct AA integrations at the contract boundary

6. `deploy/` and `test/`
   - environment validation
   - cross-repo integration checks
   - deployment helpers

7. `_archive/`
   - deprecated contracts (ModuleRegistry, RecipeRegistry, etc.)
   - removed legacy apps and infrastructure

External runtime ownership:

- `neo-morpheus-oracle`
  - Oracle
  - DataFeed
  - VRF
  - Compute
  - Paymaster

- `neo-abstract-account`
  - AA core
  - verifiers / hooks
  - relay
  - AA UX and session-key flows

## Rules

- OS service contracts are the platform's system service layer — MiniApps call
  them through `ctx.os.*` proxies, not through direct chain invocations.
- Do not reintroduce a second platform-owned service bus on top of Oracle / AA.
- Prefer OS service calls for new apps; existing direct contract flows remain supported.
- Keep browser and host code free of service-role secrets and enclave signing logic.
- Keep Edge functions thin: validate, authorize, forward. OS Binder functions
  follow a standardized auth + permission + rate-limit + forward pattern.

## Source Of Truth

For current architecture and workflow details, prefer:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [WORKFLOWS.md](./WORKFLOWS.md)
- [FRONTEND_SPECIFICATION.md](./FRONTEND_SPECIFICATION.md)
- [LOCAL_DEV.md](./LOCAL_DEV.md)
