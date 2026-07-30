<p align="center">
  <strong>Yiwu MiniApps</strong>
</p>

<p align="center">
  <a href="https://neomini.app"><img src="https://img.shields.io/badge/Live-neomini.app-00E599?style=flat-square" alt="Live"/></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick%20Start-Guide-00E599?style=flat-square" alt="Quick Start"/></a>
  <a href="docs/ARCHITECTURE.md"><img src="https://img.shields.io/badge/Docs-Architecture-00D9FF?style=flat-square" alt="Architecture"/></a>
  <a href="#platform-contracts"><img src="https://img.shields.io/badge/Network-Neo%20N3-blue?style=flat-square" alt="Neo N3"/></a>
  <a href="https://github.com/r3e-network/neo-miniapp-platform"><img src="https://img.shields.io/badge/Yiwu-MiniApps-00E599?style=flat-square" alt="Yiwu MiniApps"/></a>
</p>

---

# Yiwu MiniApps

Yiwu (义乌) is a Neo N3 MiniApp platform inspired by the world's small-commodity
market: many small, focused, practical apps, each polished for a specific user
scenario. The platform keeps the **Android OS-style system service architecture**
(MiniApp-OS v2): host UX, admin tooling, partial C# platform domain contracts,
42 edge proxy functions, 9 typed frontend OS proxy classes, and integration with the externally deployed
Morpheus Oracle and Abstract Account stacks.

## Repository Boundary

This repository no longer owns the full Go service layer runtime.

The attested Oracle, DataFeed, confidential compute, paymaster, and AA service logic now live in the dedicated upstream repos:

- `neo-os-services`
- `neo-abstract-account`

This repository should be treated as:

- the MiniApp host application
- the admin console
- **7 platform contracts** under `contracts/platform/` (PlatformAnchor, PlatformDeFi, PlatformGame, PlatformSocial, PlatformRegistry, AppAccount, MiniAppFactory)
- **34 legacy per-app `MiniApp*` contracts** plus the source-shared `MiniApp.DevPack` base, pending absorption into the Platform Contract Library v2 engine estate
- **42 OS Binder edge functions** for secure service access
- **9 typed frontend OS proxy classes** with EdgeClient transport
- Supabase edge gateway functions
- deployment and validation scripts
- the integration surface for external Oracle / AA systems

## Scope

Current production scope is **Neo N3 only**.

The platform provides:

- **MiniApp host UX**: the end-user shell that injects `window.MiniAppSDK`, wallet flows, feeds, stats, and MiniApp rendering.
- **Admin UX**: manifest review, health monitoring, secrets / Oracle tooling, and operational checks.
- **Platform domain contracts** (MiniApp-OS v2): partial C# contracts split by anchor, DeFi, game, and social domains. MiniApps call `ctx.os.<service>()` through platform proxies for storage, payment, game, badge, checkin, leaderboard, escrow, NFT, and vesting.
- **OS Binder edge layer**: 42 `os-*` Supabase Edge functions enforcing auth, permissions, and rate limits before forwarding to domain contracts or returning wallet intents.
- **Typed frontend proxies**: 9 OS proxy classes in `apps/shared/services/os/` with `EdgeClient` transport.
- **Platform contract suite**: 7 contracts under `contracts/platform/` (anchor, DeFi, game, social, registry, AppAccount, factory) plus 34 legacy per-app `MiniApp*` contracts pending absorption into the Platform Contract Library v2 engine estate (see `docs/platform-contract-library-v2.md`).
- **Thin edge gateways**: Supabase / Deno functions that authenticate users, rate-limit traffic, enforce policy, and forward Oracle / Compute / RNG / sponsorship requests to external systems.
- **SaaS integrations**: Sentry (error tracking), PostHog (product analytics), Supabase Realtime (live notifications).
- **Validation and deployment scripts**: testnet workflow checks, contract scripts, and environment validators.
- **Test suite**: 215+ test files / 989+ test cases across contracts (53 cases), host-app (651), admin-console (223), deploy scripts (60), and edge `_shared` helpers (Deno).

