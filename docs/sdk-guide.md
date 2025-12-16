# MiniApp SDK Guide

MiniApps must not construct or sign Neo transactions directly. All sensitive actions flow through:

`MiniApp → Host SDK → Supabase Edge (auth/limits) → TEE services (attested) → Neo N3 chain`

## Runtime Model

- The host provides `window.MiniAppSDK`.
- MiniApps run in a sandbox (Module Federation or `iframe`) with strict CSP.
- MiniApps communicate with the host via a restricted message channel (allowlisted origins).

## API (Draft)

```ts
declare global {
  interface Window {
    MiniAppSDK: {
      wallet: {
        getAddress(): Promise<string>;
      };
      payments: {
        payGAS(appId: string, amountGAS: string, memo?: string): Promise<{ txHash: string }>;
      };
      governance: {
        vote(appId: string, proposalId: string, neoAmount: string, memo?: string): Promise<{ txHash: string }>;
      };
      rng: {
        requestRandom(appId: string): Promise<{ randomness: string; reportHash: string }>;
      };
      datafeed: {
        getPrice(symbol: string): Promise<{ symbol: string; price: string; ts: number; roundId: string }>;
        subscribe(symbol: string, cb: (p: any) => void): () => void;
      };
    };
  }
}
```

## Example

```ts
const address = await window.MiniAppSDK.wallet.getAddress();

await window.MiniAppSDK.payments.payGAS("raffle", "1.5", "entry fee");

const { randomness, reportHash } = await window.MiniAppSDK.rng.requestRandom("raffle");

const price = await window.MiniAppSDK.datafeed.getPrice("BTC-USD");
```

## Security Notes

- The host must strip/ignore any identity headers from MiniApps.
- Rate limits and caps are enforced on **Edge** and **TEE** (defense in depth).
- Host must enforce manifest constraints (assets/permissions/limits) at runtime.

