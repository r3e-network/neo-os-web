<div align="center">
  <a name="readme-top"></a>

  [![NeoHub Banner](assets/neohub-banner.png)](https://github.com/R3E-Network)
  
  [![Separator](assets/neohub-separator.png)](https://github.com/R3E-Network)

  <h3>The Multi-Chain MiniApp Platform for the Neo Economy</h3>

  [![Powered by Neo](https://img.shields.io/badge/Powered%20by-Neo-00E599?style=plastic&logo=neo&logoColor=white)](https://neo.org)
  [![Live](https://img.shields.io/badge/Live-neomini.app-00E599?style=plastic&logo=google-chrome&logoColor=white)](https://neomini.app)
  [![Docs](https://img.shields.io/badge/Docs-Architecture-00D9FF?style=plastic&logo=gitbook&logoColor=white)](docs/ARCHITECTURE.md)
  [![License](https://img.shields.io/badge/License-MIT-green?style=plastic)](LICENSE)
  [![GitHub](https://img.shields.io/badge/GitHub-R3E--Network-181717?style=plastic&logo=github&logoColor=white)](https://github.com/R3E-Network)

</div>

<hr/>

<div align="center">

**[English](README.md)** · [Documentation](docs/ARCHITECTURE.md) · [Report Bug](https://github.com/R3E-Network/service_layer/issues) · [Request Feature](https://github.com/R3E-Network/service_layer/issues)

</div>

<br/>

**NeoHub** is a TEE-powered multi-chain MiniApp platform that combines a user-facing **Gateway** (Supabase Edge) with enclave workloads (MarbleRun + EGo) for secure signing and confidential computation. **Powered by Neo** and supporting Neo N3, NeoX, and Ethereum networks.

<div align="center">

### 🚀 Multi-Chain Support - 🔒 TEE Security - 🎲 Provable Randomness

</div>

- ✅ **Multi-Chain** - Native support for Neo N3, NeoX, and Ethereum
- ✅ **Secure** - Intel SGX Enclaves for Trusted Execution Environments (TEE)
- ✅ **Fair** - Verifiable Random Function (VRF) with on-chain attestation
- ✅ **Automation** - Cron-based task scheduling and execution
- ✅ **Confidential** - Privacy-preserving computation for sensitive logic

<br/>

[![Separator](assets/neohub-separator.png)](https://github.com/R3E-Network)

<details>
<summary><kbd>Table of Contents</kbd></summary>

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Platform Contracts](#platform-contracts)
- [MiniApps](#miniapps)
- [Quick Start](#quick-start)
- [Repository Structure](#repository-structure)
- [Documentation](#documentation)
- [License](#license)

</details>

## Overview

The NeoHub MiniApp Platform provides infrastructure for building decentralized MiniApps with multi-chain support:

- **60+ Production MiniApps** across Gaming, DeFi, Social, NFT, and Governance categories
- **TEE Security** via Intel SGX enclaves for confidential computation
- **Provable Randomness** through VRF with on-chain attestation
- **Real-time Price Feeds** from multiple oracle sources
- **Automated Workflows** with cron-based task scheduling

### Supported Chains

| Chain        | Type           | Status        |
| ------------ | -------------- | ------------- |
| **Neo N3**   | Native         | ✅ Production |
| **NeoX**     | EVM-Compatible | ✅ Production |
| **Ethereum** | EVM            | ✅ Production |

## Architecture

```mermaid
graph TD
    User[UserId / MiniApp Frontend] --> Gateway[Supabase Edge Gateway]
    Gateway --> VRF[TEE Services: VRF/Oracle]
    Gateway --> Compute[TEE Services: Compute/Auto]
    Gateway --> Signer[TEE Services: GlobalSigner]
    VRF --> Blockchain[Neo N3 Blockchain]
    Compute --> Blockchain
    Signer --> Blockchain
    Blockchain --> Contracts[Platform & MiniApp Contracts]
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

Deployed on Neo N3 Testnet:

| Contract            | Address                              | Description               |
| ------------------- | ------------------------------------ | ------------------------- |
| PaymentHub          | `NZLGNdQUa5jQ2VC1r3MGoJFGm3BW8Kv81q` | GAS payment processing    |
| Governance          | `NLRGStjsRpN3bk71KNoKe74fNxUT72gfpe` | NEO staking and voting    |
| PriceFeed           | `NTdJ7XHZtYXSRXnWGxV6TcyxiSRCcjP4X1` | Oracle price data         |
| RandomnessLog       | `NR9urKR3FZqAfvowx2fyWjtWHBpqLqrEPP` | VRF attestation anchoring |
| AppRegistry         | `NXZNTXiPuBRHnEaKFV3tLHhitkbt3XmoWJ` | MiniApp registration      |
| AutomationAnchor    | `NcVrd4Z7W8sxv9jvdBF72xfiWBnvRsgVkx` | Periodic task scheduling  |
| ServiceLayerGateway | `NTWh6auSz3nvBZSbXHbZz4ShwPhmpkC5Ad` | Service request routing   |

Mainnet addresses live in `deploy/config/mainnet_contracts.json`.

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

- Go 1.21+
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

## Environment Variables

| Variable                    | Description                 |
| --------------------------- | --------------------------- |
| `SUPABASE_URL`              | Supabase project URL        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key   |
| `SECRETS_MASTER_KEY`        | Encryption key for secrets  |
| `NEO_RPC_URL`               | Neo N3 RPC endpoint         |
| `NEO_NETWORK_MAGIC`         | Network magic number        |
| `CONTRACT_*_ADDRESS`        | Platform contract addresses |

See [`.env.example`](.env.example) for complete list and the
`deploy/config/{testnet,mainnet}_contracts.json` files for canonical addresses.

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

---

<div align="center">
  <b>Proudly powered by</b><br/><br/>
  <a href="https://neo.org">
    <img src="platform/host-app/public/chains/neo.svg" alt="Neo" height="48"/>
  </a>
</div>
