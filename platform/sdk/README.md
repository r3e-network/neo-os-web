# MiniApp SDK

**Platform: https://neomini.app**

This package is the TypeScript SDK matching the platform blueprint:

- MiniApps do not talk to the chain directly.
- Calls go to **Supabase Edge**, which enforces policy and returns an
  invocation for the wallet to sign (user-signed flows).
- The preferred platform architecture is direct Oracle / direct AA. The old
  TEE-forwarding gateway lane (RNG/data feed/oracle fetch/compute/privacy
  relay) is retired — see [Retired Gateway Endpoints](#retired-gateway-endpoints).
- AA relay integration is intentionally kept outside the core SDK surface today;
  the platform consumes it through `useAbstractAccount()` and the host
  `/api/aa/relay` proxy backed by `AA_RELAY_URL`.

Code lives under `platform/sdk/src/`.

## Usage

```ts
import { createHostSDK, createMiniAppSDK } from "@neo-miniapp/sdk";

const sdk = createMiniAppSDK({
  edgeBaseUrl: "https://<project>.supabase.co/functions/v1",
  getAuthToken: async () => "<supabase-jwt>",
  appId: "my-app", // optional default for stats.getMyUsage
});

await sdk.payments.payGAS("my-app", "1.5", "entry fee");
await sdk.governance.vote("my-app", "proposal-1", "10", true);
await sdk.stats.getMyUsage(); // uses appId from config when provided
```

Notes:

- `payGAS` / `vote` return an `invocation` intent plus a `request_id`. The host (or wallet integration) should sign and submit the invocation.
- This SDK also exposes:
  - `sdk.wallet.getProviderInfo()` to identify NEP-21, NeoLine, or EIP-1193 wallet context
  - `sdk.wallet.signMessage(message)` for wallet-auth and binding flows
  - `sdk.wallet.invokeInvocation(invocation)` (NEP-21 dAPI first, NeoLine N3 fallback)
  - `sdk.wallet.invokeIntent(request_id)` for intents created during this session
  - `sdk.payments.payGASAndInvoke(...)` / `sdk.governance.voteAndInvoke(...)` convenience helpers
  - `sdk.stats.getMyUsage(appId?, date?)` for per-user daily usage (base units)

## Errors

All edge responses are surfaced as typed `SDKError`s:

```ts
import { SDKError } from "@neo-miniapp/sdk";

try {
  await sdk.payments.payGAS("my-app", "1.5");
} catch (err) {
  if (err instanceof SDKError) {
    console.error(err.status, err.code, err.path, err.body);
  }
}
```

- `status`: HTTP status of the failed request (`0` when the request was never
  sent, e.g. a missing API key for a host-only endpoint).
- `code`: server-provided error code when the body matches the edge
  `{ error: { code, message } }` shape; otherwise a synthetic code
  (`HTTP_<status>`, `INVALID_JSON`, `NON_OBJECT_RESPONSE`,
  `API_KEY_REQUIRED`, `ENDPOINT_RETIRED`).
- `path`: the requested edge path (e.g. `/pay-gas`).
- `body`: the server body, preserved as parsed JSON when possible and as raw
  text otherwise.

## Retired Gateway Endpoints

The TEE-forwarding lane was removed from Supabase Edge when the platform
moved to the Morpheus oracle runtime and self-contained miniapp contracts.
The SDK keeps the method surface so existing callers fail loudly: each method
below throws an `SDKError` with `code: "ENDPOINT_RETIRED"` (status 410)
instead of hitting a non-existent edge function.

| Method | Replacement |
| --- | --- |
| `sdk.rng.requestRandom(...)` | On-chain randomness (`Runtime.GetRandom`) in your miniapp contract |
| `sdk.datafeed.getPrice(...)` | On-chain MorpheusDataFeed contract (`getLatest`); see `apps/shared/composables/useMorpheusDataFeed.ts` |
| `sdk.privacy.getMerklePath(...)` / `sdk.privacy.relay(...)` | None — the privacy relayer gateway was removed |
| `host.oracle.query(...)` | Morpheus oracle runtime (`oracle.query` workflow) |
| `host.compute.execute(...)` / `listJobs()` / `getJob(...)` | Morpheus oracle runtime TEE compute |

## Automation (Host-only)

NeoFlow manages user triggers (currently cron + webhook execution in the service).

```ts
const host = createHostSDK({
  edgeBaseUrl: "https://<project>.supabase.co/functions/v1",
  getAPIKey: async () => "<host-api-key>",
});

const trigger = await host.automation.createTrigger({
  name: "Every 5 minutes",
  trigger_type: "cron",
  schedule: "*/5 * * * *",
  action: {
    type: "webhook",
    url: "https://hooks.miniapps.com/callback",
    method: "POST",
  },
});

const executions = await host.automation.listExecutions(trigger.id, 25);
console.log(trigger.enabled, executions.length);
```

## Wallet Binding (OAuth-first onboarding)

When a user logs in via Supabase OAuth, the platform can require them to bind a
Neo N3 address before using on-chain services:

```ts
const host = createHostSDK({
  edgeBaseUrl: "https://<project>.supabase.co/functions/v1",
  getAuthToken: async () => "<supabase-jwt>",
});

const { nonce, message } = await host.wallet.getBindMessage();

// Host app: ask wallet to sign `message` and provide publicKey+signature
await host.wallet.bindWallet({
  address: "<neo-n3-address>",
  publicKey: "<hex or base64>",
  signature: "<hex or base64>",
  message,
  nonce,
  label: "Primary",
});
```

## Secrets (Host-only)

Secrets are host-only and should not be exposed to untrusted MiniApps:

Host-only endpoints require an API key with explicit scopes in production.

```ts
await host.secrets.upsert("binance_api_key", "<secret-value>");
await host.secrets.setPermissions("binance_api_key", ["neooracle"]);
const list = await host.secrets.list();
```

## App Submission (Host-only)

Developer app registration is wallet-signed and routed via Supabase Edge:

```ts
const manifest = {
  app_id: "com.miniapps.arcade",
  entry_url: "https://cdn.miniapps.com/apps/neo-game/index.html",
  name: "Neo Arcade",
  version: "1.0.0",
  developer_pubkey: "0x" + "<33-byte compressed pubkey hex>",
  permissions: { payments: true, governance: false, rng: true, datafeed: true },
  assets_allowed: ["GAS"],
  governance_assets_allowed: ["BNEO"],
  sandbox_flags: ["no-eval", "strict-csp"],
  attestation_required: true,
};

const res = await host.apps.register({ manifest });
// Host app: build/sign tx using res.invocation (NEP-21/NeoLine/O3/OneGate) and submit.
```

## `window.MiniAppSDK`

`platform/sdk/src/window.ts` contains a helper to install the SDK on `window`.
