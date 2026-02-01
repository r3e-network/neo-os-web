# MiniApp SDK Guide

MiniApps must not construct or sign transactions directly. All sensitive actions flow through:

`MiniApp → Host SDK → Supabase Edge (auth/limits) → TEE services (attested) → chain (Neo N3 mainnet/testnet)`

The SDK source lives in this repo at `packages/@neo/uniapp-sdk` and is published to npm as `@r3e/uniapp-sdk`.

## Runtime Model

- The host provides `window.MiniAppSDK` (or use `@r3e/uniapp-sdk` helpers).
- MiniApps run in a sandbox (Module Federation or `iframe`) with strict CSP.
- MiniApps communicate with the host via a restricted message channel (allowlisted origins).
- If direct injection is not available, the SDK falls back to a postMessage bridge and validates origin on every response.

For UniApp/Vue, install and use:

```bash
pnpm add @r3e/uniapp-sdk
```

```ts
import { waitForSDK } from "@r3e/uniapp-sdk";
const sdk = await waitForSDK();
```

## API (Draft)

```ts
declare global {
    interface Window {
        MiniAppSDK: {
            wallet: {
                getAddress(): Promise<string>;
                // Optional: ask the host to submit a previously created invocation intent.
                // Hosts should only allow request_ids they created (one-time).
                invokeIntent?(requestId: string): Promise<unknown>;
            };
            payments: {
                // Returns a contract invocation intent. The host/wallet signs & submits.
                payGAS(
                    appId: string,
                    amountGAS: string,
                    memo?: string,
                ): Promise<{
                    request_id: string;
                    intent: "payments";
                    invocation: {
                        chain_id: string;
                        chain_type: "neo-n3";
                        contract_address: string;
                        method: string;
                        params: any[];
                    };
                }>;
            };
            governance: {
                // Returns a contract invocation intent. The host/wallet signs & submits.
                vote(
                    appId: string,
                    proposalId: string,
                    neoAmount: string,
                    support?: boolean,
                ): Promise<{
                    request_id: string;
                    intent: "governance";
                    invocation: {
                        chain_id: string;
                        chain_type: "neo-n3";
                        contract_address: string;
                        method: string;
                        params: any[];
                    };
                }>;
            };
            rng: {
                // RNG is executed inside TEE (via `neovrf`), optional on-chain anchoring.
                requestRandom(appId: string): Promise<{
                    request_id: string;
                    chain_id: string;
                    chain_type: "neo-n3";
                    randomness: string;
                    signature?: string;
                    public_key?: string;
                    attestation_hash?: string;
                }>;
            };
            datafeed: {
                // Read-only price (typically proxied from `neofeeds`).
                getPrice(symbol: string): Promise<{
                    feed_id: string;
                    pair: string;
                    price: number | string;
                    decimals: number;
                    timestamp: string;
                    sources: string[];
                    signature?: string;
                    public_key?: string;
                }>;
                // Planned: stream subscription (SSE/WebSocket) via Edge proxy.
                subscribe(symbol: string, cb: (p: any) => void): () => void;
            };
            stats: {
                // Per-user daily usage (base units; GAS uses 1e-8).
                getMyUsage(appId?: string, date?: string): Promise<any>;
            };
            events: {
                // Query indexed on-chain events (auth required).
                list(params: {
                    app_id?: string;
                    event_name?: string;
                    chain_id?: string;
                    contract_address?: string;
                    limit?: number;
                    after_id?: string;
                }): Promise<{
                    events: any[];
                    has_more: boolean;
                    last_id?: string;
                }>;
            };
            transactions: {
                // Query platform-tracked chain transactions (auth required).
                list(params: {
                    app_id?: string;
                    chain_id?: string;
                    limit?: number;
                    after_id?: string;
                }): Promise<{
                    transactions: any[];
                    has_more: boolean;
                    last_id?: string;
                }>;
            };
        };
    }
}
```

