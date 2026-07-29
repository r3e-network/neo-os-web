# Repository split and CDN delivery

The platform used to be a monorepo: the host app, the admin console, the edge
functions, the platform contracts, the app-facing SDK, and all 78 MiniApps and
MiniGames with their contracts lived in one tree, and app bundles were staged
into `platform/host-app/public/miniapps` at build time.

That is now four repositories, with bundles delivered from a CDN.

| Repository | Holds |
| --- | --- |
| [`neo-os-web`](https://github.com/r3e-network/neo-os-web) | Platform only: host app, admin console, edge functions, platform contracts, deploy tooling. Loads apps from the CDN. |
| [`neo-miniapp-sdk`](https://github.com/r3e-network/neo-miniapp-sdk) | The app-facing SDK: `@r3e-network/neo-miniapp-framework` (was `framework/`) and `@r3e-network/neo-miniapp-shared` (was `apps/shared`). |
| [`neo-miniapps`](https://github.com/r3e-network/neo-miniapps) | 53 non-game MiniApps, their Neo N3 contracts, and their CDN publish pipeline. |
| [`neo-minigames`](https://github.com/r3e-network/neo-minigames) | 25 MiniGames, same. |

## How the split was decided

`scripts/plan-repo-split.mjs` writes [`plan.json`](./plan.json): for every app it
resolves the target repo from the manifest category (`games` → minigames), then
attaches that app's contracts, contract tests, and per-app tests. Keeping the
decision in one generated manifest is what made the move reviewable, and it is
re-runnable against a clean checkout.

`scripts/apply-repo-split.mjs` consumes the plan and materializes a target repo.
`scripts/verify-split-repo.mjs` then resolves every relative import in the
result and fails on anything that no longer resolves or that escapes the repo —
which is the check that actually matters when thousands of files change depth.
All three repos verify with zero unresolved and zero escaping imports.

Three findings from that process are worth carrying forward:

- **Per-app tests did not live with their apps.** All 306 sat in
  `apps/shared/test` and reached their app by relative path. They land in
  `apps/tests/unit/` — the same depth below `apps/` — so those imports needed no
  rewriting. Their `../<shared-dir>` imports did, and became `@shared/*`.
- **Ownership had to come from content, not filenames.** Tests named after
  neither an app nor the runtime (`anchor-ux-fixes`, `console-kernel`,
  `price-feed-freshness`, …) do exercise app sources; a filename rule would have
  stranded them in the SDK repo where that code no longer exists.
- **No test crossed the games/non-games boundary.** That is what made a clean
  two-way split possible at all. Four cross-cutting parity tests that assert on
  platform host source or span both repos stayed here; see `keeps_shared_tests`
  in the plan.

## CDN layout

Bundles live in the Cloudflare R2 bucket `miniapps`, served publicly from
`https://meshmini.app`:

```
<kind>/<slug>/<version>/index.html          immutable, max-age=31536000
<kind>/<slug>/<version>/assets/*            immutable, max-age=31536000
<kind>/<slug>/<version>/neo-manifest.json   immutable, max-age=31536000
meta/<kind>/<slug>/latest.json              max-age=60   - the release pointer
catalog/<kind>.json                         max-age=60   - meta + artwork only
```

`<kind>` is `miniapps` or `minigames`.

Two properties of this layout do the real work:

- **The version is in the path**, so every bundle object is immutable. A new
  build is a new URL, nothing ever needs cache-busting, and a rollback is a
  pointer rewrite rather than a re-upload.
- **The catalogue carries no bundle payload**, only metadata and artwork. That
  is what lets the launcher render ~80 apps having fetched two JSON documents
  and a logo per card.

Uploads authenticate against R2's S3 API using a Cloudflare API token — access
key id is the token id, secret is the sha256 of the token value — so there is
one rotatable credential instead of a separate pair of R2 access keys.

The bucket needs a CORS rule allowing `GET`/`HEAD` from any origin: bundles run
in a sandboxed iframe whose origin is `null`, and Vite's `crossorigin` module
preloads require a matching `Access-Control-Allow-Origin`.

## How the platform loads an app

`platform/host-app/lib/miniapp-cdn.ts` is the only reader of the CDN surface. It
merges both catalogues (cached 60s, matching the pointer TTL), resolves an app to
its entry URL, and degrades to the locally staged `/miniapps/<slug>/index.html`
when the CDN is unreachable or `MINIAPP_BUNDLE_SOURCE=local`. An empty result is
never cached, so a transient CDN failure cannot pin the launcher to zero apps.

`applyCdnBundles` in `lib/miniapp-definitions.ts` overlays those entries onto the
definition list. It runs after the local sources, which is what lets it work in
both worlds: while `apps/` was still here the CDN entry simply replaced the
staged path, and once `apps/` is gone the catalogue becomes the source of the
definitions themselves.

Nothing downstream changed: `buildEmbeddedDappUrl` already preferred
`app.dapp_url`, so all ~20 playareas moved to CDN delivery without a call-site
edit.

## Loading behaviour

`EmbeddedDappSurface` shows an app's artwork, name, and description first and
requests the bundle only when the visitor opens it (`autoLoad` skips the poster
for surfaces they already chose). Both it and the standalone route render the
same `MiniAppBundleLoader`, so an app never appears to load differently
depending on the entry point.

## The OneGate surface

OneGate opens `/play/<slug>` on the platform host, not a raw CDN URL. The page
renders no `<Layout>` — chrome is opt-in per page in this host — so the visitor
sees only the app, full viewport, while the platform keeps ownership of the
wallet/storage/credential bridges, the sandbox policy, and the loading state.

`next.config.js` gives `/play/*` the MiniApp `frame-ancestors` allowlist and no
`X-Frame-Options`, which cannot express an allowlist; the catch-all policy that
sets `SAMEORIGIN` now excludes it.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `MINIAPP_CDN_BASE_URL` | `https://meshmini.app` | Public bundle origin (server). |
| `NEXT_PUBLIC_MINIAPP_CDN_BASE_URL` | — | Same, for the browser. |
| `MINIAPP_BUNDLE_SOURCE` | `cdn` | `local` pins the host to `public/miniapps`, for offline work and Playwright. |
| `MINIAPP_PLATFORM_BASE_URL` | `https://neomini.app` | Host origin the publishers use to build OneGate `/play` URLs. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN_ID`, `MINIAPP_R2_BUCKET` | — | Publish credentials (app repo CI). |

## Seeding

`scripts/seed-cdn-bundles.mjs` performed the initial upload from the bundles
already built in this repo, using the same layout the app repos' publisher
writes, so the platform could be switched over before the app repos' CI was
able to run. `--catalog-only` rewrites just the pointers and catalogues, which
avoids re-uploading ~130MB of unchanged content-addressed assets.

## Known follow-ups

- The SDK packages are not published to GitHub Packages yet, so the app repos'
  `npm install` cannot resolve `@r3e-network/neo-miniapp-{framework,shared}`.
  Tag `neo-miniapp-sdk` to run its publish workflow; the app repo CI is blocked
  until then.
- Four cross-app conformance audits (`game-guest-mode-adoption`,
  `game-manifest-network`, `game-motion-baseline`, `stateful-manifest-truth`)
  were copied into both app repos, where they see only that repo's apps. They
  run under `npm run test:conformance` and do not gate CI until their hardcoded
  app lists tolerate a subset.
- The four parity tests kept here still import app sources, so they must be
  reworked before `apps/` is deleted from this repo.