The platform does **not** embed the Morpheus Oracle runtime or the AA runtime anymore.

## External Integrations

| Capability | Source of truth | Platform integration path |
| ---------- | --------------- | ------------------------- |
| Oracle / custom fetch | `neo-os-services` | host-side `/api/morpheus/oracle/*` proxy + shared `useOracle()` |
| DataFeed | `neo-os-services` | host-side `/api/morpheus/*` proxy, on-chain DataFeed contract (external), shared config |
| VRF / randomness | `neo-os-services` | host-side `/api/morpheus/vrf/*` proxy |
| Compute / TEE | `neo-os-services` | host-side `/api/morpheus/*` proxy |
| Paymaster / sponsorship | `neo-os-services` | `gas-sponsor-check` / `gas-sponsor-request` edge functions plus AA relay paymaster metadata |
| NeoDID public resolution / providers | `neo-os-services` | host-side `/api/morpheus/neodid/*` proxy + shared `useOracle()` |
| AA core / verifiers / relay | `neo-abstract-account` | host `AA_RELAY_URL`, shared `useAbstractAccount()`, canonical domains / hashes |

Primary integration rule:

- user-facing MiniApp flows use **direct Oracle / direct AA**

Current flagship payment rule:

- prefer direct prepaid transfer to the MiniApp contract itself
- Oracle callback apps may additionally require prepaid Oracle request fee credit on the callback contract

## Architecture (MiniApp-OS v2)

```
┌──────────────────────────────────────────────────────────────────────┐
│              MiniApp Frontend (defineMiniApp → PlayArea)              │
│        ctx.os.<service>()              ctx.services.<service>()      │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                      EdgeClient (Binder transport)
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase Edge / Host Proxies                     │
│  42 OS Binder functions (os-storage-*, os-payment-*, os-game-*, ...) │
│  + auth, wallet binding, rate limits, usage caps, service routing    │
└──────────────────────────────────────────────────────────────────────┘
        │                    │                                │
        ▼                    ▼                                ▼
┌─────────────┐  ┌──────────────────────┐  ┌───────────────────────────┐
│ Domain      │  │ neo-os-services  │  │  neo-abstract-account     │
│ Contracts   │  │ oracle / datafeed /  │  │ AA core / verifiers /     │
│ Platform    │  │ vrf / compute /      │  │ relay + AA frontends      │
│ Anchor/DeFi │  │ paymaster runtime    │  └───────────────────────────┘
│ Game/Social │  └──────────────────────┘             │
└─────────────┘              │                         │
        │                    └────────────┬────────────┘
        └─────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              Neo N3 Chain                            │
│   platform + legacy MiniApp contracts, external Morpheus kernel,     │
│   external Oracle / AA contracts                                     │
└──────────────────────────────────────────────────────────────────────┘
```

For detailed architecture, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Canonical External Contracts And Domains

### Mainnet

| Component | Domain | Hash |
| --------- | ------ | ---- |
| Morpheus Oracle | `oracle.morpheus.neo` | `0x5b492098fc094c760402e01f7e0b631b939d2bea` |
| Morpheus DataFeed | `pricefeed.morpheus.neo` | `0x03013f49c42a14546c8bbe58f9d434c3517fccab` |
| NeoDID Registry | `neodid.morpheus.neo` | `0xb81f31ea81e279793b30411b82c2e82078b63105` |
| AA canonical entrypoint | `smartwallet.neo` | `0x0268a387913b250166ddec032b03332690a1ef78` |
| AA additional alias | `aa.morpheus.neo` | `0x0268a387913b250166ddec032b03332690a1ef78` |
| AA Web3Auth verifier | `web3auth.smartwallet.neo` | `0xf5c452cd4ba29dcdc47026383568c0d8b38d9272` |
| AA SessionKey verifier | `sessionkey.smartwallet.neo` | `0x3ba8333406e59f9fd83cf378b33706a33d9f3755` |
| AA SocialRecovery verifier | `recovery.smartwallet.neo` | `0x198b3a9cec9bccc2110d19bd929b10374a9d034d` |

