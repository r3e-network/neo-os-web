# Forever Album Frontend Validation

Date: 2026-06-01
Network: Neo N3 Testnet
Wallet: `NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu`

## Result

- Embedded Forever Album now receives the host wallet through the sandboxed wallet bridge.
- The host detail page now exposes a real `Open upload workspace` submit button instead of being the only no-submit row in the host button audit.
- The host button forwards `privacy=public|encrypted` into the embedded uploader, and the dApp applies it to the actual `Encrypt photos` upload toggle.
- Upload flow reaches the explicit `Confirm Neo transaction` review modal.
- The OS storage intent is lower-camel and matches the generated Morpheus kernel ABI: `putMiniAppState`.
- Real testnet submission cannot broadcast yet because the currently deployed Morpheus Oracle at `0x4b882e94ed766807c4fd728768f972e13008ad52` does not expose miniapp state methods.
- The UI now keeps that failure visible in the upload panel instead of only relying on a transient toast.

## Frontend Evidence

- Page: `http://127.0.0.1:3000/miniapps/forever-album?network=testnet`
- Host wallet status: `Wallet Ready`
- Embedded iframe: `data-wallet-bridge="neo-miniapp-host"`
- Edge fallback response: `200`, `operation: "putMiniAppState"`
- Preflight RPC result: `FAULT`
- RPC exception: `Method "putMiniAppState" with 3 parameter(s) doesn't exist in the contract 0x4b882e94ed766807c4fd728768f972e13008ad52.`

Screenshots:

- `docs/reports/forever-album-real-tx-validation-lowercamel.png`
- `docs/reports/forever-album-real-tx-validation-after-open-wallet.png`
- `docs/reports/forever-album-storage-kernel-error-banner.png`
- `docs/reports/forever-album-host-upload-action-after.png`
- `docs/reports/forever-album-embedded-encrypted-launch-after.png`
- `docs/reports/forever-album-mobile-upload-action-after.png`
- `docs/reports/forever-album-host-upload-validation.json`

## Contract Evidence

Direct `getcontractstate` on testnet shows the deployed `0x4b882e94ed766807c4fd728768f972e13008ad52` manifest currently exposes oracle request methods such as `request`, `requestFromCallback`, `queueAutomationRequest`, and `fulfillRequest`, but not `putMiniAppState`, `getMiniAppState`, or `deleteMiniAppState`.

The repo's generated Morpheus kernel artifact does include the new OS methods in lower camel case, so the remaining blocker is deployment/config alignment, not the embedded frontend wallet handoff.

## Fixes Applied

- Added a host wallet bridge for sandboxed embedded miniapps.
- Added local host fallback intents for OS storage when the edge base URL is not configured.
- Normalized Morpheus kernel operation names to lower camel case.
- Added a persistent Forever Album upload error panel for failed wallet/kernel writes.
- Added a PlayArea regression test for the persistent upload error.
- Added a host fallback operation for the real embedded upload workspace.
- Added Forever Album launch-param parsing for `privacy`, `mode`, `visibility`, `encrypted`, and `isEncrypted`.
- Added a PlayArea regression test proving `privacy=encrypted` and `privacy=public` update the embedded upload toggle.

## Verification

- `npm --prefix neo-os-web run -s build:miniapp-dapps -- forever-album`
- `npm --prefix neo-os-web run -s stage:miniapps:dist -- forever-album`
- `npm --prefix neo-os-web/platform/host-app run typecheck`
- `npm --prefix neo-os-web/platform/host-app test -- --runInBand __tests__/api/edge.proxy.test.ts __tests__/components/PlayAreaRegistry.test.tsx`
- `cd neo-os-web/apps/shared && npx vitest run test/forever-album.playarea.test.tsx test/wallet-sdk-nep21.test.ts`
- `cd neo-os-web/apps/shared && npx vitest run test/forever-album.playarea.test.tsx`
- `cd neo-os-web/platform/host-app && npm test -- --runInBand __tests__/components/PlayAreaRegistry.test.tsx`

## Host Upload Workspace Refresh

Date: 2026-06-01 07:38 CST / 2026-05-31T23:38Z

- Host button present: yes
- Clicked `Open upload workspace` through the host Action Console.
- Result URL included `operation=prepareMiniAppOperation&privacy=encrypted`.
- Embedded iframe changed from public mode to encrypted mode.
- Direct embedded launch with `privacy=encrypted` also showed `Encrypt photos` checked.
- Browser console errors: 0
- Page errors: 0
- Real network failures: 0
- Visible overflow: desktop host 0, host after action 0, embedded iframe 0, direct embedded 0, mobile host 0
