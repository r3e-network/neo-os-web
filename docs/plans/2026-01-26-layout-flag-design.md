# MiniApp Layout Flag Design

## Context
The platform hosts MiniApps inside the web host app, admin console previews, and the mobile wallet. Today, MiniApps infer layout from viewport size or embedded styles, which causes web sessions to look like scaled mobile screens. We need a deterministic layout signal so MiniApps can render a true web layout on desktop and a mobile layout in the wallet.

## Goals
- Provide an explicit `layout=web|mobile` signal in both URL params and SDK config.
- Default behavior should infer environment when the flag is missing.
- Keep legacy MiniApps working without breaking changes.
- Support federated MiniApps and iframe-based MiniApps uniformly.

## Non-Goals
- Redesign MiniApp UI themes or layouts in this change.
- Change host-side layout framing beyond exposing the layout signal.
- Enforce a single layout visually via CSS overrides.

## Decision
Use `layout=web|mobile` as the canonical flag. Hosts set it explicitly in entry URLs and SDK config. MiniApps can read it from the SDK config or query params; if missing, they infer layout from environment (wallet WebView -> mobile, otherwise web).

## Data Flow
1) **Entry URL**  
   - Host web: append `layout=web` along with `lang`, `theme`, `embedded=1`.  
   - Admin preview: same as host web.  
   - Mobile wallet: append `layout=mobile`.

2) **SDK Config**  
   - Extend `MiniAppSDKConfig` across host, wallet, and uniapp SDK to include `layout?: "web" | "mobile"`.  
   - Include `layout` in `miniapp_config` postMessage and `getConfig()` responses.

3) **Federated MiniApps**  
   - Pass `layout` prop to `FederatedMiniApp` and downstream modules.

4) **Inference Fallback**  
   - If `layout` is missing, read query param.  
   - If still missing, infer `mobile` when `window.ReactNativeWebView` exists; otherwise `web`.

## Error Handling
If `layout` is missing or invalid, default to the inference flow and do not throw.

## Testing
- Unit tests for `buildMiniAppEntryUrl` with `layout` params.  
   - Ensure it preserves existing query/hash and appends `layout`.
- Verify `miniapp_config` includes `layout` in host and wallet bridges.
- Validate builds with `pnpm build` and targeted tests for host and wallet packages.