Entry domains for MiniApps are not limited to `.neo`. The host runtime now
accepts canonical `https://...`, `mf://...`, and bare `*.matrix` / `*.neo`
entry domains, normalizing bare domains to `https://...` before launch.

Current published Morpheus attestation anchors:

- Oracle runtime CVM: `oracle-morpheus-neo-r3e` / `ddff154546fe22d15b65667156dd4b7c611e6093`
- Oracle attestation explorer: `https://cloud.phala.com/explorer/app_ddff154546fe22d15b65667156dd4b7c611e6093`
- DataFeed CVM: `datafeed-morpheus-neo-r3e` / `ac5b6886a2832df36e479294206611652400178f`
- DataFeed attestation explorer: `https://cloud.phala.com/explorer/app_ac5b6886a2832df36e479294206611652400178f`

### Testnet

| Component | Hash |
| --------- | ---- |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |
| Morpheus DataFeed | `0x9bea75cf702f6afc09125aa6d22f082bfd2ee064` |
| AA canonical shared anchor | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` |
| AA Web3Auth verifier | `0xf2560a0db44bbb32d0a6919cf90a3d0643ad8e3d` |
| AA SessionKey verifier | `0xed44c88535650b4dd6b8d59776e6ed045462cab6` |

## Mainnet Flagship MiniApps

| App | Mainnet Contract | Domain |
| --- | --- | --- |
| LastSurvivor | `0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7` | `lastsurvivor.miniapp.neo` |
| GASBOX | `0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7` | `gasbox.miniapp.neo` |
| Red Envelope | `0x5f371cc50116bb13d79554d96ccdd6e246cd5d59` | `redenvelope.miniapp.neo` |
| Daily Check-in | `0xbd4f3646e189350b9c11a659655854e6f03f9be4` | `dailycheckin.miniapp.neo` |
| FogPlay | `0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7` | `fogplay.miniapp.neo` |
| Dice Game | `0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7` | `dicegame.miniapp.neo` |
| SelfLoan | `0x942da575b31f39cbb59e64b5813b128739b44c25` | `selfloan.miniapp.neo` |
| NeoPay | `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34` | `neopay.miniapp.neo` |

Domain values above are the canonical app manifests/runtime bindings. The latest on-chain NNS type-16 audit is in
`docs/reports/mainnet-domain-bindings-latest.json`; a record is only current when it resolves to the expected base58
contract address. Legacy records that resolve to a raw `0x...` script hash are treated as mismatches so they can be
normalized instead of silently passing. Updating NNS records requires a domain-owner signer, not the app contract
deployer. Use `npm run -s audit:contract-domains` to regenerate the read-only audit. To bind missing or mismatched
records, inject the owner WIF through one of `NEONS_DOMAIN_OWNER_WIF`, `NEO_NNS_DOMAIN_OWNER_WIF`,
`DOMAIN_OWNER_WIF`, `NEO_MAINNET_DOMAIN_OWNER_WIF`, or `MINIAPP_DOMAIN_OWNER_WIF`, run
`npm run -s bind:contract-domains` for a dry-run authorization check, then run
`npm run -s bind:contract-domains:execute` only after the dry-run reports the records as ready.

Operational alignment now applied on mainnet:

- all 7 flagship contracts point `abstractAccount` to mainnet AA Core `0x0268a387913b250166ddec032b03332690a1ef78`
- `FogPlay` and `Red Envelope` point `oracle` to mainnet Morpheus Oracle `0x5b492098fc094c760402e01f7e0b631b939d2bea`
- those callback consumers are allowlisted on the mainnet Oracle and funded with callback fee credit

## Platform Contracts

The on-chain estate is 7 platform contracts under `contracts/platform/` plus 34
legacy per-app `MiniApp*` contracts in `contracts/` root; see
[`contracts/README.md`](contracts/README.md) for the full inventory and
[`docs/platform-contract-library-v2.md`](docs/platform-contract-library-v2.md)
for the target architecture.

Current Neo N3 testnet deployments (2026-07-17):

| Contract         | Hash                                         | Description                                          |
| ---------------- | -------------------------------------------- | ---------------------------------------------------- |
| PlatformRegistry | `0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b` | v2 spine: permissionless `registerApp`, AppAccount minting, timelocked engine table |
| PlatformGame v2  | `0xc75b181b4561462903bb27d8d9e0b32b637bec12` | multi-tenant game engine; bound to the registry, oracle `0x4b882e94ed766807c4fd728768f972e13008ad52`, AA `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` |

The registry's AppAccount-artifact and `registerEngine("platform-game")`
timelocks are pending execution (24h timelock, executable 2026-07-18).

## MiniApps

The repository currently contains **77 Neo N3 miniapp manifests** under `apps/*`.
Those manifests are the practical source of truth for the current catalog.

Category spread (the `category` field of each `apps/*/neo-manifest.json`; re-derive with
the one-liner below and update this list in the same commit as any catalog change):

- `games`: 24
- `tools`: 23
- `social`: 8
- `defi`: 6
- `finance`: 6
- `governance`: 4
- `utility`: 3
- `nft`: 2
- `data`: 1

```bash
# Prints the table above straight from the manifests.
node -e 'const fs=require("fs"),p=require("path"),c={};
for(const d of fs.readdirSync("apps").filter(d=>fs.existsSync(p.join("apps",d,"neo-manifest.json"))))
  {const m=JSON.parse(fs.readFileSync(p.join("apps",d,"neo-manifest.json"),"utf8"));c[m.category]=(c[m.category]||0)+1;}
