# Host App (Next.js)

This is a minimal **Next.js** host scaffold intended to run on **Vercel**.

Planned responsibilities:

- enforce MiniApp manifest policy (permissions/limits/assets)
- sandbox MiniApps (Module Federation or `iframe`)
- strict CSP and postMessage allowlists
- provide `window.MiniAppSDK` (injected bridge)

Current state:

- `pages/index.tsx` embeds a MiniApp via `iframe` (configure via UI or `entry_url` query param).
- For **same-origin** MiniApps (served from `public/`), the host can inject a `window.MiniAppSDK`
  object into the iframe for local demos.
- The Settings UI also includes a minimal **wallet binding** flow (`wallet-nonce` + `wallet-bind`)
  and an **on-chain intent** demo (`pay-gas` / `vote-neo` + NeoLine `invoke`).
- The host UI includes a minimal **AppRegistry** demo (`app-register` / `app-update-manifest`).
- CSP headers are set in `next.config.js` as a conservative starter.

## Local Demos

This repo includes a couple of static demo MiniApps under:

- `platform/host-app/public/miniapps/builtin/price-ticker/`
- `platform/host-app/public/miniapps/community/template/`
- `platform/host-app/public/miniapps/_shared/` (shared bridge script used by the static demos)

These are exported from `miniapps/` for convenience. To refresh them:

```bash
./scripts/export_host_miniapps.sh
```

`npm run dev` and `npm run build` run this export automatically (`predev`/`prebuild`).

Run:

```bash
cd platform/host-app
npm run dev
```

Then open:

- `http://localhost:3000/?entry_url=/miniapps/builtin/price-ticker/index.html`

To use authenticated endpoints (e.g. RNG), set the Edge base URL and JWT/API key
in the Settings panel.

## Wallet Binding + Intents (Demo)

The host expects a Neo N3 browser wallet. The demo UI currently supports **NeoLine N3**.

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

The host **cannot** directly inject JS into a cross-origin iframe. For production
MiniApps hosted on a CDN, the SDK must be bundled into the MiniApp itself, or
you must implement a postMessage bridge with strict origin allowlists.

This scaffold includes a minimal postMessage-based bridge:

- Host handler: `platform/host-app/pages/index.tsx`
- MiniApp script: `platform/host-app/public/sdk/miniapp-bridge.js`

Bridge notes:

- `payments.payGAS(...)` / `governance.vote(...)` return an `invocation` intent plus a `request_id`.
- MiniApps can then call `wallet.invokeIntent(request_id)` to ask the host to submit that intent via NeoLine.
  The host only allows invoking intents it previously created (in-memory, one-time).

MiniApps can include the script from the host origin:

```html
<script src="https://<host>/sdk/miniapp-bridge.js"></script>
```

The host only responds to requests from the currently embedded iframe and the
expected origin derived from `entry_url`.
