# MiniApp Developer Tutorials

Welcome to the Neo N3 MiniApp tutorial series! These progressive tutorials will take you from beginner to advanced MiniApp developer.

## Tutorial Series

| Tutorial                                          | Level        | Time   | Skills                         | Prerequisites |
| ------------------------------------------------- | ------------ | ------ | ------------------------------ | ------------- |
| [1. Payment MiniApp](./01-payment-miniapp/)       | Beginner     | 45 min | Wallet, GAS Payments, Manifest | None          |
| [2. Provably Fair Game](./02-provably-fair-game/) | Intermediate | 60 min | VRF Randomness, Game State     | Tutorial 1    |
| [3. Governance Voting](./03-governance-voting/)   | Advanced     | 75 min | On-chain Voting, Contracts     | Tutorial 1    |

## Learning Path

```
┌─────────────────────┐
│  Payment MiniApp     │  Learn fundamentals
│  (Tutorial 1)         │  - Wallet connection
└──────────┬──────────┘  - GAS payments
           │
           ▼
┌─────────────────────┐
│  Provably Fair Game   │  Add randomness
│  (Tutorial 2)         │  - VRF integration
└──────────┬──────────┘  - Game state
           │              - Leaderboards
           ▼
┌─────────────────────┐
│  Governance Voting   │  Advanced patterns
│  (Tutorial 3)         │  - Smart contracts
└───────────────��─────┘  - On-chain voting
                       - Proposals
```

## What You'll Learn

**After completing all tutorials, you'll be able to:**

- ✅ Connect to NeoLine wallets and retrieve addresses
- ✅ Send GAS payments with custom memos
- ✅ Request provably fair randomness from TEE
- ✅ Build game logic with state management
- ✅ Interact with smart contracts
- ✅ Cast on-chain votes with NEO
- ✅ Deploy MiniApps to the Neo N3 platform

## Prerequisites

Before starting any tutorial, ensure you have:

- **NeoLine N3 Wallet** - [Download](https://neoline.io/)
- **Testnet GAS** - [Faucet](https://neowish.neoline.io/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Text Editor** - VS Code recommended

## Quick Start

1. Start with **Tutorial 1** if you're new to MiniApps
2. Complete tutorials in order (each builds on the previous)
3. Reference the production examples in `miniapps-uniapp/apps/`
4. Check the [SDK API Documentation](../API_DOCUMENTATION.md) for details

## Tutorial Features

Each tutorial includes:

- **Complete working code** - Copy-paste ready
- **Step-by-step instructions** - Follow at your own pace
- **Code explanations** - Understand what each part does
- **Testing guidance** - Verify before deploying
- **Deployment instructions** - Get your MiniApp live
- **Troubleshooting** - Common issues and solutions

## Production Examples

After completing the tutorials, explore the full production examples:

| Category   | Example                                                      | Description            |
| ---------- | ------------------------------------------------------------ | ---------------------- |
| Games      | [coin-flip](../../miniapps-uniapp/apps/coin-flip/)           | Provably fair gambling |
| Social     | [ex-files](../../miniapps-uniapp/apps/ex-files/)             | Encrypted file storage |
| Finance    | [dev-tipping](../../miniapps-uniapp/apps/dev-tipping/)       | Developer tips         |
| Governance | [candidate-vote](../../miniapps-uniapp/apps/candidate-vote/) | Candidate voting       |

## Need Help?

- **Documentation Index:** [INDEX.md](../INDEX.md)
- **API Reference:** [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)
- **Platform Workflows:** [WORKFLOWS.md](../WORKFLOWS.md)
- **Manifest Spec:** [manifest-spec.md](../manifest-spec.md)

## Support

Found a bug or have questions?

- **GitHub Issues:** [Submit an issue](https://github.com/R3E-Network/service_layer/issues)
- **Discord:** [Join our community](https://discord.gg/)
- **Email:** support@example.com

---

**Ready to start?** Begin with [Tutorial 1: Payment MiniApp](./01-payment-miniapp/) →