Object.entries(c).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`- \`${k}\`: ${v}`));'
```

Current featured flagship 7:

| Featured app | App ID | Current role |
| --- | --- | --- |
| SelfLoan | `miniapp-self-loan` | direct NEO-collateral loan flow |
| Red Envelope | `miniapp-redenvelope` | prepaid GAS + Oracle callback flow |
| FogPlay | `miniapp-fogplay` | prepaid GAS + Oracle RNG callback flow |
| Daily Check-in | `miniapp-dailycheckin` | direct GAS check-in reward path |
| LastSurvivor | `miniapp-last-survivor` | direct prepaid GAS key purchase |
| NeoPay | `miniapp-neo-pay` | prepaid asset credit recurring streams |
| GASBOX | `miniapp-gasbox` | prepaid GAS hybrid gacha settlement |

Current verified testnet behavior is now validated directly through:

- `deploy/scripts/live_validate_flagship_user_flows.js`
- `deploy/scripts/verify_cross_repo_testnet.sh`

Current AA / Oracle operator tools surfaced directly on the host home page:

- `miniapp-aa-account-lab`
- `miniapp-aa-permissions-lab`
- `miniapp-aa-market-hub` (interactive trustless escrow listing / repricing / settlement)
- `miniapp-aa-relay-console`
- `miniapp-aa-session-key-lab`
- `miniapp-oracle-price-console`
- `miniapp-oracle-vrf-console`

## Quick Start

### Prerequisites

- Node.js 18+
- Go 1.24+ (only for deploy / validation helpers)
- Neo N3 wallet with testnet GAS
- `.env` pointing to external Morpheus / AA integrations

### Local Development

```bash
# Install dependencies
npm install

# Validate env
npm run validate:miniapp-env -- --stage=prod --json

# Start the host app
cd platform/host-app && npm run dev

