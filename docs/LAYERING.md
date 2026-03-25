# MiniApp Platform Layering (Current)

This repository no longer owns the old in-repo Oracle / AA service layer.

Current layering is:

1. `apps/`
   - MiniApp frontends and shared Vue composables
   - user-facing app logic only

2. `platform/host-app`
   - Next.js host shell
   - embeds MiniApps
   - same-origin proxying to Edge / AA relay

3. `platform/admin-console`
   - operator UI for manifests, health, services, and contract metadata

4. `platform/edge/functions`
   - thin gateway layer
   - auth, rate limits, usage caps, policy enforcement
   - forwarding to external Oracle / AA systems

5. `contracts/`
   - platform and MiniApp smart contracts
   - direct Oracle / direct AA integrations at the contract boundary

6. `deploy/` and `test/`
   - environment validation
   - cross-repo integration checks
   - deployment helpers

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

- Do not reintroduce a second platform-owned service bus on top of Oracle / AA.
- Prefer direct MiniApp contract flows for flagship apps.
- Keep browser and host code free of service-role secrets and enclave signing logic.
- Keep Edge functions thin: validate, authorize, forward.

## Source Of Truth

For current architecture and workflow details, prefer:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [WORKFLOWS.md](./WORKFLOWS.md)
- [FRONTEND_SPECIFICATION.md](./FRONTEND_SPECIFICATION.md)
- [LOCAL_DEV.md](./LOCAL_DEV.md)
