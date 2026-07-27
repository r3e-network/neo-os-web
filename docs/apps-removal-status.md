# Removing `apps/` from the platform repo — verified status

The three app repos (`neo-miniapp-sdk`, `neo-minigames`, `neo-miniapps`) are live and
the CDN serves all 78 apps, so `apps/` and `contracts/MiniApp*` in this repo are
now duplicates awaiting deletion. This file records what actually blocks that,
measured rather than inferred.

## How this list was produced

`mv apps apps.off`, then ran the platform's suites and audits against the tree
with the directory genuinely absent. Everything below is an observed failure, not
a prediction from reading imports.

## Blockers

**`platform/host-app` — 10 of 178 suites** (168 already run fine without `apps/`):

| Suite | What it needs |
|---|---|
| `__tests__/api/catalog.test.ts` | app metadata → read the published catalogue |
| `__tests__/api/platform.stats.env.test.ts` | app roster → catalogue |
| `__tests__/api/tarot-card-assets.test.ts` | on-chain-tarot card art → app repo, or the CDN bundle |
| `__tests__/assets/official-brand-assets.test.ts` | per-app logo/banner → catalogue `icon_url` / `banner_url` |
| `__tests__/components/PlayAreaRegistry.test.tsx` | app PlayArea sources → app repo |
| `__tests__/lib/miniapp-definitions.test.ts` | app manifests → catalogue |
| `__tests__/lib/miniapp-media.test.ts` | per-app media files → catalogue |
| `__tests__/lib/no-explorer-mocks.test.ts` | scans app sources for forbidden mocks → app repo |
| `__tests__/lib/no-production-fallback-mocks.test.ts` | same, app-source scan → app repo |
| `__tests__/lib/privacy-miniapps.test.ts` | app manifests → catalogue |

**`tests/`** — `validation/executable/error-message-quality.test.ts`.

Two shapes, and the distinction matters: suites that need app **metadata** repoint
at `catalog/{miniapps,minigames}.json`, which publishes `id`, `contracts`, `icon_url`
and `banner_url` verbatim. Suites that scan app **source** belong in the repo that
holds the source — moving them here would only recreate the coupling.

## Two claims that did not survive checking

An earlier analysis pass flagged both of these as critical. Neither holds:

- **"The tolerant audits silently pass over zero apps."** They do not.
  `audit_miniapp_media_identity.js` and `audit_all_miniapp_coverage.js` both reach
  `readdirSync(APPS_DIR)` and exit non-zero with ENOENT. The failure is a raw stack
  trace rather than a clear message, which is worth improving, but the dangerous
  behaviour — reporting success over an empty set — does not occur.
- **"`contracts/build/testnet_factory_deployment.json` must be captured before
  deletion."** No such file exists and nothing in the repo references it.

Both were plausible from reading the code. Neither reproduced when run.

## Already done

- `deploy/scripts/lib/{shared_react_card_style,shared_react_controls_style,standalone_status_toast_layout}.test.mjs`
  → `neo-miniapp-sdk`, each mutation-checked.
- `deploy/scripts/lib/{dice_game,last_survivor,screw_sort}_frontend_structure.test.mjs`
  → `neo-minigames`; the `on_chain_tarot` and `gasbox` residue folded into the
  suites already there.
- The SDK is consumed as a published package. `node_modules/@r3e-network/*` must
  stay real directories — if they become symlinks to a sibling checkout, every
  gate silently reads uncommitted local work instead of the release.
