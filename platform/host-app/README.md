# Host App (Next.js)

**Production URL: https://neomini.app**

This **Next.js** host runs on **Vercel** and serves as the entry point for MiniApps.

Responsibilities:

- enforce MiniApp manifest policy (permissions/limits/assets) via Edge gating
- render MiniApps in the unified host-native three-column product layout
- resolve catalog manifests into shared information panels, operation panels, and per-app playareas
- strict CSP for the host runtime and platform APIs
- surface NEP-21 wallet binding, intent submission, AppRegistry workflows, Morpheus proxies, and AA relay proxying

Current capabilities:

- `/miniapps` lists the active catalog.
- `/miniapps/<app_id>` renders the Polymarket-style detail surface with host-native playareas.
- Settings UI includes wallet binding (`wallet-nonce` + `wallet-bind`) and intents (`pay-gas` / `vote-neo`).
- AppRegistry workflow for `app-register` / `app-update-manifest`.
- CSP headers set via `platform/host-app/middleware.ts` with per-request nonces.

## Production Configuration

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL for `connect-src` allowlist.
- `EDGE_RPC_ALLOWLIST`: comma-separated Edge function names that `/api/rpc/*` may call (`*` to allow all).
- `AA_RELAY_URL`: external `neo-abstract-account` relay URL used by `/api/aa/relay`.
- `MORPHEUS_PUBLIC_API_URL`: preferred Morpheus web/public API origin for host-side `/api/morpheus/*` proxies.
- `MORPHEUS_<NETWORK>_RUNTIME_URL` / `MORPHEUS_RUNTIME_URL`: preferred Morpheus runtime origin for host-side NeoDID/runtime lookups.
- `MORPHEUS_<NETWORK>_RUNTIME_TOKEN` / `MORPHEUS_RUNTIME_TOKEN` or `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`: runtime auth for protected Morpheus endpoints.

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
- `${NEXT_PUBLIC_EDGE_URL}/functions/v1/<fn>` (public Edge gateway), or
- `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/<fn>` (fallback)

Set `EDGE_BASE_URL` to one of:

- `https://<project>.supabase.co/functions/v1`
- `http://localhost:8787/functions/v1` (repo Edge dev server)

The `/api/rpc/relay` alias accepts `fn` via query string or JSON body and
forwards the remaining payload to the named Edge function.

The `/api/aa/relay` route forwards relay-ready AA payloads to the configured
external `AA_RELAY_URL`, keeping MiniApps on the same origin while the AA relay
runtime remains external to this repo.

Host-side Morpheus proxy routes now prefer the unified Morpheus runtime/public
API model:

- public/web API: `oracle.meshmini.app/mainnet` or `oracle.meshmini.app/testnet`
- runtime: `oracle.meshmini.app/mainnet` / `oracle.meshmini.app/testnet`
- edge fallback: `edge.meshmini.app/<network>`
- control-plane ingress: `control.meshmini.app/<network>`
- Oracle attestation explorer: `https://cloud.phala.com/explorer/app_ddff154546fe22d15b65667156dd4b7c611e6093`
- DataFeed attestation explorer: `https://cloud.phala.com/explorer/app_ac5b6886a2832df36e479294206611652400178f`

Legacy split-service env vars are still tolerated by the platform edge layer,
but they are no longer the preferred production model.

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

### Manifest Runtime (Recommended)

MiniApps are configuration-driven and rendered by the host runtime from manifests plus the playarea registry:

- JSON/YAML/Markdown frontend spec
- per-app host-native playarea
- no separate remote shell required

Open a manifest app via:

- `http://localhost:3000/miniapps/<app_id>`

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

## Manifest Runtime (MiniApps)

MiniApp manifests use the manifest runtime scheme:

```
mf://manifest?app=<app_id>
```

The host resolves JSON/YAML/Markdown frontend specs and renders UI directly.

## Wallet Binding + Intents

The host expects a Neo N3 browser wallet. The host UI supports **NEP-21 dAPI wallets** first, with **NeoLine N3**, **O3**, and **OneGate** compatibility paths.

1. Install a NEP-21-compatible Neo N3 wallet, or NeoLine N3 as a legacy fallback.
2. In the Settings panel:
   - set `Supabase Edge base URL`
   - paste an `Auth JWT` (Supabase session token; required for wallet binding)
3. In **Wallet Binding**:
   - click `Detect Wallet`
   - click `Get Bind Message`
   - click `Sign & Bind` (the selected wallet will prompt to sign)
4. In **On-chain Intents**:
   - click `Create Intent` for `pay-gas` / `vote-neo`
   - click `Submit via Wallet` to call NEP-21 `invoke` or the legacy wallet invoke API

If `pay-gas` / `vote-neo` returns `WALLET_REQUIRED`, bind a wallet first.