## Host-Only APIs

Host-only APIs live in the host app server code (`platform/host-app`) and the
Supabase Edge layer (`platform/edge`). They must not be exposed to untrusted
MiniApps (wallet binding, secrets, API keys, gasbank, oracle queries, compute
execution, automation triggers).

Auth can be provided either as a Supabase JWT (`Authorization: Bearer`) or as a
user API key (`X-API-Key`) via `MiniAppSDKConfig.getAPIKey`. In production,
host-only endpoints (oracle/compute/automation/secrets) require API keys with
explicit scopes; bearer JWTs are rejected there.

## On-Chain Service Requests

MiniApps that use the on-chain request/callback pattern should invoke their
MiniApp contract (or `ServiceLayerGateway`) via the wallet. The callback target
is configured per chain in the manifest (`contracts.<chain>.callback`) and
executed on-chain by the gateway when the TEE result is ready.

If you are using a **dedicated MiniApp contract** (recommended for production),
set `manifest.contracts.<chain>.address` to your deployed contract address for
each supported chain. The shared **UniversalMiniApp** contract is still
available for lightweight prototypes; in that case set
`manifest.contracts.<chain>.address` to the UniversalMiniApp address.

If you do not emit on-chain events, `contracts` can omit addresses and
`news_integration` should be disabled.
When using `useWallet.invokeRead`/`invokeContract` without passing an explicit
hash, the SDK uses the active chain's `manifest.contracts.<chain>.address`. Ensure `manifest.app_id` matches
the `APP_ID` used in your MiniApp code so SDK scoping and payments target the
same app. `app_id` must not include `:` to avoid storage key collisions.

## Contract Events for Platform Feeds

To power **news feeds** and **analytics** without custom backends, MiniApp
contracts should emit the platform-standard events:

```csharp
[DisplayName("Platform_Notification")]
public static event Action<string, string, string> OnNotification;
// notification_type, title, content (or IPFS hash)

// Optional extended signature also accepted by the platform:
// Platform_Notification(app_id, title, content, notification_type, priority)

// Recommended notification_type: "Announcement", "Alert", "Milestone", "Promo"

[DisplayName("Platform_Metric")]
public static event Action<string, BigInteger> OnMetric;
// metric_name, value

// Optional extended signature also accepted by the platform:
// Platform_Metric(app_id, metric_name, value)
```

Ensure `manifest.contracts.<chain>.address` is set so the indexer can map contract events back to the
correct MiniApp. The platform can enforce this requirement even when `app_id` is provided,
especially when news/stats are enabled.
If you do not want platform news/stats ingestion, set `news_integration=false` and omit
`stats_display` in the manifest.

## Example

```ts
const address = await window.MiniAppSDK.wallet.getAddress();

// User-signed flow: get an invocation intent from Supabase Edge, then have the wallet sign it.
const pay = await window.MiniAppSDK.payments.payGAS(
    "raffle",
    "1.5",
    "entry fee",
);
// Option A (host-specific helper): ask the host to submit the intent via the wallet.
await window.MiniAppSDK.wallet.invokeIntent?.(pay.request_id);
// Option B: host builds tx for pay.invocation and submits via wallet dAPI (NeoLine/O3/OneGate)

const { randomness, reportHash } =
    await window.MiniAppSDK.rng.requestRandom("raffle");

const price = await window.MiniAppSDK.datafeed.getPrice("BTC-USD"); // or "BTC" (defaults to BTC-USD)

const myUsage = await window.MiniAppSDK.stats.getMyUsage("raffle");
console.log(
    `Today usage: ${myUsage.tx_count} txs, ${myUsage.gas_used} (1e-8 GAS units)`,
);
```

## Payment Workflow (Important)

MiniApps follow a specific payment workflow. **Users never directly invoke MiniApp
contracts** - they only pay via the SDK, and the platform handles the rest.

