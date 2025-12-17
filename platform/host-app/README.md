# Host App (Next.js)

This is a minimal **Next.js** host scaffold intended to run on **Vercel**.

Planned responsibilities:

- enforce MiniApp manifest policy (permissions/limits/assets)
- sandbox MiniApps (Module Federation or `iframe`)
- strict CSP and postMessage allowlists
- provide `window.MiniAppSDK` (injected bridge)

Current state:

- `pages/index.tsx` embeds a MiniApp via `iframe` using an `entry_url` query param.
- CSP headers are set in `next.config.js` as a conservative starter.