# Start the admin console
cd ../admin-console && npm run dev
```

This repo no longer boots the old in-repo Oracle / AA service layer. Local dev
means running the platform apps and pointing `.env` at deployed external
services, or running those external repos separately.

See [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) for the current flow.

## Production/Testnet Verification

`npm run verify:repo` is the preferred local verification entrypoint before any live/testnet validation.

Use these commands to verify readiness and live testnet workflows:

```bash
npm run verify:repo

set -a; source .env; set +a

# Current flagship live testnet validation (7 flagship MiniApps)
FLAGSHIP_LIVE_WIF=<funded-testnet-wif> \
  node deploy/scripts/live_validate_flagship_user_flows.js

# Cross-repo preferred path verification
AA_TEST_WIF=<funded-aa-testnet-wif-that-controls-PAYMASTER_ACCOUNT_ID> \
  ./deploy/scripts/verify_cross_repo_testnet.sh

```

Notes:

- `live_validate_flagship_user_flows.js` is the current end-to-end flagship testnet proof path.
- `verify_cross_repo_testnet.sh` is the preferred validation entrypoint.
- `verify_cross_repo_testnet.sh` expects `AA_TEST_WIF` to control the configured `PAYMASTER_ACCOUNT_ID` for the stable allowlisted paymaster path.
- The current stable default `PAYMASTER_ACCOUNT_ID` used by `verify_cross_repo_testnet.sh` is `0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56`.

## Environment Variables

| Variable | Description |
| -------- | ----------- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | browser-visible Supabase URL |
| `NEXT_PUBLIC_EDGE_URL` | browser/admin edge base URL |
| `NEO_RPC_URL` | Neo N3 RPC endpoint |
| `NEO_NETWORK_MAGIC` | Neo network magic |
| `CONTRACT_*_HASH` | MiniApp platform contract hashes |
| `CONTRACT_STORAGESERVICE_HASH` | OS StorageService contract hash |
| `CONTRACT_PAYMENTSERVICE_HASH` | OS PaymentService contract hash |
| `CONTRACT_SCRIPTENGINE_HASH` | OS ScriptEngine contract hash |
| `CONTRACT_CHECKINSERVICE_HASH` | OS CheckinService contract hash |
| `CONTRACT_BADGESERVICE_HASH` | OS BadgeService contract hash |
| `CONTRACT_LEADERBOARDSERVICE_HASH` | OS LeaderboardService contract hash |
| `CONTRACT_VESTINGSERVICE_HASH` | OS VestingService contract hash |
| `CONTRACT_GAMESERVICE_HASH` | OS GameService contract hash |
| `CONTRACT_ESCROWSERVICE_HASH` | OS EscrowService contract hash |
| `CONTRACT_NFTSERVICE_HASH` | OS NFTService contract hash |
| `MORPHEUS_RUNTIME_URL` | preferred unified Morpheus runtime URL |
| `MORPHEUS_RUNTIME_TOKEN` or `NITRO_API_TOKEN` / `NITRO_SHARED_SECRET` (legacy `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET` still accepted) | runtime auth for unified Morpheus endpoints |
| `MORPHEUS_PUBLIC_API_URL` | Morpheus web/public API URL |
| `MORPHEUS_EDGE_URL` | Morpheus edge URL |
| `MORPHEUS_CONTROL_PLANE_URL` | Morpheus control-plane URL |
| `TXPROXY_URL` | external txproxy URL |
| `AA_RELAY_URL` | external AA relay URL used by `/api/aa/relay` |
| `AA_PAYMASTER_ENDPOINT` or `MORPHEUS_PAYMASTER_*` | paymaster authorization endpoint |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error reporting DSN (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key (optional) |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL (optional) |

See [`.env.example`](.env.example) for complete list.

> **Note (v2):** The old shared-mode modular registration variables
> (`CONTRACT_MODULEREGISTRY_HASH`, `CONTRACT_RECIPEREGISTRY_HASH`,
> `CONTRACT_MINIAPPINSTANCEREGISTRY_HASH`, `CONTRACT_SERVICEGATEWAY_HASH`)
> are deprecated. They are commented out in `.env.example` with a deprecation
> notice pointing to the OS service contract hashes above. The matching
> module contracts, example plans, and registration tooling were removed from
> the repo; `CONTRACT_FUNDINGVAULT_HASH` / `CONTRACT_STREAMVESTING_HASH`
> remain in `.env.example` as zero-filled legacy slots only.

Run the full live smoke suite with timestamped reports:

```bash
npm run test:testnet:live:smoke
```

This wrapper:

- runs `flagship` live flows first
- runs `selected miniapps` live flows second
- writes timestamped reports under `docs/reports/live-smoke/<UTC timestamp>/`

Useful variants:

```bash
npm run test:testnet:live:smoke:flagship
npm run test:testnet:live:smoke:selected
```

If the chain-admin signer or distinct selected-user signer should come from a different wallet,
set:

- `LIVE_SMOKE_FLAGSHIP_ADMIN_WIF`
- `LIVE_SMOKE_SELECTED_USER_WIF`

If these are not set and `TEE_PRIVATE_KEY` is available, the wrapper will use that signer for the
flagship admin phase and the selected-user phase.

## Repository Structure

```
├── deploy/                 # Deployment and validation scripts
├── contracts/
│   ├── platform/PlatformAnchor/  # Governance anchors and staking flows
│   ├── platform/PlatformDeFi/    # Lending, flashloan, capsule, treasury flows
│   ├── platform/PlatformGame/    # Dice, flip, gacha, countdown game flows
│   ├── platform/PlatformSocial/  # Red envelope, trust, vault, social flows
│   ├── platform/PlatformRegistry/ + AppAccount/  # v2 spine + per-app treasury NEF
│   ├── platform/MiniAppFactory/  # Template registry + verified deploys
│   ├── MiniApp.DevPack/      # Source-shared contract base
│   └── MiniApp*/             # 34 legacy per-app contracts (pending v2 absorption)
├── platform/
│   ├── host-app/           # Next.js host shell
│   ├── admin-console/      # Admin UX
│   └── edge/functions/
│       ├── os-*/           # 42 OS Binder edge functions
│       └── ...             # Auth, wallet, policy edge functions
├── apps/
│   ├── shared/
│   │   ├── services/os/    # 9 OS proxy classes + EdgeClient
│   │   ├── services/       # PlatformServices + core services
│   │   ├── utils/          # defineMiniApp.ts
│   │   └── types/          # MiniAppContext, OSServices
│   └── miniapp-*/          # MiniApp frontends
├── test/                   # Contract and layering tests
├── docs/                   # Current platform docs and runbooks
└── scripts/                # Build and deploy scripts
```

## Documentation

| Document                                          | Description                          |
| ------------------------------------------------- | ------------------------------------ |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)             | Current platform architecture (OS v2) |
| [WORKFLOWS.md](docs/WORKFLOWS.md)                   | MiniApp lifecycle, OS service flows, and callback flows |
| [LOCAL_DEV.md](docs/LOCAL_DEV.md)                   | Local development path + OS contract development |
| [FRONTEND_SPECIFICATION.md](docs/FRONTEND_SPECIFICATION.md) | Host/frontend behavior + OS proxies |
| [MINIAPP_ENV_TEMPLATE.md](docs/MINIAPP_ENV_TEMPLATE.md)     | Current environment template   |
| [sdk-guide.md](docs/sdk-guide.md)                   | MiniApp SDK + OS service proxy guide  |
| [MiniApp-OS v2 Design](docs/superpowers/specs/2026-03-31-miniapp-os-v2-design.md) | OS v2 design spec (implemented) |

## License

Copyright © 2024 Yiwu MiniApps. All rights reserved.
