# MiniApp SDK Guide

MiniApps must not construct or sign Neo transactions directly. All sensitive actions flow through:

`MiniApp → Host SDK → Supabase Edge (auth/limits) → TEE services (attested) → Neo N3 chain`

Since **MiniApp-OS v2**, the preferred path for most operations uses OS service
proxies:

`MiniApp → ctx.os.<service>() → EdgeClient → OS Binder Edge Function → OS Contract → Neo N3 chain`

## Runtime Model

- The host provides `window.MiniAppSDK` for legacy host-injected operations.
- MiniApps run in a sandbox (Module Federation or `iframe`) with strict CSP.
- MiniApps communicate with the host via a restricted message channel (allowlisted origins).
- **All new miniapps use `defineMiniApp()`** with `ctx.os.*` for OS services and
  `ctx.services.*` for platform services. There are zero legacy `App.legacy.vue`
  files remaining.

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
                        contract_hash: string;
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
                        contract_hash: string;
                        method: string;
                        params: any[];
                    };
                }>;
            };
            rng: {
                // RNG is executed inside TEE (via `neovrf`), optional on-chain anchoring.
                requestRandom(appId: string): Promise<{
                    request_id: string;
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
                    contract_hash?: string;
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

## OS Service Proxies (MiniApp-OS v2)

The preferred way for miniapps to interact with platform services is through the
OS proxy layer, accessible via `ctx.os.*` inside `defineMiniApp()`:

```ts
defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    // Storage
    await ctx.os.storage.set("key", value)
    const data = await ctx.os.storage.get("key")

    // Payments
    await ctx.os.payment.deposit(amount)
    const balance = await ctx.os.payment.getBalance()
    await ctx.os.payment.withdraw(amount)

    // Games
    await ctx.os.game.createPool(config)
    await ctx.os.game.placeBet(poolId, amount)
    const state = await ctx.os.game.getPoolState(poolId)

    // Check-in
    await ctx.os.checkin.checkIn()
    const streak = await ctx.os.checkin.getStreak()  // returns CheckinData
    await ctx.os.checkin.claimRewards()

    // Badges
    await ctx.os.badge.award(badgeId, user)
    const badges = await ctx.os.badge.list()

    // Leaderboard
    await ctx.os.leaderboard.submit(score)
    const top = await ctx.os.leaderboard.get(limit)

    // NFTs
    await ctx.os.nft.mint(owner, metadata)
    const tokens = await ctx.os.nft.list(owner)
    await ctx.os.nft.validate(tokenId)  // ticket mode

    // Escrow
    await ctx.os.escrow.create(params)
    await ctx.os.escrow.fund(escrowId)
    await ctx.os.escrow.completeMilestone(escrowId, index)

    // Vesting
    await ctx.os.vesting.create(schedule)
    await ctx.os.vesting.claim()

    // ScriptEngine (dev only)
    await ctx.os.script.register(hookPoint, nefBytes, manifestBytes)
    const hooks = await ctx.os.script.list()
  }
})
```

### OS Proxy Architecture

All OS proxies extend `OSServiceProxy` and use `EdgeClient` as the Binder
transport:

1. Proxy calls `EdgeClient.call(endpoint, params)`
2. `EdgeClient` adds `appId` to every request (cannot be forged by the browser)
3. Request hits one of the 45 `os-*` edge functions
4. Edge function validates auth, permissions, and rate limits
5. Edge function calls the OS contract via Neo N3 RPC
6. Result flows back to the miniapp

### Available Types

- `CheckinData` — `{ currentStreak, highestStreak, totalCheckins, lastCheckinTime, unclaimedRewards, totalClaimed }`
- `OSServices` — interface for all 10 OS proxy classes

## Host-Only APIs

The `platform/sdk` also exposes a host-only client (`HostSDK`) for workflows that
must not be exposed to untrusted MiniApps (wallet binding, secrets, API keys,
gasbank, oracle queries, compute execution, automation triggers).

Auth can be provided either as a Supabase JWT (`Authorization: Bearer`) or as a
user API key (`X-API-Key`) via `MiniAppSDKConfig.getAPIKey`. In production,
host-only endpoints (oracle/compute/automation/secrets) require API keys with
explicit scopes; bearer JWTs are rejected there.

## On-Chain Service Requests

Preferred runtime path:

- use direct Oracle / direct AA through the host SDK and edge/host proxies

Legacy callback path:

- MiniApps that still use an on-chain request/callback pattern should invoke
  their own MiniApp contract or the upstream Oracle / automation contract
  directly via the wallet. The callback target is configured in the manifest
  (`callback_contract`, `callback_method`) and executed on-chain by the
  upstream service when the result is ready.

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

Ensure `manifest.contract_hash` is set so the platform can map contract events back to the
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

### Current Production Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. USER ACTION: SDK returns the right transfer target              │
│     - direct prepaid flow → GAS.transfer → MiniApp contract         │
├──────────────────────────────────────────────────────────────────────┤
│  2. USER ACTION: invoke the MiniApp contract                        │
│     - contract consumes credited GAS / asset balance                │
├──────────────────────────────────────────────────────────────────────┤
│  3. CONTRACT / ORACLE ACTION: resolve app state                     │
│     Contract updates state, requests Oracle / VRF if needed         │
├──────────────────────────────────────────────────────────────────────┤
│  4. CONTRACT ACTION: emit settlement / payout result                │
│     Events and direct token transfers become the audit trail        │
└──────────────────────────────────────────────────────────────────────┘
```

### Example: Lottery MiniApp

```ts
// User buys 5 lottery tickets
const payment = await window.MiniAppSDK.payments.payGAS(
    "miniapp-lottery",
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

1. **Security**: the SDK constrains transfer targets and methods by manifest policy.
2. **Auditability**: payment transfers, Oracle requests, and final settlement all remain on-chain.
3. **Flexibility**: the transfer payload can still carry app-specific routing memo data.
4. **Simplicity**: there is no extra settlement hub between the user and the MiniApp contract.

## Security Notes

- The host must strip/ignore any identity headers from MiniApps.
- Rate limits and caps are enforced on **Edge** and **TEE** (defense in depth).
- Host must enforce manifest constraints (assets/permissions/limits) at runtime.

## Platform MiniApps

The platform includes 24 platform MiniApps demonstrating SDK usage patterns:

| Category   | App ID                      | Description                          |
| ---------- | --------------------------- | ------------------------------------ |
| Gaming     | `miniapp-lottery`           | Lottery with provable VRF randomness |
| Gaming     | `miniapp-fogplay`         | 50/50 double-or-nothing              |
| Gaming     | `miniapp-dicegame`         | Roll dice, win up to 6x              |
| Gaming     | `miniapp-scratch-card`      | Instant win scratch cards            |
| Gaming     | `miniapp-gas-spin`          | Lucky wheel with VRF                 |
| Gaming     | `miniapp-secret-poker`      | TEE Texas Hold'em                    |
| Gaming     | `miniapp-fog-chess`         | Chess with fog of war                |
| DeFi       | `miniapp-predictionmarket` | Price movement predictions           |
| DeFi       | `miniapp-flashloan`         | Instant borrow and repay             |
| DeFi       | `miniapp-price-ticker`      | Real-time price feeds                |
| DeFi       | `miniapp-price-predict`     | Binary options trading               |
| DeFi       | `miniapp-micro-predict`     | 60-second predictions                |
| DeFi       | `miniapp-turbo-options`     | Ultra-fast binary options            |
| DeFi       | `miniapp-il-guard`          | Impermanent loss protection          |
| DeFi       | `miniapp-ai-trader`         | Autonomous AI trading                |
| DeFi       | `miniapp-grid-bot`          | Automated grid trading               |
| DeFi       | `miniapp-bridge-guardian`   | Cross-chain asset bridge             |
| Social     | `miniapp-redenvelope`      | Social GAS red packets               |
| Social     | `miniapp-gascircle`        | Daily savings circle                 |
| Social     | `miniapp-canvas`            | Collaborative pixel art canvas       |
| Governance | `miniapp-secretvote`       | Privacy-preserving voting            |
| Governance | `miniapp-gov-booster`       | bNEO governance tools                |
| Security   | `miniapp-guardian-policy`   | TEE transaction security             |
| Gaming     | `miniapp-nft-evolve`        | Dynamic NFT evolution                |
# Note

The current flagship direction (MiniApp-OS v2) is:

- **OS service calls** (`ctx.os.*`) for payment, storage, game, badge, checkin,
  leaderboard, escrow, NFT, and vesting workflows
- **ScriptEngine** hooks for custom on-chain logic without standalone contracts
- direct Morpheus Oracle callbacks for async Oracle/VRF/compute service flows
- direct AA relay integration where sponsored / verifier-aware execution is needed
