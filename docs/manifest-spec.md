# MiniApp Manifest Specification (Multi-chain)

This repository is evolving into a **multi-chain MiniApp Platform**. MiniApps are loaded by a host application (Next.js) and interact with supported chains (Neo N3 + EVM networks like NeoX) through the platform SDK + attested services.

## Goals

- **Payments/settlement only GAS** on Neo N3 (no other payment assets).
- **Governance only NEO** on Neo N3 (no bNEO support).
- **No direct transaction construction in MiniApps**: all sensitive actions flow through `SDK → Edge → TEE → Chain`.
- **Deterministic permissions**: each MiniApp declares capabilities; runtime enforces allowlists and limits.
- **Platform analytics**: optional metadata for notifications and stats display.

## Manifest File

- Format: JSON
- Distribution: hosted with the MiniApp bundle (CDN) and registered on-chain via `AppRegistry`
  (manifest hash + metadata stored on-chain).
- In the miniapps repo (`git@github.com:r3e-network/miniapps.git`), the **source of truth** is
  `apps/<app>/neo-manifest.json`.
- The host registry is populated from the submission pipeline (auto-approved for internal repos).

## Manifest Hashing (AppRegistry)

The platform stores a `manifest_hash` (32-byte SHA-256) on-chain in `AppRegistry`,
alongside MiniApp metadata (`name`, `description`, `icon`, `banner`, `category`,
per-chain contract address, `entry_url`, `developer_pubkey`, status). Supabase mirrors this
metadata as a cache.

In this repo, the hash is computed by **Supabase Edge** to avoid client-side
inconsistency. The canonical algorithm is implemented in:

- `platform/edge/functions/_shared/manifest.ts`

High level:

1. **Canonicalize** known fields:
    - trim `app_id`, `entry_url`, `name`, `version`
    - trim `description`, `icon`, `banner`
    - normalize `category` to lowercase
    - normalize `supported_chains` as lowercase + sort + unique
    - normalize `contracts.<chain>.address` as lowercase 20-byte hex (strip leading `0x`)
    - normalize `developer_pubkey` as lowercase hex (strip leading `0x`)
    - normalize lists as sets:
        - `assets_allowed`: uppercase + sort + unique
        - `governance_assets_allowed`: uppercase + sort + unique
        - `permissions`: validated + canonicalized deterministically
        - `sandbox_flags`: lowercase + sort + unique
        - `contracts_needed`: trim + sort + unique
        - `stats_display`: lowercase + sort + unique
    - normalize objects:
        - `limits`: normalize values to trimmed strings (for hashing stability)
    - normalize flags:
        - `news_integration`: boolean
    - normalize callback targets:
        - `contracts.<chain>.callback.address`: lowercase 20-byte hex (strip leading `0x`)
        - `contracts.<chain>.callback.method`: trim and preserve case
2. **Stable JSON** encode:
    - recursively sort all object keys lexicographically
    - omit `undefined` values
3. **Hash**:
    - `sha256(utf8(stable_json))`
    - represented as lowercase hex (no `0x`) for `ByteArray` parameters.

### Example

```json
{
    "app_id": "your-app-id",
    "entry_url": "/miniapps/neo-game/index.html",
    "name": "Neo MiniApp",
    "description": "Short summary shown in the host catalog",
    "icon": "/miniapps/neo-game/static/logo.png",
    "banner": "/miniapps/neo-game/static/banner.png",
    "category": "gaming",
    "supported_chains": ["neo-n3-mainnet", "neox-mainnet"],
    "contracts": {
        "neo-n3-mainnet": { "address": "0x1234567890abcdef1234567890abcdef12345678" },
        "neox-mainnet": { "address": "0xabcdef1234567890abcdef1234567890abcdef12" }
    },
    "version": "1.0.0",
    "developer_pubkey": "0x...",
    "permissions": {
        "wallet": ["read-address"],
        "payments": true,
        "governance": false,
        "rng": true,
        "datafeed": true,
        "storage": ["kv"]
    },
    "assets_allowed": ["GAS"],
    "governance_assets_allowed": ["NEO"],
    "limits": {
        "max_gas_per_tx": "5",
        "daily_gas_cap_per_user": "20",
        "governance_cap": "100"
    },
    "contracts_needed": ["PaymentHub", "RandomnessLog", "PriceFeed"],
    "contracts_needed": ["PaymentHub", "RandomnessLog", "PriceFeed"],
    "news_integration": true,
    "stats_display": [
        "total_transactions",
        "daily_active_users",
        "total_gas_used",
        "weekly_active_users"
    ],
    "sandbox_flags": ["no-eval", "strict-csp"],
    "attestation_required": true
}
```

## Field Definitions

### Identity

- `app_id` (string, required): globally unique identifier.
  Must match the `APP_ID` used in your MiniApp frontend/SDK calls.
  `app_id` must not include `:` to avoid storage key collisions.
- `name` (string, required): display name.
- `version` (string, required): semver.
- `developer_pubkey` (string, required): developer signing key (hex).

### Chain Support

- `supported_chains` (array, required): list of chain IDs the MiniApp supports
  (e.g. `neo-n3-mainnet`, `neox-mainnet`, `ethereum-mainnet`). Chain IDs must be
  configured in the platform chain registry.
