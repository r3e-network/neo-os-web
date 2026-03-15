# Quadratic Funding MiniApp

Quadratic Funding lets communities run public grant rounds with matching pools. Donors contribute to projects during active rounds, matching is computed off-chain, and projects claim contributions + matching once the round is finalized.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-quadratic-funding` |
| **Category** | DeFi / Governance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Democratic funding for community projects

Quadratic Funding is a revolutionary mechanism that amplifies the voice of small donors. Unlike traditional funding where wealthy donors have disproportionate influence, quadratic funding ensures that projects with broad community support receive more matching funds, creating a more equitable and democratic funding ecosystem.

## Features

- **🎯 Create Matching Rounds**: Set up funding rounds with customizable matching pools in GAS
- **📋 Project Registration**: Allow projects to register with descriptions, links, and ownership verification
- **💰 Transparent Contributions**: Donors can contribute GAS to projects with full on-chain transparency
- **📊 Real-Time Statistics**: Track contributions, unique donor counts, and matching allocations
- **⚖️ Fair Matching Algorithm**: Quadratic formula ensures small donors have proportionally more impact
- **🔒 Secure Fund Management**: Time-locked rounds with creator controls and anti-fraud measures
- **✅ Claim System**: Projects can claim both contributions and matching funds after round finalization
- **📱 Mobile-First Design**: Optimized interface for mobile wallets and on-the-go participation

## Usage

### Getting Started

1. **Launch the App**: Open Quadratic Funding from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet to participate in funding rounds
3. **Select a Round**: Browse active rounds or create your own

### Creating a Funding Round

1. **Navigate to Rounds Tab**: Click on "Rounds" in the navigation
2. **Fill Round Details**:
   - **Title**: Name your funding round (e.g., "Neo Ecosystem Grants Q1 2026")
   - **Description**: Describe the purpose and criteria for the round
   - **Matching Pool**: Enter the amount of GAS you want to allocate for matching
   - **Start Time**: Set when contributions will begin (format: YYYY-MM-DD HH:MM)
   - **End Time**: Set when the round will close for new contributions
3. **Click "Create Round"**: Sign the transaction to deploy the round on-chain
4. **Add Matching Funds**: After creation, you can add additional matching pool funds

### Registering a Project

1. **Select an Active Round**: Choose a round that is accepting project registrations
2. **Go to Projects Tab**: Click on "Projects" in the navigation
3. **Fill Project Details**:
   - **Project Name**: Enter the name of your project
   - **Description**: Describe what your project does and why it deserves funding
   - **Project Link**: Add a URL to your project website or documentation
4. **Click "Register Project"**: Sign the transaction to register on-chain
5. **Share Your Project**: Once registered, share your project with the community

### Making Contributions

1. **Select a Round and Project**: Navigate to the "Contribute" tab
2. **Choose Amount**: Enter the amount of GAS you want to contribute
3. **Add a Memo** (optional): Leave a message for the project team
4. **Click "Contribute"**: Sign the transaction to send your contribution
5. **Track Impact**: Watch how your contribution affects the project's matching allocation

### Understanding Quadratic Matching

The matching algorithm works as follows:
- **Individual contributions** are summed for each project
- **Unique donor count** matters more than contribution size
- **Matching formula**: (√sum_of_sqrt_contributions)² - sum_of_contributions
- **Example**: 10 donors giving 1 GAS each generates more matching than 1 donor giving 10 GAS

### Finalizing and Claiming

**For Round Creators:**
1. Wait for the round end time to pass
2. Calculate matching allocations using the quadratic formula
3. Submit project IDs and matched amounts as JSON arrays
4. Click "Finalize Round" to distribute matching funds
5. Claim any unused matching pool funds

**For Project Owners:**
1. Navigate to your registered project
2. Click "Claim" once the round is finalized
3. Receive both contributions and matching funds in one transaction

### Admin Tools

Round creators have access to:
- **Add Matching**: Increase the matching pool at any time
- **Finalize Round**: Distribute matching funds after round ends
- **Claim Unused**: Recover unallocated matching funds after finalization

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Quadratic Funding Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐    │
│   │   Round     │───►│  Project    │───►│  Contribution   │    │
│   │   Factory   │    │  Registry   │    │  Tracking       │    │
│   └─────────────┘    └─────────────┘    └─────────────────┘    │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│   ┌─────────────────────────────────────────────────────┐      │
│   │              Smart Contract Layer                   │      │
│   │  - Round creation with time locks                   │      │
│   │  - Project registration with ownership              │      │
│   │  - Contribution recording with memos                │      │
│   │  - Matching calculation and distribution            │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                 │
│   Quadratic Matching Formula:                                   │
│   ┌────────────────────────────────────────┐                   │
│   │  Matchᵢ = (√∑√cᵢⱼ)² - ∑cᵢⱼ           │                   │
│   │  Where cᵢⱼ = contribution j to       │                   │
│   │  project i                          │                   │
│   └────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Round Creation**: Creator deploys a round contract with matching pool, timeline, and asset type
2. **Project Registration**: Projects register with metadata, verified by round parameters
3. **Contribution Phase**: Donors contribute GAS to projects during the active window
4. **Off-Chain Calculation**: Matching amounts are computed using the quadratic formula
5. **Finalization**: Creator submits calculated matches, contract distributes funds
6. **Claiming**: Projects claim their contributions + matching allocations

### Smart Contract Structure

**Round Contract:**
- Stores round metadata (title, description, timeline)
- Manages matching pool funds
- Tracks project registrations
- Controls finalization and cancellation

**Project Records:**
- Owner address verification
- Contribution totals per donor
- Unique donor count tracking
- Claim status tracking

**Security Features:**
- Time-locked rounds (no early finalization)
- Creator-only admin functions
- Anti-spam project registration fees
- Immutable contribution records

### Technical Implementation

**Frontend Components:**
- Round creation form with validation
- Project registration wizard
- Contribution interface with amount validation
- Real-time statistics dashboard
- Admin tools for round creators

**Blockchain Integration:**
- Neo N3 smart contract calls via wallet SDK
- Event listening for real-time updates
- Gas estimation and fee management
- Multi-sig support for round creators

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- All contributions recorded on-chain with donor addresses
- Matching distributions executed via smart contract
- Round metadata permanently stored
- Project ownership verified via cryptographic signatures

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | `https://testnet.neotube.io` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | `https://neotube.io` |

