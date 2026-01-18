# Introduction

> Comprehensive guide to the Neo Service Layer - A TEE-backed platform for building secure MiniApps on Neo N3

## What is Neo Service Layer?

The Neo Service Layer is a comprehensive platform that enables developers to build secure, decentralized applications (MiniApps) on the Neo N3 blockchain. It provides a suite of TEE-backed (Trusted Execution Environment) services that handle sensitive operations like randomness generation, price feeds, and secret management.

### Platform Highlights

| Feature              | Description                                     |
| -------------------- | ----------------------------------------------- |
| **TEE Security**     | Intel SGX enclaves for hardware-level isolation |
| **Multi-Service**    | VRF, Oracle, DataFeeds, Automation, GasBank     |
| **Developer SDK**    | TypeScript/JavaScript with Vue composables      |
| **Cross-Platform**   | Web, mobile (uni-app), and backend integration  |
| **Production Ready** | Kubernetes deployment with monitoring           |

## Key Features

### Secure by Design

- **TEE-Backed Services**: All sensitive operations run inside Intel SGX enclaves
- **Attestation**: Cryptographic proof of code integrity
- **Defense in Depth**: Four-layer security model (SDK → Edge → TEE → Contract)

### Developer-Friendly

- **Simple SDK**: Easy-to-use JavaScript/TypeScript SDK
- **Sandbox Environment**: Safe testing without real assets
- **Comprehensive APIs**: RESTful and WebSocket interfaces

### Production-Ready

- **High Availability**: Kubernetes-based deployment
- **Monitoring**: Built-in observability and alerting
- **Rate Limiting**: Protection against abuse

## Core Concepts

### MiniApps

MiniApps are lightweight applications that run within the Neo ecosystem. They:

- Execute in a sandboxed environment
- Communicate with the host via a secure message channel
- Access blockchain services through the SDK

### TEE Services

Trusted Execution Environment services provide:

- **Confidentiality**: Data is encrypted in memory
- **Integrity**: Code cannot be tampered with
- **Attestation**: Proof of authentic execution

### Service Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   MiniApp   │────▶│  Host SDK   │────▶│ Edge Layer  │────▶│ TEE Service │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  Neo N3     │
                                                            │  Blockchain │
                                                            └─────────────┘
```

### Detailed Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MiniApp Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Daily Checkin│  │  Coin Flip   │  │  Neo Swap    │  ... 30+ apps     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            SDK Layer                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  @neo/uniapp-sdk                                                  │  │
│  │  ├── useWallet()      - Wallet connection & signing               │  │
│  │  ├── useDatafeed()    - Real-time price feeds                     │  │
│  │  ├── useRNG()         - Verifiable random numbers                 │  │
│  │  ├── usePayments()    - GAS payments                              │  │
│  │  ├── useGovernance()  - NEO voting                                │  │
│  │  ├── useGasSponsor()  - Transaction sponsorship                   │  │
│  │  └── useSecrets()     - Secret management                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Edge Layer (Supabase)                         │
│  • Authentication & JWT validation                                      │
│  • Rate limiting (per-app, per-user quotas)                             │
│  • Request validation & sanitization                                    │
│  • Nonce tracking for replay protection                                 │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        TEE Layer (Intel SGX + MarbleRun)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Oracle    │ │     VRF     │ │  DataFeeds  │ │   Secrets   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                        │
│  │ Automation  │ │   GasBank   │ │   Payments  │                        │
│  └─────────────┘ └─────────────┘ └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Blockchain Layer (Neo N3)                        │
│  • MiniApp smart contracts (per-app) + optional UniversalMiniApp         │
│  • On-chain verification & settlement                                   │
│  • Monotonic counters for anti-replay                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Available Services

| Service        | Description                | Use Case                          |
| -------------- | -------------------------- | --------------------------------- |
| **VRF**        | Verifiable Random Function | Gaming, lotteries, fair selection |
| **DataFeeds**  | Real-time price oracles    | DeFi, trading, valuations         |
| **Oracle**     | External data fetching     | Off-chain data integration        |
| **Automation** | Scheduled task execution   | Recurring payments, maintenance   |
| **GasBank**    | Gas sponsorship            | User onboarding, UX improvement   |
| **Secrets**    | Secure key management      | API keys, credentials             |

## Supported Assets

| Asset | Payment | Governance |
| ----- | ------- | ---------- |
| GAS   | ✅ Yes  | ❌ No      |
| NEO   | ❌ No   | ✅ Yes     |

> **Note**: Only GAS is accepted for payments. Only NEO is accepted for governance voting.

## Next Steps

1. **[Quick Start](./Quick-Start.md)** - Get running in 5 minutes
2. **[Authentication](./Authentication.md)** - Set up authentication
3. **[API Keys](./API-Keys.md)** - Manage your credentials

## Support

- **Documentation**: You're here!
- **Discord**: [discord.gg/neo](https://discord.gg/neo)
- **GitHub Issues**: Report bugs and request features
