# Host performance status

Last verified: 2026-07-11

## Client bundle result

Production `next build` measurements before and after the monitoring and wallet
split:

| Metric | Before | Current | Change |
| --- | ---: | ---: | ---: |
| Shared first-load JavaScript | 403 kB | 293 kB | -110 kB (-27.3%) |
| `pages/_app` JavaScript | 301 kB | 192 kB | -109 kB (-36.2%) |
| Home first-load JavaScript | 424 kB | 315 kB | -109 kB (-25.7%) |
| Standalone `apps/` payload | 1.4 GB | 19 MB | about -98.6% |
| Staged Tarot MiniApp | 32 MB | 25 MB | about -21.9% |

## What changed

- PostHog is imported only when a public key is configured and analytics are
  actually initialized or used.
- Sentry's reporting facade is imported only after a real error and only when a
  DSN is configured.
- The duplicate post-hydration monitoring initializer was removed; the existing
  `AnalyticsProvider` remains the single initialization path.
- The developer-key wallet adapter is now a retryable dynamic import. Normal
  extension-wallet users no longer download its implementation in the platform
  shell.
- Phaser remains app-scoped and lazy; it was not moved into the host bundle.
- Standalone packaging now copies the 77 runtime manifests and Tarot card files
  that the server resolves from `apps/`, rather than duplicating every app's
  source, dependencies, caches, and build workspace.
- The staged Tarot build now serves the current WebP deck instead of the stale
  JPEG deck while retaining the selected option-3 artwork and card fidelity.

## Verification

- `npm run typecheck`
- focused monitoring and error-boundary Jest suites: 5 passed
- wallet store, WIF adapter, restore, events, balance refresh, cross-tab and auth
  suites: 58 passed
- complete host Jest regression: 1,119 passed across 171 suites
- `npm run build`
- standalone server HTTP/MIME smoke: health JSON, 117 kB MiniApp catalog,
  Tarot WebP, and staged Asset Factory HTML all returned `200`
- `git diff --check` for the changed host files

Visual browser performance traces remain a separate follow-up because the
approved in-app browser is not available in this task. The production bundle
measurement is complete and comes from the generated Next.js build output.
