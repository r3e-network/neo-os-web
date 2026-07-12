# Automation Copilot production status

## Completed in v1.1.0

- Visual recipe presets replace the blank first-screen parameter form.
- A real warm automation-workbench asset anchors the primary scene.
- NEO/GAS quick selection, threshold state, action plan, and execution route remain visible together.
- Exact target, schedule, and custom workflow controls are progressively disclosed in the studio drawer.
- Gateway-verified triggers can be refreshed, selected, paused, resumed, and deleted from one management surface.
- The first-party embedded studio receives the existing signed host session needed by `/api/edge/automation-*`; unrelated MiniApps keep their normal embed policy.
- Local fallback results remain explicitly marked as non-running handoff intents.
- Invalid prices and cron schedules disable registration before a gateway call.
- Trigger registration requires a positive on-chain quote with a trustworthy source timestamp no older than 12 hours; switching assets invalidates the old quote and copied request.
- Gateway failures preserve the previous trigger list and remain visible as recoverable errors.
- Lightweight semantic mx2 controls reduce the main production chunk from about 415 kB to about 233 kB while preserving the shared visual language.

## Operational boundary

Automation Copilot composes and submits automation recipes. The actual scheduler and executor live behind the host automation gateway. No miniapp-only state is presented as proof that a remote keeper is active.

Current read-only network evidence is recorded in `NETWORK_STATUS.md`. The live mainnet provider records were fresh during the 2026-07-11 check. Testnet provider source timestamps were stale, so testnet registration correctly remains locked until the feed updates.

## Verification boundary

Production readiness includes TypeScript, scoped Vitest, i18n parity, production build, staged asset/manifest checks, and HTTP/MIME smoke checks. Browser screenshot comparison remains a separate visual-QA gate when the approved in-app browser is available.
