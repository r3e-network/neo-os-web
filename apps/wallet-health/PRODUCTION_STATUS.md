# Wallet Health production status

Status: production-ready as a read-only wallet checkup utility. It is not a wallet audit, transaction signer, approval manager, or private-key scanner.

## Product surface

- The first screen leads with the current read state, one connect/refresh action, NEO/GAS balances, evidence outcomes, the three primary self-checks, and at most two immediate recommendations.
- Secondary self-checks, the raw wallet address, full recommendation list, and report details stay behind disclosure controls.
- The UI uses the existing MiniApp v2 tool shell, the real Wallet Health scanner artwork, and the shared official NEO/GAS token artwork.
- Desktop and mobile layouts use a bright white foreground, high-contrast text, compact controls, visible keyboard focus, and reduced-motion support.
- Static WCAG contrast checks on the shipped palette are at least `4.87:1` for muted text, `5.00:1` for the primary button, `6.28:1` for body text, and above `7.8:1` for status copy.

## Data sources and evidence semantics

| Result | Source | Semantics |
| --- | --- | --- |
| Wallet connection | `app.wallet.observe()` | Address presence only; it does not prove wallet safety. |
| Wallet network | `app.chain.detectNetwork()` | `pass` only for a recognized Neo N3 network matching the launch target; generic/absent network data remains `unknown`; mismatch/read failure is `failed`. |
| NEO balance | `app.wallet.raw("NEO", capturedAddress)` | Independent `unknown / reading / failed / zero / pass` state. |
| GAS balance | `app.wallet.raw("GAS", capturedAddress)` | Independent `unknown / reading / failed / zero / pass` state. |
| GAS reserve | Latest successful GAS read | `pass` at or above `0.1 GAS`, low/zero otherwise; never inferred after a failed read. |
| Manual checks | `app.storage.local` | Self-confirmed browser-local progress, never an automated verdict. |

NEO, GAS, and network reads are settled independently. A partial RPC failure keeps the successful result and marks the failed item explicitly. A failed first read remains an em dash, not zero. A failed refresh may retain an older value only with a visible “previous value shown” label. Account changes clear all prior evidence, and late responses from the old account are discarded.

The connected address is Base58Check-validated before reads so a malformed host identity cannot fall through to a fake zero balance.

## Recovery and boundaries

- A wallet prompt times out after 12 seconds and returns to a retryable state.
- Each NEO, GAS, and wallet-network read times out independently after 15 seconds, allowing a partial result instead of a permanently stuck scanner.
- Refresh is idempotent per captured address while a read is in flight.
- RPC/provider internals are not shown in the primary UI; retry copy stays localized.
- Copy address and copy report are explicit user actions through the framework clipboard fallback.
- No contract is configured or required. The manifest declares only `read:blockchain`, sets `transactions: false`, and requests no payment, randomness, compute, or oracle permission.
- The app cannot inspect seed storage, connected-app approvals, device integrity, malware, exchange 2FA, or transaction intent. Those items remain clearly labeled self-checks.

## Verification

Run from the repository root unless a command specifies another directory:

```bash
npx tsc --noEmit -p apps/wallet-health/tsconfig.json
cd apps/shared && npx vitest --config vitest.config.ts run \
  test/wallet-health.playarea.test.tsx \
  test/wallet-health.logic.test.ts \
  test/wallet-health.integration.test.tsx \
  test/wallet-health.analysis.test.ts \
  test/wallet-health.production-safety.test.ts \
  test/i18n-key-parity.test.ts \
  test/official-token-assets.test.tsx
cd ../wallet-health && npm run build
```

The staged entry must return `200`, `text/html`, and load its JavaScript, stylesheet, scanner image, and official token assets with their expected MIME types.
