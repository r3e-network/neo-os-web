<p align="center">
  <img src="assets/banner.svg" alt="R3E MiniApps Platform" width="100%"/>
</p>

<p align="center">
  <a href="https://r3e.network"><img src="https://img.shields.io/badge/Live-r3e.network-00E599?style=flat-square" alt="Live"/></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick%20Start-Guide-00E599?style=flat-square" alt="Quick Start"/></a>
  <a href="docs/ARCHITECTURE.md"><img src="https://img.shields.io/badge/Docs-Architecture-00D9FF?style=flat-square" alt="Architecture"/></a>
  <a href="#platform-contracts"><img src="https://img.shields.io/badge/Network-Neo%20N3-blue?style=flat-square" alt="Neo N3"/></a>
  <a href="https://github.com/r3e-network/neo-miniapp-platform"><img src="https://img.shields.io/badge/R3E-Network-00E599?style=flat-square" alt="R3E Network"/></a>
</p>

---

# R3E MiniApps Platform

A Neo N3 MiniApp platform for host UX, admin tooling, MiniApp contracts, edge gateways, and integration with the externally deployed Morpheus Oracle and Abstract Account stacks.

## Repository Boundary

This repository no longer owns the full Go service layer runtime.

The attested Oracle, DataFeed, confidential compute, paymaster, and AA service logic now live in the dedicated upstream repos:

- `neo-morpheus-oracle`
- `neo-abstract-account`

This repository should be treated as:

- the MiniApp host application
- the admin console
- MiniApp platform / example contracts
- Supabase edge gateway functions
- deployment and validation scripts
- the integration surface for external Oracle / AA systems

## Scope

Current production scope is **Neo N3 only**.

The platform provides:

- **MiniApp host UX**: the end-user shell that injects `window.MiniAppSDK`, wallet flows, feeds, stats, and MiniApp rendering.
- **Admin UX**: manifest review, health monitoring, secrets / Oracle tooling, and operational checks.
- **MiniApp contracts and templates**: Governance, AppRegistry, AutomationAnchor, flagship/example MiniApp contracts, plus legacy/optional platform contracts such as `PaymentHub`.
- **Thin edge gateways**: Supabase / Deno functions that authenticate users, rate-limit traffic, enforce policy, and forward Oracle / Compute / RNG / sponsorship requests to external systems.
- **Validation and deployment scripts**: testnet workflow checks, contract scripts, and environment validators.

The platform does **not** embed the Morpheus Oracle runtime or the AA runtime anymore.

## External Integrations

| Capability | Source of truth | Platform integration path |
| ---------- | --------------- | ------------------------- |
| Oracle / custom fetch | `neo-morpheus-oracle` | `oracle-query` edge function |
| DataFeed | `neo-morpheus-oracle` | `datafeed-price`, on-chain `PriceFeed`, shared config |
| VRF / randomness | `neo-morpheus-oracle` | `rng-request` |
| Compute / TEE | `neo-morpheus-oracle` | `compute-execute`, `compute-app-execute` |
| Paymaster / sponsorship | `neo-morpheus-oracle` | GAS sponsor gateway plus AA relay paymaster metadata |
| AA core / verifiers / relay | `neo-abstract-account` | host `AA_RELAY_URL`, shared `useAbstractAccount()`, canonical domains / hashes |

Primary integration rule:

- user-facing MiniApp flows use **direct Oracle / direct AA**

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       MiniApp Host / Admin UI                        │
│                  (Next.js + shared MiniApp SDK/composables)          │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase Edge / Host Proxies                     │
│     auth, wallet binding, rate limits, usage caps, service routing   │
└──────────────────────────────────────────────────────────────────────┘
                    │                                │
                    │                                │
                    ▼                                ▼
