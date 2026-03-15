# Neo Sign Anything Neo 任意签

Sign any message with your Neo address securely.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-sign-anything` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Cryptographic message signing for Neo N3

Sign any text message with your Neo wallet to prove ownership of an address, authenticate to services, or create verifiable commitments. Messages can also be broadcast to the blockchain for permanent, timestamped proof.

## Features

- **✍️ Message Signing**: Sign arbitrary text messages with your Neo private key
- **📜 On-Chain Broadcasting**: Permanently record messages on the Neo blockchain
- **📋 Easy Copy**: One-click copying of signatures and transaction hashes
- **🔐 Address Verification**: Prove ownership without revealing private keys
- **⚡ Quick Actions**: Sign and broadcast with minimal steps
- **🎨 Modern UI**: Clean, accessible interface with clear visual feedback
- **🔒 Secure**: Private keys never leave your wallet

## Usage

### Getting Started

1. **Launch the App**: Open Neo Sign Anything from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo wallet to begin signing
3. **Enter Message**: Type or paste the message you want to sign

### Signing a Message

1. **Enter Your Message**:
   - Type in the message textarea (max 1000 characters)
   - Character counter shows remaining space
   - Supports any text content

2. **Click "Sign Message"**:
   - Wallet will prompt for signature confirmation
   - Review the message in your wallet
   - Approve the signature request

3. **View Results**:
   - Signature displayed in result card
   - Format varies by wallet implementation
   - May include signature, public key, and salt

4. **Copy Signature**:
   - Click "Copy" button next to result
   - Use for verification or authentication
   - Share with requesting parties

### Broadcasting a Message

For permanent, on-chain proof:

1. **Enter Your Message**:
   - Same as signing process
   - Keep under 1024 bytes for successful broadcast

2. **Click "Broadcast Message"**:
   - Creates a 0 GAS transfer to yourself
   - Embeds message in transaction data
   - Wallet prompts for transaction confirmation

3. **View Transaction**:
   - Transaction hash displayed
   - Permanently recorded on Neo N3 blockchain
   - Timestamped and immutable

4. **Verify on Explorer**:
   - Copy transaction hash
   - View on NeoTube or other explorers
   - Message visible in transaction data

### Common Use Cases

**Proving Ownership:**
1. Service requests message signed with your address
2. Enter the requested message in the app
3. Sign and copy the signature
4. Submit signature to the service for verification

**Commitments:**
1. Create a statement or prediction
2. Broadcast it to the blockchain
3. Later prove you made the statement at that time
4. Useful for contests, predictions, or public commitments

**Authentication:**
1. dApp requests signed message for login
2. Sign the provided challenge message
3. dApp verifies signature matches your address
4. Authenticated without exposing private key

**Notarization:**
1. Write a document hash or summary
2. Broadcast to blockchain
3. Creates timestamped proof of existence
4. Legally useful in many jurisdictions

## How It Works

### Cryptographic Signing

```
┌─────────────────────────────────────────────────────────────┐
│                  Message Signing Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                           │
│   │   Message   │                                           │
│   │  (Text)     │                                           │
│   └──────┬──────┘                                           │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────────┐                                       │
│   │  Wallet         │                                       │
│   │  (Sign Message) │                                       │
│   └────────┬────────┘                                       │
│            │                                                │
│            ▼                                                │
│   ┌─────────────────┐      ┌──────────────┐                │
│   │  Private Key    │─────►│  Signature   │                │
│   │  (in wallet)    │      │  Generated   │                │
│   └─────────────────┘      └──────┬───────┘                │
│                                   │                         │
│                                   ▼                         │
│                          ┌──────────────┐                  │
│                          │  Signature   │                  │
│                          │  Output      │                  │
│                          └──────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### On-Chain Broadcasting

```
┌─────────────────────────────────────────────────────────────┐
│               On-Chain Broadcast Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                           │
│   │   Message   │                                           │
│   │  (Text)     │                                           │
│   └──────┬──────┘                                           │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────────────────────────────────────┐          │
│   │  Neo N3 Transaction                         │          │
│   │  ┌─────────────────────────────────────┐   │          │
│   │  │  From: Your Address                 │   │          │
│   │  │  To: Your Address                   │   │          │
│   │  │  Amount: 0 GAS                      │   │          │
│   │  │  Data: "Your message text here..."  │   │          │
│   │  └─────────────────────────────────────┘   │          │
│   └─────────────────────┬───────────────────────┘          │
│                         │                                   │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────┐          │
│   │  Neo N3 Blockchain                          │          │
│   │  (Permanent, Immutable Record)              │          │
│   └─────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technical Details

**Signing Algorithm:**
- Uses Neo N3's standard message signing
- ECDSA with secp256r1 curve
- Compatible with all Neo N3 wallets

**Broadcast Mechanism:**
- Sends 0 GAS transfer to self
- Embeds message in transaction data field
- Uses GAS contract: `0xd2a4cff31913016155e38e474a2c06d08be276cf`

**Signature Format:**
- Varies by wallet implementation
- May include:
  - Signature (hex string)
  - Public key
  - Salt/nonce
  - Wallet-specific metadata

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

- **Allowed Assets**: None

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
apps/neo-sign-anything/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main signing interface
│   │   │   └── neo-sign-anything-theme.scss
│   │   └── docs/
│   │       └── index.vue              # Documentation
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### Key Components

**Message Input:**
- Textarea with character limit (1000)
- Real-time character counter
- Placeholder with example

**Action Buttons:**
- Sign Message: Triggers wallet signature
- Broadcast Message: Creates on-chain transaction
- Loading states for async operations

**Result Cards:**
- Signature display with copy button
- Transaction hash display (for broadcasts)
- Success/error messaging

## Security Considerations

**Message Safety:**
- Always review messages before signing
- Never sign messages you don't understand
- Be cautious of phishing attempts
- Verify message source when possible

**Broadcast Costs:**
- Broadcasting requires GAS for network fees
- Signing alone is free
- Fees are standard Neo N3 transaction fees

**Signature Verification:**
- Services should always verify signatures
- Use proper Neo N3 signature verification libraries
- Confirm address matches expected signer

## Troubleshooting

**Wallet not connecting:**
- Ensure Neo wallet extension is installed
- Check you're on the correct network
- Try refreshing the page

**Sign button disabled:**
- Enter a message first
- Connect wallet before signing
- Check message length (max 1000 chars)

**Broadcast failing:**
- Ensure sufficient GAS balance
- Message may exceed 1024 bytes
- Check network connection

**Signature format varies:**
- Different wallets return different formats
- Some include metadata, others just signature
- All are valid for verification

## Use Cases by Sector

**DeFi:**
- Prove ownership for airdrops
- Sign loan agreements
- Authenticate trading positions

**Gaming:**
- Sign game moves for verification
- Prove tournament participation
- Verify item ownership

**Governance:**
- Sign voting commitments
- Create proposal attestations
- Timestamp governance decisions

**Legal:**
- Document notarization
- Contract acknowledgments
- Timestamped proof of existence

## Support

For signature verification questions, consult the Neo N3 developer documentation.

For app issues, contact the Neo MiniApp team.