### Correct Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. USER ACTION: Pay via SDK                                    │
│     SDK.payGAS(appId, amount, memo) → GAS.transfer → PaymentHub │
├─────────────────────────────────────────────────────────────────┤
│  2. PLATFORM ACTION: Process game logic                         │
│     Platform invokes MiniApp contract (recordBet, recordTickets)│
├─────────────────────────────────────────────────────────────────┤
│  3. PLATFORM ACTION: Determine outcome                          │
│     Platform uses VRF for randomness, oracle for prices         │
├─────────────────────────────────────────────────────────────────┤
│  4. PLATFORM ACTION: Send payouts                               │
│     Platform sends GAS to winners                               │
└─────────────────────────────────────────────────────────────────┘
```

### Example: Lottery MiniApp

```ts
// User buys 5 lottery tickets
const payment = await window.MiniAppSDK.payments.payGAS(
    "builtin-lottery",
    "0.5", // 0.5 GAS for 5 tickets
    "lottery:round:42:tickets:5",
);
await window.MiniAppSDK.wallet.invokeIntent?.(payment.request_id);

// That's it! The platform handles:
// - Recording tickets in MiniAppLottery contract
// - Drawing winners using VRF
// - Sending payouts to winners
```

### Why This Architecture?

1. **Security**: Users only sign GAS transfers, not arbitrary contract calls
2. **Auditability**: All payments flow through PaymentHub
3. **Simplicity**: MiniApp frontends don't need contract interaction logic
4. **Flexibility**: Platform can upgrade game logic without changing user flow

## Security Notes

- The host must strip/ignore any identity headers from MiniApps.
- Rate limits and caps are enforced on **Edge** and **TEE** (defense in depth).
- Host must enforce manifest constraints (assets/permissions/limits) at runtime.

## Builtin MiniApps

The platform includes 24 builtin MiniApps demonstrating SDK usage patterns:

| Category   | App ID                      | Description                          |
| ---------- | --------------------------- | ------------------------------------ |
| Gaming     | `builtin-lottery`           | Lottery with provable VRF randomness |
| Gaming     | `builtin-coin-flip`         | 50/50 double-or-nothing              |
| Gaming     | `builtin-dice-game`         | Roll dice, win up to 6x              |
| Gaming     | `builtin-scratch-card`      | Instant win scratch cards            |
| Gaming     | `builtin-gas-spin`          | Lucky wheel with VRF                 |
| Gaming     | `builtin-secret-poker`      | TEE Texas Hold'em                    |
| Gaming     | `builtin-fog-chess`         | Chess with fog of war                |
| DeFi       | `builtin-prediction-market` | Price movement predictions           |
| DeFi       | `builtin-flashloan`         | Instant borrow and repay             |
| DeFi       | `builtin-price-ticker`      | Real-time price feeds                |
| DeFi       | `builtin-price-predict`     | Binary options trading               |
| DeFi       | `builtin-micro-predict`     | 60-second predictions                |
| DeFi       | `builtin-turbo-options`     | Ultra-fast binary options            |
| DeFi       | `builtin-il-guard`          | Impermanent loss protection          |
| DeFi       | `builtin-ai-trader`         | Autonomous AI trading                |
| DeFi       | `builtin-grid-bot`          | Automated grid trading               |
| DeFi       | `builtin-bridge-guardian`   | Cross-chain asset bridge             |
| Social     | `builtin-red-envelope`      | Social GAS red packets               |
| Social     | `builtin-gas-circle`        | Daily savings circle                 |
| Social     | `builtin-canvas`            | Collaborative pixel art canvas       |
| Governance | `builtin-secret-vote`       | Privacy-preserving voting            |
| Governance | `builtin-gov-booster`       | NEO governance tools                 |
| Security   | `builtin-guardian-policy`   | TEE transaction security             |
| Gaming     | `builtin-nft-evolve`        | Dynamic NFT evolution                |