┌──────────────────────────────┐      ┌───────────────────────────────┐
│     neo-morpheus-oracle      │      │      neo-abstract-account     │
│ oracle / datafeed / vrf /    │      │ AA core / verifiers / relay   │
│ compute / paymaster runtime  │      │ plus external AA frontends     │
└──────────────────────────────┘      └───────────────────────────────┘
                    │                                │
                    └───────────────┬────────────────┘
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              Neo N3 Chain                            │
│      Platform contracts, MiniApp contracts, external Oracle / AA     │
└──────────────────────────────────────────────────────────────────────┘
```

For detailed architecture, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Canonical External Contracts And Domains

### Mainnet

| Component | Domain | Hash |
| --------- | ------ | ---- |
| Morpheus Oracle | `oracle.morpheus.neo` | `0x017520f068fd602082fe5572596185e62a4ad991` |
| Morpheus DataFeed | `pricefeed.morpheus.neo` | `0x03013f49c42a14546c8bbe58f9d434c3517fccab` |
| NeoDID Registry | `neodid.morpheus.neo` | `0xb81f31ea81e279793b30411b82c2e82078b63105` |
| AA canonical entrypoint | `smartwallet.neo` | `0x9742b4ed62a84a886f404d36149da6147528ee33` |
| AA compatibility alias | `aa.morpheus.neo` | `0x9742b4ed62a84a886f404d36149da6147528ee33` |
| AA Web3Auth verifier | `web3auth.smartwallet.neo` | `0xb4107cb2cb4bace0ebe15bc4842890734abe133a` |
| AA SessionKey verifier | `sessionkey.smartwallet.neo` | `0xe82b9d056c011819ff3652427682224daad0cd1f` |
| AA SocialRecovery verifier | `recovery.smartwallet.neo` | `0x51ef9639deb29284cc8577a7fa3fdfbc92ada7c3` |

### Testnet

| Component | Hash |
| --------- | ---- |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |
| Morpheus DataFeed | `0x9bea75cf702f6afc09125aa6d22f082bfd2ee064` |
| AA canonical shared anchor | `0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38` |
| AA Web3Auth verifier | `0xf2560a0db44bbb32d0a6919cf90a3d0643ad8e3d` |
| AA SessionKey verifier | `0xed44c88535650b4dd6b8d59776e6ed045462cab6` |

## Platform Contracts

Current Neo N3 testnet platform contract values from `.env`:

| Contract            | Hash                                         | Description               |
| ------------------- | -------------------------------------------- | ------------------------- |
| PaymentHub          | `0x340cb33d770b38f26d066716dd1f9df5283d629e` | Legacy / optional GAS settlement |
| Governance          | `0x2ec930202e6d03313d97198259b298cc3c29295e` | NEO staking and voting    |
| PriceFeed           | `0x5284ef25f1bbbf36d139f6f94356e46b89138602` | Oracle price data         |
| RandomnessLog       | `0xa24f83dcbafff909d4209ac76ca5d09237c0cda6` | VRF attestation anchoring |
| AppRegistry         | `0x9ceaabb583a9261b34380a9df2d32a75c1c04a3d` | MiniApp registration      |
| AutomationAnchor    | `0xa016f7be94ad7c4d87ad2f8d38784797c2dc494b` | Periodic task scheduling  |

## MiniApps (62 Apps)

MiniApp contracts use the shared `MiniAppContract` partial class pattern. New
user-facing service integrations use direct Oracle / direct AA paths.

### 🎮 Gaming (15 Apps)

| App             | Contract               | Description                       |
| --------------- | ---------------------- | --------------------------------- |
| Lottery         | `MiniAppLottery`       | Provable VRF lottery with jackpot |
| Coin Flip       | `MiniAppCoinFlip`      | 50/50 double-or-nothing           |
| Dice Game       | `MiniAppDiceGame`      | Roll dice, win up to 6x           |
| Scratch Card    | `MiniAppScratchCard`   | Instant win scratch cards         |
| Neo Crash       | `MiniAppNeoCrash`      | Multiplier crash game             |
| No-Loss Lottery | `MiniAppNoLossLottery` | Stake to win, keep principal      |
| Fog Chess       | `MiniAppFogChess`      | Chess with fog of war             |
| Fog Puzzle      | `MiniAppFogPuzzle`     | Hidden puzzle solving             |
| Secret Poker    | `MiniAppSecretPoker`   | TEE Texas Hold'em                 |
| Algo Battle     | `MiniAppAlgoBattle`    | Algorithm competition             |
| Puzzle Mining   | `MiniAppPuzzleMining`  | Solve puzzles to earn             |
| Crypto Riddle   | `MiniAppCryptoRiddle`  | Cryptographic puzzles             |
| On-Chain Tarot  | `MiniAppOnChainTarot`  | VRF-based tarot readings          |
| World Piano     | `MiniAppWorldPiano`    | Collaborative music creation      |
| Scream to Earn  | `MiniAppScreamToEarn`  | Voice-activated rewards           |

### 💰 DeFi (14 Apps)

| App               | Contract                  | Description                 |
| ----------------- | ------------------------- | --------------------------- |
| Flash Loan        | `MiniAppFlashLoan`        | Instant borrow and repay    |
| Grid Bot          | `MiniAppGridBot`          | Automated grid trading      |
| AI Trader         | `MiniAppAITrader`         | Autonomous trading agent    |
| Price Ticker      | `MiniAppPriceTicker`      | Real-time price feeds       |
| Prediction Market | `MiniAppPredictionMarket` | Price movement predictions  |
| IL Guard          | `MiniAppILGuard`          | Impermanent loss protection |
| Candle Wars       | `MiniAppCandleWars`       | Price candle predictions    |
| Dark Pool         | `MiniAppDarkPool`         | Anonymous large trades      |
| Dutch Auction     | `MiniAppDutchAuction`     | Descending price auctions   |
| Self Loan         | `MiniAppSelfLoan`         | Self-collateralized loans   |
| Compound Capsule  | `MiniAppCompoundCapsule`  | Auto-compounding yields     |
| Quantum Swap      | `MiniAppQuantumSwap`      | Atomic token swaps          |
| Melting Asset     | `MiniAppMeltingAsset`     | Time-decaying tokens        |
| NeoBurger         | External Integration      | NEO staking for GAS rewards |

### 👥 Social (12 Apps)

| App              | Contract                 | Description               |
| ---------------- | ------------------------ | ------------------------- |
| Red Envelope     | `MiniAppRedEnvelope`     | Social GAS red packets    |
| Gas Circle       | `MiniAppGasCircle`       | Daily savings circle      |
| Secret Vote      | `MiniAppSecretVote`      | Privacy-preserving voting |
| Whisper Chain    | `MiniAppWhisperChain`    | Anonymous messaging       |
| Dev Tipping      | `MiniAppDevTipping`      | Developer appreciation    |
| Bounty Hunter    | `MiniAppBountyHunter`    | Bug bounty platform       |
| Breakup Contract | `MiniAppBreakupContract` | Relationship agreements   |
| Ex Files         | `MiniAppExFiles`         | Shared memory vault       |
| AI Soulmate      | `MiniAppAISoulmate`      | AI companion matching     |
| Geo Spotlight    | `MiniAppGeoSpotlight`    | Location-based discovery  |
| Masquerade DAO   | `MiniAppMasqueradeDAO`   | Anonymous governance      |
| Dark Radio       | `MiniAppDarkRadio`       | Anonymous broadcasting    |

### 🎨 NFT (8 Apps)

| App               | Contract                 | Description                 |
| ----------------- | ------------------------ | --------------------------- |
| Canvas            | `MiniAppCanvas`          | Collaborative pixel art NFT |
| NFT Evolve        | `MiniAppNFTEvolve`       | Dynamic NFT evolution       |
| NFT Chimera       | `MiniAppNFTChimera`      | NFT fusion and breeding     |
| Schrodinger NFT   | `MiniAppSchrodingerNFT`  | Quantum state NFTs          |
| Garden of Neo     | `MiniAppGardenOfNeo`     | Virtual garden NFTs         |
| Million Piece Map | `MiniAppMillionPieceMap` | Collaborative world map     |
| Pay to View       | `MiniAppPayToView`       | Gated content access        |
| Graveyard         | `MiniAppGraveyard`       | NFT memorial                |

### 🏛️ Governance (6 Apps)

| App             | Contract                | Description               |
| --------------- | ----------------------- | ------------------------- |
| Gov Booster     | `MiniAppGovBooster`     | NEO governance tools      |
| Candidate Vote  | `MiniAppCandidateVote`  | Vote for consensus nodes  |
| Gov Merc        | `MiniAppGovMerc`        | Governance delegation     |
| Guardian Policy | `MiniAppGuardianPolicy` | TEE transaction security  |
| Bridge Guardian | `MiniAppBridgeGuardian` | Cross-chain asset bridge  |
| Burn League     | `MiniAppBurnLeague`     | Token burning competition |

### 🔧 Utility (7 Apps)

| App               | Contract                  | Description                |
| ----------------- | ------------------------- | -------------------------- |
| Time Capsule      | `MiniAppTimeCapsule`      | Time-locked messages       |
| Dead Switch       | `MiniAppDeadSwitch`       | Dead man's switch          |
| Heritage Trust    | `MiniAppHeritageTrust`    | Digital inheritance        |
| Unbreakable Vault | `MiniAppUnbreakableVault` | Secure asset storage       |
| ZK Badge          | `MiniAppZKBadge`          | Zero-knowledge credentials |
| Doomsday Clock    | `MiniAppDoomsdayClock`    | Countdown events           |
| Parasite          | `MiniAppParasite`         | Token attachment protocol  |

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

Use these commands to verify readiness and live testnet workflows:

```bash
set -a; source .env; set +a

