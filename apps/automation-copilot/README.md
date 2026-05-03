# Automation Copilot

User-facing console for pricefeed-backed automation, AA runbooks, and Morpheus execution recipes.

## Scope

This miniapp does not embed its own scheduler or TEE runtime. It acts as the product shell for trigger recipes and directs execution into the existing control-plane architecture.

It provides:

- datafeed documentation and runtime explorer entry points
- AA workspace entry path for execution-side flows
- runbook-centric automation guidance
- an explicit separation between pricefeed and request-response workloads

## Official Endpoints

- Architecture docs: `https://oracle.meshmini.app/docs/architecture`
- Datafeeds docs: `https://oracle.meshmini.app/docs/datafeeds`
- Runtime explorer: `https://oracle.meshmini.app/explorer`
- AA app workspace: `https://neo-abstract-account.vercel.app/app`
- Runtime source of truth: `apps/shared/constants/rpc.ts`
