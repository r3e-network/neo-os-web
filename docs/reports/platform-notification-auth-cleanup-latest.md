# Platform Notification/Auth Cleanup

Date: 2026-06-01

## Result

The host no longer makes protected notification or wallet-auth requests when the local browser does not actually have a wallet session token or edge auth base URL.

## Frontend Evidence

Validated through the live frontend at:

`http://127.0.0.1:3000/miniapps/forever-album?network=testnet`

After connecting the local developer-key wallet:

- `Wallet Ready`: visible
- `/api/notifications/events`: no calls
- `/auth-wallet-nonce`: no calls
- Visible wallet auth error: none

## Fixes Applied

- `NotificationDropdown` now checks for an actual wallet session token before calling protected notification APIs.
- `fetch-client` exports `getWalletSessionToken()` so components can distinguish a connected wallet from an authenticated wallet session.
- Local developer-key wallet login now gracefully degrades when edge wallet auth is not configured instead of probing `/auth-wallet-nonce` as a broken relative URL.

## Verification

- `npm --prefix neo-os-web/platform/host-app test -- --runInBand __tests__/lib/auth.store.env.test.ts __tests__/components/NotificationDropdown.test.tsx __tests__/lib/fetch-client.test.ts`
- `npm --prefix neo-os-web/platform/host-app run typecheck`