# Nitro attestation + production-readiness checks
./deploy/scripts/check_enclave_signing_key.sh --backend nitro
./deploy/scripts/production_readiness_check.sh

# Legacy platform-only compatibility verification
./deploy/scripts/verify_testnet_workflows.sh --env-file .env

# Cross-repo preferred path verification
AA_TEST_WIF=<funded-aa-testnet-wif> \
  ./deploy/scripts/verify_cross_repo_testnet.sh

# PriceFeed freshness for current required symbols
env PRICEFEED_WATCH_SYMBOLS='NEO-USD,GAS-USD,USDT-USD,USDC-USD,BTC-USD,ETH-USD,XRP-USD,BNB-USD,SOL-USD,TRX-USD,DOGE-USD,XAU-USD,XAG-USD,NVDA-USD,AAPL-USD,GOOGL-USD,MSFT-USD,META-USD,TSM-USD,TSLA-USD,TCEHY-USD' \
  PRICEFEED_WATCH_MAX_STALENESS='24h' \
  go run -tags=scripts deploy/scripts/check_pricefeed_freshness.go
```

Notes:

- `verify_cross_repo_testnet.sh` is the preferred validation entrypoint.
- `verify_testnet_workflows.sh` is legacy / compatibility-oriented.

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
| `NEOFEEDS_URL` | external Morpheus DataFeed service URL |
| `NEOORACLE_URL` | external Morpheus Oracle service URL |
| `NEOVRF_URL` | external Morpheus VRF service URL |
| `NEOCOMPUTE_URL` | external Morpheus Compute service URL |
| `TXPROXY_URL` | external txproxy URL |
| `AA_RELAY_URL` | external AA relay URL used by `/api/aa/relay` |
| `AA_PAYMASTER_ENDPOINT` or `MORPHEUS_PAYMASTER_*` | paymaster authorization endpoint |

See [`.env.example`](.env.example) for complete list.

## Repository Structure

```
├── deploy/                 # Deployment and validation scripts
├── contracts/              # Neo N3 smart contracts (C#)
├── platform/               # Host app, admin console, SDK, shared UI/runtime
├── apps/                   # MiniApp frontends
├── docs/                   # Platform docs and runbooks
├── _archive/               # Legacy service-layer Go code kept only for reference
│   ├── vrf/                # Verifiable random function
│   ├── datafeed/           # Price feed aggregation
│   ├── automation/         # Task scheduling
│   └── ...
├── platform/               # Frontend & Gateway
│   ├── edge/               # Supabase Edge functions
│   ├── host-app/           # Next.js host application
│   └── sdk/                # MiniApp JavaScript SDK
├── docs/                   # Documentation
└── scripts/                # Build and deploy scripts
```

## Documentation

| Document                                          | Description                          |
| ------------------------------------------------- | ------------------------------------ |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)           | System architecture and TEE boundary |
| [WORKFLOWS.md](docs/WORKFLOWS.md)                 | MiniApp lifecycle and callbacks      |
| [DATAFLOWS.md](docs/DATAFLOWS.md)                 | Request flows and audit tables       |
| [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | Gateway and service APIs             |
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)   | Deployment paths                     |
| [sdk-guide.md](docs/sdk-guide.md)                 | MiniApp SDK integration              |

## License

Copyright © 2024 R3E Network. All rights reserved.
