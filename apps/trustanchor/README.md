# TrustAnchor MiniApp

TrustAnchor is being rebuilt around **verification-script agent accounts**, not per-candidate agent contracts.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-trustanchor` |
| **Category** | Governance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Current Product Model

- 21 verification-script agent accounts exist in the staking model.
- Each agent account maps to one candidate target.
- Fresh user inflows always land in the **agent account for candidate 21** first.
- Admin adjusts vote exposure only by moving **real NEO** from agent A to agent B.
- There is **no** per-candidate child contract in the target architecture. Each candidate is represented by a numbered agent account instead.
- GAS rewards remain a pool-level accounting problem and are distributed pro rata to stakers.
- If the core contract has enough NEO liquidity, withdraw can settle immediately.
- If liquidity is still sitting inside agent accounts, withdraw enters a pending queue until enough NEO returns to the core contract.

## Why This Refactor Exists

The old agent-contract model added unnecessary deployment surface and extra moving parts. The new TrustAnchor miniapp is being aligned to a simpler operational model:

1. Use verification-script agent accounts as voting buckets.
2. Bind one candidate public key to each agent account.
3. Treat rebalancing as an actual asset transfer between buckets.
4. Keep fee policy simple: 0% fee, 100% rewards returned to stakers.

## Miniapp UX

The refactored miniapp now focuses on three views:

- **Overview**: pool accounting, zero-fee policy, and routing summary.
- **Routing**: all 21 verification-script agent accounts, with candidate 21 highlighted as the default ingress path.
- **Architecture**: explains the verification-script agent-account model and admin transfer rules.

There is no candidate ranking page and no old agent-contract management page anymore.

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2` |
| **RPC** | `https://n3seed1.ngd.network:20332` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `Pending verification-script agent-account rollout` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | `https://www.neo3scan.com` |
| **Network Magic** | `860833102` |

> Testnet single-contract rollout is now live. Mainnet remains intentionally unset until the verification-script agent-account operations model is validated further.

## Verified Testnet Flows

- User deposit updates `stakeOf(user)` and auto-routes the same NEO amount into `agent 21`.
- User withdraw reduces `stakeOf(user)` immediately.
- If core liquidity is unavailable, the same withdraw is recorded in `pendingWithdrawOf(user)`.
- Reward accounting uses an RPS accumulator and is covered by automated model tests in [TrustAnchorRewardModelTest.cs](/Users/jinghuiliao/git/neo-miniapps-platform/contracts/__tests__/TrustAnchorRewardModelTest.cs).

## Assets

- **Allowed Assets**: NEO (for staking), GAS (for rewards)
- **Minimum Stake**: Check current network conditions
- **Reward Asset**: GAS

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

### Project Structure

```
apps/trustanchor/
├── src/
│   ├── pages/
│   │   └── index/
│   │       ├── index.vue              # Main app component
│   │       └── components/
│   │           ├── StatsGrid.vue      # Statistics display
│   │           └── StakeForm.vue      # Staking interface
│   ├── composables/
│   │   ├── useI18n.ts                 # Internationalization
│   │   └── useTrustAnchor.ts          # Business logic
│   └── static/
├── package.json
└── README.md
```

### Composables

- `useTrustAnchor` - Core business logic for staking, delegation, and rewards

### Components

- `StatsGrid` - Displays stake statistics in a grid layout
- `StakeForm` - Stake/unstake input form

## Core Philosophy

> "Amplify voices of active contributors. Vote for reputation, not profit."

TrustAnchor exists to promote quality governance. GAS rewards are a natural incentive, but our true purpose is ensuring Neo N3 is governed by active, reputable contributors.

## Supported Chains

- Neo N3 Testnet
- Neo N3 Mainnet

## Troubleshooting

**"Connect Wallet" button not working:**
- Ensure you have a compatible Neo wallet installed
- Check that you're on Neo N3 (not Neo Legacy)

**Stake transaction failing:**
- Verify you have sufficient NEO balance
- Ensure you have GAS for transaction fees
- Check network connectivity

**No rewards showing:**
- Rewards accrue over time - wait at least a few blocks
- Verify your NEO is actually staked (check "My Stake")
- Ensure you haven't just staked (rewards start after first block)

**Cannot unstake:**
- Ensure you're not trying to unstake more than your staked amount
- Check if there's a minimum stake requirement

## License

Private - Internal use only
