# Host App (Next.js)

**Production URL: https://neomini.app**

This **Next.js** host runs on **Vercel** and serves as the entry point for MiniApps.

Responsibilities:

- enforce MiniApp manifest policy (permissions/limits/assets) via Edge gating
- sandbox MiniApps via **Module Federation remotes** and `iframe` containers
- strict CSP + postMessage allowlists
- provide `window.MiniAppSDK` for federated apps and same-origin iframes
- surface wallet binding, intent submission, AppRegistry workflows, and AA relay proxying

Current capabilities:

- `pages/index.tsx` loads MiniApps via `entry_url` and supports:
  - `mf://...` Module Federation manifests
  - canonical `https://...` iframe launches
  - bare `*.matrix` / `*.neo` entry domains, normalized to `https://...`
- `pages/federated.tsx` is a dedicated Module Federation loader.
- `window.MiniAppSDK` is exposed for federated MiniApps and injected into same-origin iframes.
- Settings UI includes wallet binding (`wallet-nonce` + `wallet-bind`) and intents (`pay-gas` / `vote-neo`).
- AppRegistry workflow for `app-register` / `app-update-manifest`.
- CSP headers set via `platform/host-app/middleware.ts` with per-request nonces.

## Production Configuration

- `MINIAPP_FRAME_ORIGINS`: space-separated `frame-src` allowlist for embedded iframes.
- `NEXT_PUBLIC_MF_REMOTES`: comma-separated Module Federation remotes (e.g. `miniapp@https://cdn.miniapps.com/miniapps/miniapp-mf`).
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL for `connect-src` allowlist.
- `EDGE_RPC_ALLOWLIST`: comma-separated Edge function names that `/api/rpc/*` may call (`*` to allow all).
- `AA_RELAY_URL`: external `neo-abstract-account` relay URL used by `/api/aa/relay`.

### MiniApp Approval & Governance

- `MINIAPP_PUBLISH_APPROVAL_REQUIRED=true` enables publish approval gate.
- `MINIAPP_PUBLISH_REVIEWERS` sets wallet allowlist for approval actions.
- `MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES` and `MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES` control SLA labels.
- `MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL` enables reminder notifications for breached/escalated requests.
- `CRON_SECRET` protects cron endpoints.
- `HOST_APP_BASE_URL` is required by the publish reminder cron endpoint.

Cron endpoint:

- `GET/POST /api/cron/miniapp-publish-reminders`

Additional references:

- `docs/MINIAPP_VERSIONING_MODEL.md`
- `docs/MINIAPP_PRODUCTION_CUTOVER_CHECKLIST.md`
- `docs/MINIAPP_ENV_TEMPLATE.md`

## `/api/rpc/*` Proxy (Blueprint Path)

The architectural blueprint uses the prefix `/api/rpc/*` for gateway endpoints.
In production, Supabase Edge Functions use `/functions/v1/*`.

This host app includes an optional proxy route:

- `platform/host-app/pages/api/rpc/[fn].ts`
- `platform/host-app/pages/api/rpc/relay.ts` (blueprint alias)
- `platform/host-app/pages/api/aa/relay.ts` (AA relay proxy)

It forwards `GET/POST/...` requests to:

- `${EDGE_BASE_URL}/<fn>` (preferred), or
- `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/<fn>` (fallback)

Set `EDGE_BASE_URL` to one of:

- `https://<project>.supabase.co/functions/v1`
- `http://localhost:8787/functions/v1` (repo Edge dev server)

The `/api/rpc/relay` alias accepts `fn` via query string or JSON body and
forwards the remaining payload to the named Edge function.

The `/api/aa/relay` route forwards relay-ready AA payloads to the configured
external `AA_RELAY_URL`, keeping MiniApps on the same origin while the AA relay
runtime remains external to this repo.

In production, `/api/rpc/*` requires `EDGE_RPC_ALLOWLIST` to be set. Use `*` to
preserve the previous open-proxy behavior or list the exact functions you want
to expose.

## Public Read Proxies

The host app exposes read-only proxy endpoints for runtime data and host-driven
UI surfaces. Frontend statistics pages are intentionally hidden for now, but
the underlying endpoints remain available for controlled host usage and future
data-pipeline work:

- `GET /api/miniapp-stats`
- `GET /api/miniapp-notifications`
- `GET /api/market-trending`
- `GET /api/market/trending` (blueprint path)
- `GET /api/app/:id/news` (blueprint path)
- `GET /api/miniapp-usage` (authenticated, per-user usage)

These forward requests to the configured Edge base URL and keep response shapes
consistent for the host UI (same `EDGE_BASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` resolution as `/api/rpc/*`).

## Local Runs

### Module Federation Remotes (Optional)

This repository no longer includes a dedicated local legacy-remote workspace.
Run the host app and point `NEXT_PUBLIC_MF_REMOTES` to any reachable remote.

```bash
cd platform/host-app
NEXT_PUBLIC_MF_REMOTES=miniapp@https://cdn.example.com/miniapps/remoteEntry.js npm run dev
```

Then open:

- `http://localhost:3000/?entry_url=mf://manifest?app=miniapp-price-ticker`

### Manifest Runtime (Recommended)

MiniApps are configuration-driven and rendered by host runtime from manifest specs:

- JSON/YAML/Markdown frontend spec
- no Vue/uniapp bundle required

Open a manifest app via:

- `http://localhost:3000/launch/<app_id>`
- or `entry_url=mf://manifest?app=<app_id>`

### External Domain Runtime

The host also supports external iframe launches through canonical URLs and
normalized bare domains:

- `https://wallet.matrix/apps/swap`
- `wallet.matrix/apps/swap`
- `smartwallet.neo/console`

Bare `.matrix` / `.neo` domains are normalized to `https://...` during admin
validation, catalog ingestion, and launch rendering.

## Recommended Validation

Run the host app regression stack in sequence so `next build` and Playwright do
not race over the same `.next` directory:

```bash
npm run test:host-app:full
```

Inside `platform/host-app`, the equivalent command is:

```bash
npm run test:full
```

## Module Federation (MiniApps)

MiniApp manifests use the manifest runtime scheme:

```
mf://manifest?app=<app_id>
```

The host resolves JSON/YAML/Markdown frontend specs and renders UI directly.

## Wallet Binding + Intents

The host expects a Neo N3 browser wallet. The host UI currently supports **NeoLine N3**.

1. Install NeoLine N3 in your browser.
2. In the Settings panel:
   - set `Supabase Edge base URL`
   - paste an `Auth JWT` (Supabase session token; required for wallet binding)
3. In **Wallet Binding**:
   - click `Detect Wallet`
   - click `Get Bind Message`
   - click `Sign & Bind` (NeoLine will prompt to sign)
4. In **On-chain Intents**:
   - click `Create Intent` for `pay-gas` / `vote-neo`
   - click `Submit via Wallet` to call NeoLine `invoke`

If `pay-gas` / `vote-neo` returns `WALLET_REQUIRED`, bind a wallet first.

## Cross-Origin MiniApps

Cross-origin MiniApps launched from external domains run inside sandboxed
iframes. The host currently guarantees:

- launch support for `https://...`, bare `*.matrix`, and bare `*.neo` entry domains
- CSP `frame-src` enforcement via `MINIAPP_FRAME_ORIGINS`
- same-origin host routes for AA relay (`/api/aa/relay`) and edge RPC proxying

The host does **not** currently ship a general postMessage wallet/AA bridge for
cross-origin MiniApps. Cross-origin apps that need AA, oracle, or wallet flows
must either:

- integrate directly with the relevant public/host endpoints, or
- ship their own bridge/client logic.