- `contracts` (object, required when on-chain events/stats are enabled): mapping
  of `chain_id -> { address, entry_url?, active?, callback?, abi? }`.
  - `address` (string, required for on-chain events): contract address/hash on that chain.
  - `entry_url` (string, optional): per-chain entry URL override.
  - `active` (boolean, optional): disable a chain deployment without removing it.
  - `callback` (object, optional): `{ address, method }` for on-chain service callbacks.
  - `abi` (optional): ABI metadata for EVM chains if needed by clients.

### Presentation Metadata

- `description` (string, optional): short summary shown in the host catalog/app detail page.
- `icon` (string, optional): URL or emoji for the app icon.
- `banner` (string, optional): hero image URL for featured placements.
- `category` (string, optional): one of `gaming`, `defi`, `governance`, `utility`, `social`, `nft`.

### Runtime

- `entry_url` (string, required): URL to the MiniApp entry (Module Federation or `iframe`).
- `sandbox_flags` (array of strings): e.g. `no-eval`, `strict-csp`.
- `attestation_required` (bool): host must enforce enclave attestation for sensitive services.

`entry_url` supports three modes:

- `https://...` for iframe-hosted MiniApps (production CDN).
- `/miniapps/<app>/index.html` for host-served MiniApps (local/dev or packaged).
- `mf://<remote>?app=<app_id>` for Module Federation built-ins. The host resolves
  `<remote>` via `NEXT_PUBLIC_MF_REMOTES` and loads `builtin/App` without an iframe.

### Permissions

- `permissions.wallet`: allowed wallet reads (only `read-address`; no signing permissions here).
- `permissions.payments`: enables GAS payments via `PaymentHub`.
- `permissions.governance`: enables NEO governance calls via `Governance`.
- `permissions.rng`: enables VRF/RNG requests via the TEE services.
- `permissions.datafeed`: enables reading/subscribing to price feeds.
- `permissions.storage`: storage scopes (e.g. `kv`).

If you use the shorthand array form (`"permissions": ["wallet", "payments"]`),
the `wallet` entry is treated as `["read-address"]`.

### Allowlisted Assets

- `assets_allowed`: must contain only `["GAS"]`.
- `governance_assets_allowed`: must contain only `["NEO"]`.

### Limits

Suggested strings to avoid floating point ambiguity:

- `limits.max_gas_per_tx` (string): per-tx cap in GAS.
- `limits.daily_gas_cap_per_user` (string): per-user/day cap in GAS.
- `limits.governance_cap` (string): per-user governance cap (units defined by contract policy).

### Service Callbacks

These fields define the **default on-chain callback target** for service requests
triggered by the MiniApp, scoped per chain via `contracts.<chain>.callback`.

- `contracts.<chain>.callback.address` (string): contract address/hash for callbacks.
- `contracts.<chain>.callback.method` (string): method name invoked by `ServiceLayerGateway.FulfillRequest`.

If a request explicitly specifies a different callback target on-chain, the
dispatcher will enforce that it matches the manifest unless the app is
authorized for overrides.

### Contracts

- `contracts_needed`: symbolic names resolved by the host using network config (testnet/mainnet).

### Platform Analytics (Optional)

- `news_integration` (bool): enable platform news ingestion from `Platform_Notification` events.
- When `news_integration` is not explicitly `false`, `contracts.<chain>.address` is required for the active chain(s).
- `stats_display` (array of strings): preferred stat keys to show in the host UI (e.g.
  `total_transactions`, `daily_active_users`, `total_gas_used`, `weekly_active_users`). Use `[]` to hide stats.

Supported keys:

- `total_transactions`
- `total_users`
- `total_gas_used`
- `total_gas_earned`
- `daily_active_users`
- `weekly_active_users`
- `last_activity_at`

Aliases (normalized at registration):

- `tx_count` → `total_transactions`
- `gas_burned`, `gas_consumed` → `total_gas_used`

## Validation Rules (enforced by Host/Edge)

- `assets_allowed` must be exactly `["GAS"]`.
- `governance_assets_allowed` must be exactly `["NEO"]`.
- `entry_url` must use `https://` or a host-local path (`/miniapps/...`) in production unless it uses the `mf://` scheme.
- The host rejects unsafe schemes (e.g. `javascript:`, `data:`) at load time.
- `permissions` must be a strict subset of supported platform permissions.
- `limits` must be within platform policy bounds (global caps set by governance).
- `limits.daily_gas_cap_per_user` and `limits.governance_cap` are enforced by the gateway
  via `miniapp_usage_bump(...)` (daily usage tracking) or `miniapp_usage_check(...)`
  when `MINIAPP_USAGE_MODE=check`.
- `contracts.<chain>.callback.address` must be a valid 20-byte hex address/hash.
- `news_integration` (if present) must be a boolean.
- `stats_display` (if present) must be an array of supported stat keys.
- `category` (if present) must be one of `gaming`, `defi`, `governance`, `utility`, `social`, `nft`.
- `contracts.<chain>.address` must be a valid 20-byte hex address/hash and is required
  unless `news_integration=false` and no stats are requested.
