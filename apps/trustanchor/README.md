# TrustAnchor MiniApp

Non-profit voting delegation for Neo N3 governance.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-trustanchor` |
| **Category** | Governance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Reputation-based voting delegation platform

TrustAnchor allows NEO holders to delegate their voting power to candidates with proven reputation and active contribution. The platform operates on a zero-fee model, ensuring 100% of GAS rewards go to stakers while promoting quality governance over profit-driven delegation.

## Features

- **🗳️ Stake NEO**: Participate in governance by staking your NEO tokens
- **✅ Vote for Reputation**: Delegate voting power to candidates with proven track records
- **💰 Zero Fees**: 100% of GAS rewards go directly to stakers - no platform fees
- **📊 Transparent Stats**: View real-time staking statistics and candidate performance
- **🔍 Candidate Ranking**: Browse ranked list of governance candidates with performance metrics
- **⚡ Instant Claims**: Claim your GAS rewards at any time with no lock-up periods
- **🎛️ Full Control**: Stake and unstake at will while maintaining delegation preferences
- **📈 Performance Tracking**: Monitor candidate voting performance and reliability
- **🔐 Secure Delegation**: All operations secured by Neo N3 smart contracts

## Usage

### Getting Started

1. **Launch the App**: Open TrustAnchor from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet containing NEO tokens
3. **View Overview**: Check your current stake, pending rewards, and total earned
4. **Browse Candidates**: Explore the Agents tab to find reputable candidates

### Staking NEO

1. **Navigate to Overview Tab**: This is the main dashboard
2. **Enter Stake Amount**: In the "Stake NEO" section, enter the amount you want to stake
3. **Click "Stake"**: Confirm the transaction in your wallet
4. **Confirmation**: Your NEO will be staked and you'll start earning GAS rewards

**Important Notes:**
- Minimum stake amount may apply (check current network conditions)
- Staked NEO remains in your control and can be unstaked at any time
- Rewards accrue continuously based on network participation

### Unstaking NEO

1. **Go to Overview Tab**: View your current stake balance
2. **Enter Unstake Amount**: In the "Unstake" section, enter the amount to withdraw
3. **Click "Unstake"**: Confirm the transaction
4. **Receive NEO**: Your NEO will be returned to your wallet immediately

**Things to Consider:**
- Unstaking reduces your voting power and future rewards
- There is no lock-up period - unstaking is instant
- You must maintain some stake to continue receiving rewards

### Delegating to Candidates

1. **Visit Agents Tab**: Browse the ranked list of governance candidates
2. **Review Performance**: Each candidate shows:
   - Total votes received (in NEO)
   - Performance percentage (reliability score)
   - Historical activity
3. **Select a Candidate**: Click on a candidate to view detailed information
4. **Delegate Your Vote**: Follow the delegation process to assign your voting power

**Voting Philosophy:**
TrustAnchor promotes voting based on:
- **Active contribution** to the Neo ecosystem
- **Proven track record** in governance participation
- **Technical expertise** and community involvement
- **Long-term commitment** to Neo's success

### Claiming Rewards

1. **Check Pending Rewards**: View your accumulated GAS in the Overview tab
2. **Click "Claim"**: In the Claim section, click the claim button
3. **Confirm Transaction**: Sign the transaction in your wallet
4. **Receive GAS**: Rewards are sent directly to your wallet

**Reward Information:**
- Rewards accrue in real-time as blocks are produced
- Claim frequency is up to you - hourly, daily, or weekly
- All claimed amounts are added to your "Total Rewards" tracker

### Understanding the Stats

**Overview Tab Metrics:**
- **My Stake**: Amount of NEO you have staked
- **Pending Rewards**: GAS rewards available to claim
- **Total Rewards**: Lifetime GAS earned through staking

**History Tab Statistics:**
- **Total Staked**: Combined NEO staked by all users
- **Delegators**: Number of unique participants
- **Vote Power**: Total voting power delegated through the platform
- **Estimated APR**: Projected annual percentage return

### Reviewing Philosophy

The History tab includes detailed explanations of TrustAnchor's core principles:
- Non-profit operation model
- Importance of reputation-based voting
- Long-term ecosystem health over short-term gains

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   TrustAnchor Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                  Neo N3 Blockchain                    │     │
│   │  ┌──────────────────────────────────────────────┐   │     │
│   │  │         TrustAnchor Smart Contract            │   │     │
│   │  │  - Stake management                           │   │     │
│   │  │  - Vote delegation recording                  │   │     │
│   │  │  - GAS reward distribution                    │   │     │
│   │  │  - Candidate performance tracking             │   │     │
│   │  └──────────────────────────────────────────────┘   │     │
│   │                       │                             │     │
│   │                       ▼                             │     │
│   │  ┌──────────────────────────────────────────────┐   │     │
│   │  │         Neo Native Governance                 │   │     │
│   │  │  - Consensus node voting                      │   │     │
│   │  │  - GAS generation                             │   │     │
│   │  └──────────────────────────────────────────────┘   │     │
│   └──────────────────────────────────────────────────────┘     │
│                                                                 │
│   Reward Flow:                                                  │
│   1. NEO holders stake tokens in TrustAnchor contract          │
│   2. Contract delegates votes to selected candidates           │
│   3. Neo network generates GAS rewards                         │
│   4. 100% of rewards distributed to stakers (0% fees)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Contract Functions

**Staking:**
- `stake(amount)`: Lock NEO tokens in the contract
- `unstake(amount)`: Withdraw NEO tokens
- `claimRewards()`: Withdraw accumulated GAS

**Delegation:**
- `delegateVote(candidate)`: Assign voting power to a candidate
- `undelegate()`: Remove delegation
- `getCandidateStats()`: Retrieve candidate performance data

**Query Functions:**
- `getStake(address)`: Check user's staked amount
- `getPendingRewards(address)`: View claimable rewards
- `getTotalStats()`: Platform-wide statistics

### Zero-Fee Model

Unlike traditional staking platforms that charge 5-20% fees, TrustAnchor operates with:
- **0% Platform Fee**: All rewards go to stakers
- **0% Management Fee**: No hidden costs
- **Transparent Operation**: All fees (or lack thereof) visible on-chain

This is made possible by:
- Community-driven development
- Minimal operational overhead
- Focus on ecosystem growth over profit

### Candidate Scoring

Candidates are ranked based on:
1. **Vote Count**: Total NEO delegated to them
2. **Performance**: Percentage of votes cast vs. opportunities
3. **Activity**: Recent governance participation
4. **Reputation**: Community standing and contributions

## Permissions

| Permission | Status | Purpose |
|------------|--------|---------|
| `wallet` | ✅ | Wallet connection and transaction signing |
| `governance` | ✅ | Vote delegation and candidate selection |
| `payments` | ❌ | Not required (no payment processing) |
| `rng` | ❌ | Not required |

## On-chain behavior

- Staking/unstaking requires on-chain transactions
- Vote delegation is recorded on-chain
- GAS rewards distributed via smart contract
- All operations verifiable on Neo explorers

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x0000000000000000000000000000000000000000` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x0000000000000000000000000000000000000000` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io) |
| **Network Magic** | `860833102` |

> Contract addresses are placeholders pending deployment.

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### Mainnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

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