> Contract deployment is pending; `neo-manifest.json` keeps empty addresses until deployment.

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

- **Allowed Assets**: GAS, NEO
- **Minimum Contribution**: 0.1 GAS
- **Matching Pool**: No minimum, but rounds with < 100 GAS may have limited impact

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
apps/quadratic-funding/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue           # Main app interface
│   │   │   └── components/         # Tab components
│   │   └── docs/
│   │       └── index.vue           # Documentation view
│   ├── composables/
│   │   └── useI18n.ts              # Internationalization
│   └── static/
│       └── logo.jpg
├── package.json
└── README.md
```

### Computing Matching Allocations

Use the helper script to compute quadratic matching:

```bash
node scripts/quadratic-funding-matching.js --input data.json --decimals 8
```

Input format:
```json
{
  "projects": [
    {"id": 1, "contributions": [100, 200, 300]},
    {"id": 2, "contributions": [500, 500]}
  ]
}
```

## Troubleshooting

**"Contract not deployed" error:**
- Check that you're connected to the correct network
- Verify the round ID exists and is active

**"Invalid contribution amount":**
- Minimum contribution is 0.1 GAS
- Ensure you have sufficient balance for gas fees

**"Round not active":**
- Check the round start and end times
- Rounds cannot receive contributions outside their active window

**Matching calculation issues:**
- Ensure project IDs and matched amounts arrays have the same length
- All amounts must be in the correct decimal format (8 decimals for GAS)

## Support

For questions about quadratic funding mechanics, visit the Neo governance forums.

For technical issues with the MiniApp, contact the Neo MiniApp team.
