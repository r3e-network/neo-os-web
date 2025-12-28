# Neo N3 Mini-App Platform (Architectural Blueprint)

This document is the **reviewed, polished, and fully expanded** design blueprint.
It explicitly lists the technology stack, open-source tools, and platforms to use
for every layer, ensuring the **Payment = GAS / Governance = bNEO** constraint is
strictly enforced.

> **Core Constraints:**
>
> - **Settlement:** **GAS Only** (PaymentHub rejects all other assets).
> - **Governance:** **bNEO Only** (Voting/Staking).
> - **Confidentiality:** Service layer via **MarbleRun + EGo (SGX TEE)**.
> - **Gateway:** **Supabase** (Auth, DB, Edge).
> - **Frontend:** **Vercel** + **Next.js** + **Micro-frontends**.
> - **High-Freq Data:** **Datafeed** (Push on ≥0.1% deviation).

## 0. Platform as Backend (PaaB)

- **Host = micro-kernel**: the platform host is the kernel, MiniApps are plugins.
- **Developers ship only contracts + frontend**: indexing, analytics, and push are handled by the platform engine.
- **Event-driven UX**: standardized on-chain events feed news, metrics, and realtime notifications.

## 1. Complete Tech Stack & Tooling Selection

### A. Blockchain Layer (Neo N3)

- **Network:** Neo N3 Mainnet (Prod) / Testnet (Stage).
- **Contract Language:** **C#**.
- **Compiler/Framework:** `neo-devpack-dotnet`.
- **Local Development:** `neo-express`.
- **Testing:** `Neo.TestingFramework`.
- **Client SDK:** MiniAppSDK (TS) for Edge calls + wallet intents.
- **Wallet Integration:** NeoLine, O3, or OneGate (via dAPI).

### B. Service Layer (Confidential Computing)

- **Hardware Requirement:** Intel SGX-enabled servers (Azure Confidential Computing or bare metal).
- **Enclave Runtime:** **EGo** (Go).
- **Orchestration:** **MarbleRun**.
- **Service Language:** **Go**.
- **Networking:** gRPC or REST (attested TLS).

### C. Backend & Gateway

- **Platform:** **Supabase**.
- **Authentication:** Supabase Auth (GoTrue).
- **Database:** PostgreSQL (Supabase-managed).
- **API/Gateway:** Supabase Edge Functions (Deno).
- **Storage:** Supabase Storage.

### D. Platform Engine (Indexer + Analytics)

- **Chain syncer:** Go (preferred reuse) or Node.js (`neon-js`).
- **Event processing:** AppRegistry + MiniApp contract events.
- **Aggregation:** daily rollups, trending, and derived KPIs.
- **Realtime:** Supabase Realtime (Postgres replication) or WS relay.
- **Ops:** replay/backfill tooling, reorg handling, and metrics.

### E. Frontend Platform

- **Framework:** **Next.js**.
- **Hosting:** **Vercel**.
- **Micro-frontend Strategy:**
    - Built-ins: Module Federation (`@module-federation/nextjs-mf`).
    - 3rd Party Apps: `iframe sandbox` + `postMessage`.
- **State Management:** Zustand (SDK-side state, optional).

### F. DevOps & CI/CD

- **Repo:** GitHub (Monorepo).
- **CI Runner:** GitHub Actions.
- **Security Scanning:** `npm audit`, CSP checks, and enclave measurement builds.

## 2. Repository Structure (Monorepo)

```text
neo-miniapp-platform/
├── contracts/                  # [C#] Neo N3 Contracts
│   ├── PaymentHub/             # Logic: GAS transfer + split/withdraw (GAS ONLY)
│   ├── Governance/             # Logic: Vote/Stake (NEO ONLY)
│   ├── PriceFeed/              # Logic: Datafeed storage (0.1% trigger)
│   ├── RandomnessLog/          # Logic: VRF verification storage
│   ├── AppRegistry/            # Logic: On-chain metadata + manifest hash + Dev Allowlist
│   ├── AutomationAnchor/       # Logic: Task registry
│   └── ServiceLayerGateway/    # Logic: Service request + callback router
│
├── services/                   # [Go] EGo + MarbleRun TEE Services
│   ├── datafeed/               # High-freq polling, threshold logic
│   ├── conforacle/             # Confidential oracle fetcher
│   ├── vrf/                    # Verifiable randomness generation
│   ├── confcompute/            # Confidential compute scripts
│   ├── requests/               # On-chain request listener + callbacks
│   ├── automation/             # Scheduler + anchoring
│   ├── txproxy/                # The "Key Holder". Signs transactions.
│   ├── indexer/                # Chain syncer + event parser (non-TEE)
│   ├── aggregator/             # Daily rollups + trending (non-TEE)
│   └── marblerun/              # Manifests & policies
│
├── platform/                   # [TS] Host Platform
│   ├── host-app/               # Next.js App (The "App Store" UI)
│   ├── builtin-app/            # Built-in MiniApps (Module Federation remote)
│   ├── sdk/                    # The "MiniAppSDK" npm package
│   ├── edge/                   # [Deno] Supabase Edge Functions
│   └── rls/                    # [SQL] RLS Policies & Migrations
│
├── miniapps/                   # [React/Vue] Mini-apps
│   ├── builtin/                # Trusted apps (Coin Flip, Dice, Lottery, etc.)
│   └── templates/              # Starter kits for users
│
└── infra/                      # Infrastructure Config
    ├── neo-express/            # Local chain setup (.neo-express)
    └── ci/                     # Github Workflows
```

## 3. Core Component Design

### A. Contracts (Asset & Logic Constraints)

