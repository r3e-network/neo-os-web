# Neo Multisig Neo 多重签名

Create multisig transfer requests and collect signatures securely.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-multisig` |
| **Category** | utilities |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Secure multi-signer transfers

Create a multisig transaction, collect approvals from multiple signers, and broadcast once the threshold is reached. Perfect for treasury management, shared wallets, and organizational funds requiring multiple approvals.

## Features

- **🔐 Multi-Signer Security**: Require multiple approvals before funds can move
- **📋 Threshold Configuration**: Set custom signature requirements (e.g., 2-of-3, 3-of-5)
- **📤 Transaction Sharing**: Share transaction IDs with co-signers easily
- **📊 Progress Tracking**: Monitor signature collection progress in real-time
- **📜 History Management**: View and manage past multisig transactions
- **🔒 On-chain Security**: Uses Neo N3 native multisig witnesses for final execution
- **⚡ Signer Control**: Only listed public keys can approve the request

## Usage

### Getting Started

1. **Launch the App**: Open Neo Multisig from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo wallet to begin creating or signing transactions
3. **Choose Action**: Create a new transaction or load an existing one

### Creating a Multisig Transaction

1. **Click "Create Multisig Transaction"**: From the home screen
2. **Configure Signers**:
   - Add all participant public keys (one per line)
   - Set the required signature threshold (e.g., 2 of 3)
   - Minimum threshold is 1, maximum equals number of signers
3. **Define Transfer**:
   - Enter recipient address
   - Select asset type (NEO, GAS, or other NEP-17 tokens)
   - Specify transfer amount
4. **Review Fees**: Check the estimated network fee
5. **Create Transaction**: Submit to generate the transaction request
6. **Share Request ID**: Copy and distribute the transaction ID to all signers

### Signing a Transaction

1. **Load Transaction**: 
   - Enter the transaction ID in the "Load Existing" field
   - Or click a transaction from your history
2. **Review Details**:
   - Verify recipient address
   - Confirm amount and asset
   - Check your signing status
3. **Add Signature**:
   - Review the transaction summary
   - Click "Sign Transaction"
   - Confirm in your wallet
4. **Monitor Progress**: Watch the signature counter update

### Managing Transactions

**History View:**
1. View all your past multisig transactions
2. See current status for each:
   - ⏳ **Pending**: Awaiting more signatures
   - ✅ **Ready**: Threshold reached, ready to broadcast
   - 🚀 **Broadcasted**: Successfully sent to network
   - ❌ **Cancelled**: Aborted by participants
   - ⏰ **Expired**: Time limit exceeded

**Quick Stats:**
- Total transactions created
- Pending signatures awaiting your approval
- Completed transactions

### Broadcast Workflow

Once enough signatures are collected:

1. Any signer can broadcast the transaction
2. The app combines all signatures into a valid witness
3. Transaction is submitted to the Neo N3 network
4. All signers receive confirmation

## How It Works

### Multisig Architecture

Neo Multisig leverages Neo N3's native multisignature capabilities:

```
┌─────────────────────────────────────────────────────────────┐
│                    Multisig Process                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Signer 1  │    │   Signer 2  │    │   Signer 3  │     │
│  │  (Creator)  │    │  (Approver) │    │  (Approver) │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         │  Creates Tx      │                  │             │
│         ├─────────────────►│                  │             │
│         │  Shares ID       │                  │             │
│         ├──────────────────┼─────────────────►│             │
│         │                  │  Reviews & Signs │             │
│         │◄─────────────────┼──────────────────┤             │
│         │                  │                  │  Signs      │
│         │◄─────────────────┼──────────────────┼─────────────┤
│         │                  │                  │             │
│         │  Broadcasts when threshold (2/3) met              │
│         ├────────────────────────────────────────────────►  │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Neo N3 Blockchain                       │   │
│  │   ┌─────────────────────────────────────────────┐   │   │
│  │   │  Multisig Witness: [Sig1] + [Sig2] ≥ 2-of-3 │   │   │
│  │   └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation

**Transaction Creation:**
1. Collects all signer public keys
2. Builds multisig witness script with threshold
3. Creates unsigned transaction
4. Generates unique request ID
5. Stores transaction data locally and/or backend

**Signature Collection:**
1. Each signer loads transaction by ID
2. Reviews transaction details
3. Signs using their private key
4. Signature stored and tracked
5. Progress updated for all viewers

**Broadcast:**
1. Combines all collected signatures
2. Constructs complete witness
3. Validates signature count ≥ threshold
4. Broadcasts to Neo N3 network
5. Returns transaction hash

### Security Features

- **Native Multisig**: Uses Neo N3's built-in multisignature support
- **No Private Key Sharing**: Each signer uses their own wallet
- **Immutable Threshold**: Cannot be changed after creation
- **On-chain Verification**: Signatures verified by Neo VM

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |
| Confidential | ✅ Yes |

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

### Project Structure

```
apps/neo-multisig/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Home screen
│   │   │   └── neo-multisig-theme.scss
│   │   ├── create/
│   │   │   └── index.vue              # Transaction creation
│   │   ├── sign/
│   │   │   └── index.vue              # Signing interface
│   │   └── docs/
│   │       └── index.vue              # Documentation
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### Dependencies

- `@cityofzion/neon-core`: Neo N3 blockchain interaction
- `@noble/curves`: Cryptographic operations
- `qrcode`: QR code generation for sharing

## Best Practices

**For Transaction Creators:**
- Always verify recipient addresses carefully
- Set appropriate thresholds (higher for larger amounts)
- Share transaction IDs through secure channels
- Keep a backup of signer public keys

**For Signers:**
- Always review transaction details before signing
- Verify the recipient address independently
- Never sign transactions you didn't expect
- Confirm threshold requirements are reasonable

**For Organizations:**
- Use hardware wallets for signing when possible
- Maintain a secure list of authorized signers
- Test the workflow with small amounts first
- Document your multisig procedures

## Troubleshooting

**Transaction ID not found:**
- Ensure correct network (MainNet vs TestNet)
- Check for typos in the transaction ID
- Verify the transaction hasn't expired

**Signature not counting:**
- Confirm your public key is in the signer list
- Check you're connected with the correct wallet
- Ensure network connection is stable

**Broadcast failing:**
- Verify threshold signatures are collected
- Check all signers used the same network
- Ensure sufficient GAS for network fees

## Support

For multisig-related questions, consult the Neo N3 documentation on multisignature contracts.
