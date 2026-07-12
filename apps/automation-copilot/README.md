# Automation Copilot

Automation Copilot is a visual studio for building and operating Morpheus price-triggered recipes. The first screen is a working automation route, not a parameter form: users choose a designed recipe, see the watched asset, threshold, schedule, and action as one flow, then register it with a single primary action.

## Product flow

1. Choose a loan-protection, vault-rebalance, or reward-harvest recipe.
2. Fetch the current on-chain Morpheus datafeed price and verify its source timestamp is no older than 12 hours.
3. Optionally tune the exact target, five-field cron schedule, and workflow action in the studio drawer.
4. Register the trigger through the host automation gateway.
5. Refresh, select, pause, resume, or delete gateway-verified triggers.

The app never labels a local fallback as a running automation. If no executor is available, the result is shown as a draft handoff intent and its enable/disable controls stay locked.

Registration also stays locked when the price is missing, non-positive, lacks a trustworthy source timestamp, or is stale. Changing the watched asset invalidates the previous quote and exact gateway request.

## Runtime boundaries

- Price reads come from the network-specific MorpheusDataFeed configured in `apps/shared/constants/rpc.ts`.
- Trigger persistence and operations use `/api/edge/automation-*` through the host gateway.
- The miniapp does not contain a scheduler, keeper, TEE runtime, or wallet transaction flow.
- Gateway state is persistent, so the manifest intentionally declares `stateless: false`.

## Local development

```bash
npm run dev
npm run build
```

The production bundle is staged with:

```bash
node scripts/stage-miniapp-dists.mjs automation-copilot
```
