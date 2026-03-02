<p align="center">
  <img src="assets/banner.svg" alt="R3E MiniApps Platform" width="100%"/>
</p>

<p align="center">
  <a href="https://r3e.network"><img src="https://img.shields.io/badge/Live-r3e.network-00E599?style=flat-square" alt="Live"/></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick%20Start-Guide-00E599?style=flat-square" alt="Quick Start"/></a>
  <a href="docs/ARCHITECTURE.md"><img src="https://img.shields.io/badge/Docs-Architecture-00D9FF?style=flat-square" alt="Architecture"/></a>
  <a href="#platform-contracts"><img src="https://img.shields.io/badge/Network-Multi--Chain-blue?style=flat-square" alt="Multi-Chain"/></a>
  <a href="https://github.com/r3e-network/neo-miniapp-platform"><img src="https://img.shields.io/badge/R3E-Network-00E599?style=flat-square" alt="R3E Network"/></a>
</p>

---

# R3E MiniApps Platform

A modern, polymorphic, data-driven decentralized application (MiniApp) distribution platform built for the **Neo Ecosystem (Neo N3 & Neo X)**.

## Overview

The R3E MiniApps Platform enables developers and operators to deploy sophisticated on-chain applications with zero-code configurations:

- **JSON-Driven Polymorphic UI**: Build complex interfaces (like Polymarket, DAOs, or Lotteries) using reusable component layouts and dynamically rendered operation sidebars. No frontend coding required per app.
- **Universal Contract Templates**: Instantiate parameter-driven factory contracts (`Template.Prediction.cs`, `Template.Lottery.cs`) via JSON config, bypassing custom C# development and audits for standard DApp behaviors.
- **Universal Multi-Chain Auth**: A unified Polymarket-style connection flow supporting **Web2 Social Logins** (via Auth0 to custodial wallets), native **Neo N3** wallets, and EVM-based **Neo X** wallets (via MetaMask).
- **TEE Security**: Powered by AWS Nitro Enclaves, plus Supabase Edge for scalable off-chain logic.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MiniApp Frontend                         │
│                    (React/Next.js + SDK)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Edge Gateway                       │
│              (Auth, Rate Limiting, Request Routing)             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   TEE Services  │ │  TEE Services   │ │  TEE Services   │
│   (VRF, Oracle) │ │ (Compute, Auto) │ │  (GlobalSigner) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Neo N3 Blockchain                          │
│        (Platform Contracts + MiniApp Contracts)                 │
└─────────────────────────────────────────────────────────────────┘
```

For detailed architecture, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Services

| Service        | ID              | Description                                          |
| -------------- | --------------- | ---------------------------------------------------- |
| **VRF**        | `neovrf`        | Verifiable random function with on-chain attestation |
| **DataFeed**   | `neofeeds`      | Real-time price feeds from multiple sources          |
| **Automation** | `neoflow`       | Cron-based task scheduling and execution             |
| **Compute**    | `neocompute`    | Confidential computation in TEE                      |
| **Oracle**     | `neooracle`     | External data queries with TEE verification          |
| **TxProxy**    | `txproxy`       | Transaction submission and gas management            |
| **GasBank**    | `neogasbank`    | User GAS balance management                          |
| **Simulation** | `neosimulation` | Development and testing environment                  |

**Infrastructure:**

- `globalsigner` - Enclave-held signing keys
- `neoaccounts` - HD-derived account pool (10,000+ accounts)

## Platform Contracts

Deployed on Neo N3 Testnet (current `.env` values, validated on **February 26, 2026**):

| Contract            | Hash                                         | Description               |
| ------------------- | -------------------------------------------- | ------------------------- |
| PaymentHub          | `0x340cb33d770b38f26d066716dd1f9df5283d629e` | GAS payment processing    |
| Governance          | `0x2ec930202e6d03313d97198259b298cc3c29295e` | NEO staking and voting    |
| PriceFeed           | `0x5284ef25f1bbbf36d139f6f94356e46b89138602` | Oracle price data         |
| RandomnessLog       | `0xa24f83dcbafff909d4209ac76ca5d09237c0cda6` | VRF attestation anchoring |
| AppRegistry         | `0x9ceaabb583a9261b34380a9df2d32a75c1c04a3d` | MiniApp registration      |
| AutomationAnchor    | `0xa016f7be94ad7c4d87ad2f8d38784797c2dc494b` | Periodic task scheduling  |
| ServiceLayerGateway | `0x194fcb975c47952c5a030e89946a5907b33efd23` | Service request routing   |

## MiniApps (62 Apps)

All MiniApp contracts use the shared `MiniAppContract` partial class pattern and communicate with platform services via ServiceLayerGateway.

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

- Go 1.24+
- Docker & Docker Compose
- Node.js 18+
- Neo N3 wallet with testnet GAS

### Local Development

```bash
# Start infrastructure
make docker-up

# Run a service locally
SERVICE_TYPE=neovrf go run ./cmd/marble

# Start the host app
cd platform/host-app && npm run dev
```

### Full Stack (K3s)

```bash
./scripts/bootstrap_k3s_dev.sh --env-file .env --edge-env-file .env.local
```

See [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) for detailed setup.

## Production/Testnet Verification

Use these commands to verify readiness and live testnet workflows:

```bash
set -a; source .env; set +a

# Nitro attestation + production-readiness checks
./scripts/check_enclave_signing_key.sh --backend nitro
./scripts/production_readiness_check.sh

# End-to-end on-chain testnet workflow verification
./scripts/verify_testnet_workflows.sh --env-file .env

# PriceFeed freshness for current required symbols
env PRICEFEED_WATCH_SYMBOLS='NEO-USD,GAS-USD,USDT-USD,USDC-USD,BTC-USD,ETH-USD,XRP-USD,BNB-USD,SOL-USD,TRX-USD,DOGE-USD,XAU-USD,XAG-USD,NVDA-USD,AAPL-USD,GOOGL-USD,MSFT-USD,META-USD,TSM-USD,TSLA-USD,TCEHY-USD' \
  PRICEFEED_WATCH_MAX_STALENESS='24h' \
  go run -tags=scripts scripts/check_pricefeed_freshness.go
```

## Environment Variables

| Variable                    | Description                |
| --------------------------- | -------------------------- |
| `SUPABASE_URL`              | Supabase project URL       |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key  |
| `TEE_BACKEND`               | TEE backend (`nitro`) |
| `SECRETS_MASTER_KEY`        | Encryption key for secrets |
| `NEO_RPC_URL`               | Neo N3 RPC endpoint        |
| `NEO_NETWORK_MAGIC`         | Network magic number       |
| `CONTRACT_*_HASH`           | Platform contract hashes   |
| `NITRO_ATTESTATION_DOCUMENT_B64` | Nitro attestation document |
| `NEOFEEDS_PUBLISH_*`        | Datafeed publish policy    |

See [`.env.example`](.env.example) for complete list.

## Repository Structure

```
├── cmd/                    # Binary entrypoints
├── contracts/              # Neo N3 smart contracts (C#)
├── infrastructure/         # Shared infrastructure (Go)
│   ├── globalsigner/       # TEE signing service
│   └── accountpool/        # HD account management
├── services/               # Product services (Go)
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