1. **PaymentHub.cs**
    - Hardcoded check: reject any non-GAS asset.
    - Manages developer revenue splits.
2. **Governance.cs**
    - Hardcoded check: reject any non-bNEO asset.
    - Uses bNEO (wrapped NEO) for governance staking and voting.
3. **PriceFeed.cs**
    - Stores `(Symbol, Price, Timestamp, RoundID, AttestationHash)`.
    - Enforces `RoundID` monotonicity.
    - Validates authorized updater (TEE node allowlist).
4. **RandomnessLog.cs**
    - Anchors `(RequestId, Randomness, AttestationHash, Timestamp)`.
5. **AppRegistry.cs**
    - Stores manifest hash + status + allowlist anchor hash.
6. **AutomationAnchor.cs**
    - Task registry + nonce-based anti-replay for automation tasks.
7. **ServiceLayerGateway.cs**
    - Accepts `RequestService(...)` from MiniApps.
    - Emits `ServiceRequested` events and routes callbacks via `FulfillRequest(...)`.

### B. TEE Services (The "Black Box")

All services run inside EGo enclaves. Keys **never** leave the enclave.

1. **txproxy**
    - Holds platform signing key(s).
    - Enforces contract+method allowlist and intent gates.
2. **datafeed**
    - Polls multiple sources, computes median.
    - Pushes updates when deviation ≥0.1% with hysteresis + throttling.
3. **vrf**
    - Signs `request_id` inside TEE and derives randomness from the signature.
    - Optionally anchors randomness in `RandomnessLog` via `txproxy`.
4. **confcompute**
    - Runs restricted scripts inside TEE (confidential jobs).
5. **conforacle**
    - Allowlisted HTTP fetch with optional secret injection.
6. **automation**
    - Scheduler + triggers (cron/price).
7. **requests (NeoRequests)**
    - Listens for `ServiceRequested` events.
    - Routes to VRF/Oracle/Compute and submits `FulfillRequest` callbacks via `txproxy`.

### C. Gateway (Supabase Edge)

- Stateless router + rate limiter.
- Validates Supabase Auth JWT / API keys.
- Enforces **GAS-only** (payments) and **bNEO-only** (governance).
- Uses mTLS when calling TEE services.
- Read-only market APIs: `miniapp-stats`, `miniapp-notifications`, `market-trending`.

### D. Platform Engine (Indexer + Analytics)

- **Chain syncer:** listens to every block, handles reorgs via confirmation depth and backfill.
- **Idempotency:** `processed_events` table prevents double-processing.
- **Event standard:** parses `Platform_Notification` and `Platform_Metric` events.
- **Activity:** scans `System.Contract.Call` to attribute tx activity per MiniApp (event fallback).
- **Rollups:** maintains `miniapp_tx_events`, `miniapp_stats`, `miniapp_stats_daily`, `miniapp_notifications`.
- **Realtime:** inserts trigger Supabase Realtime for client notifications.

**MiniApp Event Standard (recommended)**

```csharp
// 1) News/Notifications for platform feeds
[DisplayName("Platform_Notification")]
public static event Action<string, string, string> OnNotification;
// notification_type, title, content (or IPFS hash)
// Optional extension: Platform_Notification(app_id, title, content, notification_type, priority)

// 2) Custom metrics for analytics
[DisplayName("Platform_Metric")]
public static event Action<string, BigInteger> OnMetric;
// metric_name, value
// Optional extension: Platform_Metric(app_id, metric_name, value)
```

The manifest should include `contract_hash` so AppRegistry can anchor it; the indexer verifies the emitting
contract against the on-chain `contract_hash` cache (strict mode can require it even when `app_id` is provided).

### E. On-Chain Service Request Flow

1. MiniApp contract calls `ServiceLayerGateway.RequestService(...)`.
2. Gateway emits `ServiceRequested`.
3. NeoRequests processes the request and prepares the result.
4. NeoRequests submits `ServiceLayerGateway.FulfillRequest(...)`.
5. Gateway calls the MiniApp callback method on-chain.

## 4. Frontend & Security Sandbox

### The Host (Vercel)

- Loads mini-apps.
- Untrusted apps run in `iframe` with `sandbox` attributes.
- Uses strict CSP and a postMessage allowlist.

### The SDK (`window.MiniAppSDK`)

```ts
interface MiniAppSDK {
    getAddress(): Promise<string>;
    payments: {
        payGAS(appId: string, amount: string, memo?: string): Promise<unknown>;
    };
    governance: {
        vote(
            appId: string,
            proposalId: string,
            amount: string,
        ): Promise<unknown>;
    };
    rng: { requestRandom(appId: string): Promise<unknown> };
    datafeed: { getPrice(symbol: string): Promise<unknown> };
    stats: { getMyUsage(appId?: string, date?: string): Promise<unknown> };
}
```

## 5. Deployment & User Flow

1. Developer builds a miniapp from a starter kit and writes `manifest.json`.
2. Platform validates/sanitizes and computes `manifest_hash`.
3. MarbleRun injects secrets and manages attestation for production enclaves.

## 6. Security Checklist (4-Layer Defense)

1. SDK enforces the high-level API shape.
2. Edge enforces auth, limits, and request validation.
3. TEE enforces signing policy + allowlists.
4. Contracts enforce GAS-only / NEO-only on-chain.

## 7. MVP Roadmap

1. Infra setup (neo-express, Supabase, CI).
2. Deploy PaymentHub + AppRegistry + ServiceLayerGateway to local chain.
3. TEE skeleton (EGo hello world, txproxy, requests).
4. End-to-end `payGAS` + on-chain service request callbacks with a built-in MiniApp.
