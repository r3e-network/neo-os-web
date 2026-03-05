# Candidate Vote 候选人投票

Vote for platform candidate and earn GAS rewards

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-candidate-vote` |
| **Category** | Governance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Vote for Neo N3 consensus node candidates

Participate in Neo network governance by voting for consensus node candidates. Your NEO balance determines your voting power.


## How It Works

1. **Create Proposal**: Governance participants submit candidate proposals with a deposit
2. **Voting Period**: Token holders cast votes during the designated voting window
3. **Vote Weight**: Voting power is determined by governance token holdings
4. **Results Tally**: Votes are counted and results are calculated on-chain
5. **Execution**: Approved proposals can be queued for automatic execution
## Features

- **On-Chain Voting**: Votes are recorded directly on the Neo blockchain.
- **NEO-Based Power**: Your voting power equals your NEO holdings.

## How to use

1. Connect your Neo wallet.
2. Browse and select a candidate.
3. Click Vote Now to cast your vote.
4. Your NEO balance is your voting power.

## Usage

### Getting Started

1. **Launch the App**: Open Candidate Vote from your Neo MiniApp dashboard
2. **Connect Your Wallet**: Click "Connect Wallet" to link your Neo N3 wallet
3. **View Candidates**: Browse the list of consensus node candidates

### Voting Process

1. **Review Candidates**:
   - View candidate information including name and details
   - Check current vote counts and popularity
   - Consider candidate's contribution to the network

2. **Cast Your Vote**:
   - Click "Vote" on your chosen candidate
   - Confirm the transaction in your wallet
   - Your voting power is based on your NEO balance

3. **Change Votes**:
   - You can vote for multiple candidates
   - Votes can be changed at any time
   - Each vote uses your full voting power

### Understanding Voting Power

| Your NEO Balance | Voting Power |
|-----------------|--------------|
| 1 NEO | 1 vote |
| 10 NEO | 10 votes |
| 100 NEO | 100 votes |

### Governance Participation

- **Committee Elections**: Vote for candidates who will become part of the Neo committee
- **Network Consensus**: Your votes help determine which nodes validate transactions
- **Democratic Process**: Every NEO holder can participate in governance

### FAQ

**Can I vote for multiple candidates?**
Yes, you can split your votes among multiple candidates.

**Is there a cost to vote?**
Voting requires a small GAS fee for transaction costs.

**Can I change my vote?**
Yes, you can change or remove votes at any time.

**When are results counted?**
Votes are counted in real-time on-chain.

### Support

For governance questions, refer to Neo N3 documentation.

For technical issues, contact the Neo MiniApp team.

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- Calls the Neo native NEO contract `vote` method for governance voting (third-party deployment).
- Reads governance data via RPC (`getcandidates`, `getcommittee`, and `invokefunction`).

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5) |
| **Network Magic** | `860833102` |

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

- **Allowed Assets**: NEO, GAS

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
