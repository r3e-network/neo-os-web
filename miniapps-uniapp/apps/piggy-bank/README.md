# ZK Piggy Bank 零知识存钱罐

A privacy-focused savings account using Zero-Knowledge proofs. Supports any NEP-17 token.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-piggy-bank` |
| **Category** | Finance |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Private goal-based savings vaults on Neo N3

ZK Piggy Bank allows you to save any NEP-17 token toward a target and lock it until a chosen date. Zero-knowledge proofs keep balances private until you decide to smash the bank. Connect an Neo N3 wallet and configure RPC RPC before use.

## Features

- **🔒 Zero-Knowledge Privacy**: Balances remain hidden until withdrawal using zk-SNARKs
- **🪙 Any NEP-17**: Deposit ETH, stablecoins, or any token contract address
- **⏰ Time-Locked Vaults**: Funds are locked until your chosen unlock date
- **🎯 Goal Tracking**: Set and track savings targets privately
- **🌐 Multi-Chain Ready**: Works across major Neo N3 networks with RPC config
- **🔐 Local Secrets**: Savings secrets stay on your device for safety
- **✅ ZK Verification**: Check goal progress without exposing actual amounts
- **💥 Smash to Withdraw**: Break the piggy bank when you're ready to access funds
- **🎨 Vibrant Theme**: Colorful, friendly interface with glass-morphism design

## Usage

### Getting Started

1. **Launch the App**: Open ZK Piggy Bank from your Neo MiniApp dashboard
2. **Configure Settings**: 
   - Go to Settings tab
   - Enter RPC API key
   - Select your Neo N3 network
   - Save configuration
3. **Connect Wallet**: Click "Connect Wallet" to link your Neo N3 wallet
4. **Create a Piggy Bank**: Start saving with privacy

### Creating a Piggy Bank

1. **Click "Create Piggy Bank"** (or the + FAB button)
2. **Configure Your Savings Goal**:
   - **Name**: Give your savings goal a memorable name
   - **Purpose**: Describe what you're saving for
   - **Token**: Select from common tokens or enter custom contract address
   - **Target Amount**: Set your savings goal
   - **Unlock Date**: Choose when funds become available
3. **Review and Confirm**: Check all details before creating
4. **Sign Transaction**: Approve the creation in your wallet
5. **Secret Generation**: Your private viewing secret is generated locally

### Making Deposits

1. **Select a Piggy Bank**: Tap any bank card from your list
2. **Click "Deposit"**:
   - Enter deposit amount
   - Review token approval (if first time)
   - Confirm transaction
3. **Privacy Preserved**: Balance encrypted with zero-knowledge proof
4. **View Updated Progress**: See progress toward your goal (privately)

### ZK Verify - Checking Progress

Verify your savings without revealing the actual amount:

1. **Open a Piggy Bank**: Go to detail view
2. **Click "ZK Verify"**:
   - Generates proof you have ≥ X amount
   - Doesn't reveal actual balance
   - Validates goal completion privately
3. **Share Proof**: Optional - share verification with others
4. **Privacy Maintained**: Real balance never exposed

### Withdrawing Funds

When unlock date arrives:

1. **Open Your Piggy Bank**: Select from main list
2. **Click "Smash Bank"**:
   - Confirm you want to withdraw
   - All funds returned to your wallet
   - Bank is destroyed
3. **Or Partial Withdraw**: Withdraw some, keep saving
4. **Secret Revealed**: Upon full withdrawal, balance becomes visible

### Managing Settings

**Settings Tab:**
1. **Network Selection**: Choose from supported Neo N3 chains:
   - Neo N3 Mainnet
   - Polygon
   - Arbitrum
   - Optimism
   - Base
   - And more...

2. **RPC API Key**:
   - Get free key from alchemy.com
   - Required for blockchain data
   - Stored locally on your device

3. **WalletConnect Project ID**:
   - Optional: for improved wallet connections
   - Get from WalletConnect dashboard

4. **Contract Address**:
   - Auto-populated per network
   - Can override for custom deployments
   - Must be valid ZK Piggy Bank contract

**Configuration Tips:**
- Keep API keys secure
- Use mainnet for real funds
- Test on testnets first
- Verify contract addresses

### Security Best Practices

⚠️ **Critical Warnings:**

- **Backup Your Secret**: The viewing secret is required to see balances. Lost secret = can't verify holdings!
- **Test First**: Always test with small amounts
- **Verify Contracts**: Ensure you're using official contract addresses
- **Secure RPC**: Use private RPC endpoints when possible
- **Local Storage**: Secrets stored in browser - use secure devices

## How It Works

### Zero-Knowledge Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              ZK Piggy Bank Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    User Device                       │  │
│   │  ┌──────────────┐    ┌──────────────────────────┐   │  │
│   │  │   Wallet     │    │   ZK Circuit Client      │   │  │
│   │  │   (Neo N3)      │◄──►│   - Secret generation    │   │  │
│   │  └──────────────┘    │   - Proof generation     │   │  │
│   │                      │   - Balance encryption   │   │  │
│   │                      └──────────────────────────┘   │  │
│   └──────────────────────────┬──────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Neo N3 Blockchain                         │  │
│   │  ┌─────────────────────────────────────────────┐   │  │
│   │  │  ZK Piggy Bank Smart Contract               │   │  │
│   │  │  - Commitments: hash(amount, secret)        │   │  │
│   │  │  - Verifier: zk-SNARK verification          │   │  │
│   │  │  - Time locks: unlock timestamp             │   │  │
│   │  └─────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Zero-Knowledge Flow:                                      │
│   1. User deposits tokens (amount visible)                  │
│   2. System generates random secret                         │
│   3. Creates commitment: C = hash(amount, secret)           │
│   4. Stores commitment on-chain (amount hidden)             │
│   5. User can prove: balance ≥ X (without revealing)        │
│      via zk-SNARK proof                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation

**Smart Contract Components:**
- **PiggyBank Factory**: Creates individual savings vaults
- **Vault Contract**: Holds deposits with time locks
- **Verifier Contract**: Validates zk-SNARK proofs
- **Token Integration**: Standard NEP-17 interactions

**Zero-Knowledge Circuits:**
- **Deposit Circuit**: Proves valid deposit amount
- **Balance Proof Circuit**: Proves balance ≥ threshold
- **Withdrawal Circuit**: Proves ownership and unlock time

**Client-Side Processing:**
- Secret generation using cryptographically secure RNG
- Proof generation in browser using snarkjs
- Local storage of viewing secrets

### Privacy Guarantees

**What's Hidden:**
- Actual balance amounts
- Individual deposit amounts (after initial)
- Total savings value
- Transaction patterns

**What's Visible:**
- Piggy bank exists (on-chain)
- Time lock status (expired/active)
- Token type (NEP-17 contract)
- Goal amount (if set publicly)

### Supported Networks

- Neo N3 Mainnet
- Polygon (PoS)
- Arbitrum One
- Optimism
- Base
- Sepolia (testnet)
- Mumbai (testnet)

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

- No on-chain contract is deployed; the app relies on off-chain APIs and wallet signing flows.

## Network Configuration

No on-chain contract is deployed.

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

- **Allowed Assets**: All (any token)

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
apps/piggy-bank/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main list view
│   │   │   └── piggy-bank-theme.scss
│   │   ├── create/
│   │   │   └── create.vue             # Create piggy bank
│   │   └── detail/
│   │       └── detail.vue             # Bank detail/operations
│   ├── stores/
│   │   └── piggy.ts                   # Pinia store
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### Key Dependencies

- `ethers`: Neo N3 interactions
- `snarkjs`: Zero-knowledge proof generation
- `circomlibjs`: ZK circuit utilities
- `@reown/appkit`: Wallet connection
- `pinia`: State management
- `viem`: Modern Neo N3 library

### ZK Circuit Files

Circuits are compiled and stored in:
```
public/circuits/
├── deposit.wasm
├── deposit.zkey
├── balance_proof.wasm
├── balance_proof.zkey
├── withdraw.wasm
└── withdraw.zkey
```

## Troubleshooting

**"Missing config" warning:**
- Add RPC API key in Settings
- Select a network
- Save settings before proceeding

**Wallet not connecting:**
- Check WalletConnect configuration
- Ensure correct network in wallet
- Try refreshing the page

**ZK proof generation slow:**
- First proof may take 30-60 seconds
- Subsequent proofs are faster
- Depends on device performance

**Cannot see balance:**
- You need the viewing secret
- Secret is generated on creation
- Store it securely - cannot be recovered!

**Contract errors:**
- Verify correct contract address
- Check network matches your wallet
- Ensure sufficient ETH for gas

**Token approval failing:**
- Some tokens require specific approval patterns
- Try approving max amount first
- Check token contract isn't paused

## Warning: Beta Software

ZK Piggy Bank uses advanced cryptography. While thoroughly tested:

- Start with small amounts
- Understand the technology
- Keep secrets backed up
- Report bugs immediately

## Support

For ZK-related questions, consult the snarkjs documentation.

For app issues, contact the Neo MiniApp team.
