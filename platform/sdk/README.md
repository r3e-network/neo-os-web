# MiniApp SDK (Scaffold)

This package is a small TypeScript SDK scaffold matching the platform blueprint:

- MiniApps do not talk to the chain directly.
- Calls go to **Supabase Edge**, which enforces policy and either:
  - returns an invocation for the wallet to sign (user-signed flows), or
  - forwards to a TEE service (RNG/compute/oracle).

Code lives under `platform/sdk/src/`.

## Usage

```ts
import { createMiniAppSDK } from "@neo-miniapp/sdk";

const sdk = createMiniAppSDK({
  edgeBaseUrl: "https://<project>.supabase.co/functions/v1",
  getAuthToken: async () => "<supabase-jwt>",
});

await sdk.payments.payGAS("my-app", "1.5", "entry fee");
await sdk.governance.vote("my-app", "proposal-1", "10", true);
await sdk.rng.requestRandom("my-app");
await sdk.datafeed.getPrice("BTC-USD");
```

## `window.MiniAppSDK`

`platform/sdk/src/window.ts` contains a helper to install the SDK on `window`.

