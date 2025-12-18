# MiniApp Template

This folder is a **static, build-free** MiniApp template.

Contents:

- `manifest.json` (see `docs/manifest-spec.md`)
- `index.html` + `app.js`: a minimal UI that calls `window.MiniAppSDK`
- `miniapps/_shared/miniapp-bridge.js`: optional postMessage-based bridge used when the MiniApp is embedded cross-origin

Usage:

1. Copy this folder to a new MiniApp directory (builtin or community).
2. Update `manifest.json` (`app_id`, `entry_url`, `developer_pubkey`, permissions).
3. Host the files on a CDN and register the manifest via `app-register` (Edge).

When loaded in a host that injects the SDK, the template can call:

- `MiniAppSDK.wallet.getAddress()`
- `MiniAppSDK.payments.payGAS(appId, amount, memo)` → returns an invocation intent + `request_id`
- `MiniAppSDK.governance.vote(appId, proposalId, neoAmount, support)` → returns an invocation intent + `request_id`
- `MiniAppSDK.wallet.invokeIntent(request_id)` (host submits the invocation via the user wallet)
- `MiniAppSDK.datafeed.getPrice("BTC-USD")`
- `MiniAppSDK.rng.requestRandom(appId)`

The template also includes a script tag for the shared postMessage bridge
(`../../_shared/miniapp-bridge.js`), which enables `MiniAppSDK` when the host
cannot inject JS into the iframe (cross-origin).
