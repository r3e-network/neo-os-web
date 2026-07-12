# Wallet Health MiniApp

Wallet Health is a read-only Neo N3 wallet checkup and a device-local security self-check. It is intentionally evidence-scoped: the app can observe wallet connection plus NEO/GAS balances, but it cannot audit private keys, recovery-phrase storage, connected-app approvals, device security, malware, or transaction intent.

## What it does

- Connects through the host wallet surface.
- Independently reads NEO and GAS balances for the captured wallet address and checks the connected wallet network.
- Marks whether the observed GAS balance is at least `0.1 GAS`.
- Stores manual checklist confirmations in browser-local storage.
- Exports a plain-text report containing read-only observations and self-confirmed answers.
- Reacts to account switches and disconnects by clearing old evidence; a failed refresh can retain a previous value only with an explicit stale label.
- Returns a stalled wallet prompt to a retryable state after 12 seconds.
- Times out each stalled NEO, GAS, or wallet-network read independently after 15 seconds.

## What it never does

- It does not invoke a contract or send a transaction.
- It does not request payment, randomness, oracle, or TEE permissions.
- It does not read or ask for a private key or recovery phrase.
- It does not read or revoke wallet approvals.
- Checklist completion is progress, not a security score or guarantee.

## Privacy

Checklist choices use the legacy-compatible local key `miniapp-wallet-health:checklist`. The app does not send them to a backend. Wallet address and balances are requested only after connection. Copying a report is an explicit user action and places the report on the clipboard.

## Runtime states

| State | User-facing behavior |
|---|---|
| Disconnected | Balances remain `—`; no risk verdict is shown. |
| Connecting | The connect action is single-flight and visibly busy. |
| Fresh | Each read is explicitly `zero` or `pass`; wallet-network match is shown separately. |
| Partial | A successful asset remains visible while the failed asset stays `failed`, never fake zero. |
| Read error | The failed evidence is shown inline and can be retried safely. A first failure remains `—`. |
| Account change/disconnect | In-flight results are invalidated and chain evidence is cleared. |

## Development

```bash
npm run dev
npx tsc --noEmit -p apps/wallet-health/tsconfig.json
npx vitest run test/wallet-health.playarea.test.tsx test/wallet-health.logic.test.ts test/wallet-health.integration.test.tsx test/wallet-health.analysis.test.ts test/wallet-health.production-safety.test.ts
npm run build
```

See `PRODUCTION_STATUS.md` for the complete evidence matrix and release gates. No miniapp contract is deployed or required.
