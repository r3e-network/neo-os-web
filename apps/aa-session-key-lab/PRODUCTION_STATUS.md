# Production Status

Updated: 2026-07-11

## Ready in this frontend

- App-owned, responsive permission-object UI with one context-sensitive primary action.
- Warm light theme, quiet foreground/background separation, bounded controls, mobile layout, and reduced-motion handling.
- Repository artwork plus the official Neo Press Kit GAS mark through shared `CoinArt`.
- Canonical mainnet/testnet AA Core and SessionKeyVerifier pins.
- Live AA account existence, backup-owner, verifier binding, wallet-owner, and wallet-network checks.
- Exact registered AccountId input; legacy sample seeds are rejected instead of
  being turned into plausible but unregistered accounts.
- Mainnet 7-argument session object with spending-limit and spent-amount readback.
- Honest testnet 5-argument flow with allowance controls removed.
- Millisecond expiry submission and strict decoded readback.
- Generated private key hidden by default, copyable, and never persisted.
- Explicit configure, inspect, recover, and two-step revoke lifecycles.
- Versioned transaction journal with context-bound, read-only recovery.
- Definitive VM FAULT recovery through the saved transaction id; unavailable
  application logs remain pending.
- Read errors produce unavailable state; they never become zero, absent, active, or successful state.

## Verification gates

- Focused shared Vitest suite: 24 tests passing serially.
- Session decoder Vitest suite: 4 tests passing serially.
- App TypeScript: passing.
- App ESLint: passing with no warnings.
- App production build: 1,854 modules; entry 247.83 kB (76.53 kB gzip),
  OpenUiLite vendor 32.39 kB (11.58 kB gzip), and CSS 103.02 kB
  (18.65 kB gzip). Moving to OpenUiLite removed the prior 201.01 kB full UI
  vendor chunk.
- Non-browser HTTP smoke: all 16 built files returned HTTP 200.

## Environment-dependent checks

The frontend is production-capable, but a real write still requires all of the following at runtime:

- a registered AA account on the selected network;
- that account already bound to the canonical SessionKeyVerifier;
- its on-chain backup-owner wallet connected on the exact network;
- a wallet/provider capable of submitting the AA Core transaction;
- successful exact chain readback after broadcast.

No funded transaction, signing request, contract deployment, or browser automation was performed in this scoped lane.
