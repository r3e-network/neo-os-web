# Neo Name Service Neo 域名服务

Register and manage human-readable .neo domain names for your wallet

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-ns` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Human-readable .neo domain names for Neo addresses

Neo Name Service lets you register memorable .neo domains that map to your wallet address. Send and receive assets using simple names like alice.neo instead of complex addresses.

## Features

- **🔍 Domain Search**: Check availability of .neo domain names instantly
- **💰 Dynamic Pricing**: Prices vary based on domain length (shorter = premium)
- **📝 Easy Registration**: Register domains directly through the app
- **🔄 Domain Management**: View, renew, and manage your owned domains
- **🎯 Target Setting**: Configure domain resolution to wallet addresses
- **🔄 Domain Transfer**: Transfer ownership to other addresses
- **📅 Expiry Tracking**: Monitor renewal dates and avoid expiration
- **🖥️ CRT Theme**: Retro terminal aesthetic inspired by vintage monitors

## Usage

### Getting Started

1. **Launch the App**: Open Neo Name Service from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo wallet to register or manage domains
3. **Ensure GAS Balance**: Have sufficient GAS for registration fees

### Registering a Domain

**Register Tab:**
1. **Search for a Domain**:
   - Enter desired name (without .neo extension)
   - App automatically checks availability
   - Results show within 500ms

2. **Review Availability**:
   - **Available**: Shows registration price in GAS
   - **Premium**: Domains ≤3 characters cost more
   - **Taken**: Shows current owner address

3. **Register**:
   - Click "Register Now" button
   - Confirm transaction in your wallet
   - Wait for on-chain confirmation
   - Domain appears in your Domains tab

### Managing Your Domains

**Domains Tab:**
1. **View Owned Domains**:
   - List of all domains you own
   - Expiration dates displayed
   - Active status indicators

2. **Manage a Domain**:
   - Click "Manage" on any domain card
   - View detailed information:
     - Current owner
     - Target/resolved address
     - Expiration date

3. **Set Target Address**:
   - Enter the wallet address to resolve to
   - Click "Set Target"
   - Confirm transaction
   - Domain now resolves to that address

4. **Transfer Domain**:
   - Enter recipient address
   - Click "Transfer Domain"
   - Confirm transaction
   - Ownership transferred as NFT

5. **Renew Domain**:
   - Click "Renew" on expiring domains
   - Pay renewal fee in GAS
   - Extends registration period
   - Prevents expiration and loss of domain

### Domain Pricing

Prices are based on character count:

| Length | Price Tier | Example |
|--------|------------|---------|
| 1 char | Premium++ | a.neo |
| 2 chars | Premium+ | ab.neo |
| 3 chars | Premium | abc.neo |
| 4+ chars | Standard | alice.neo |

*Exact prices fetched in real-time from the NNS contract*

### Using Your Domain

Once registered and configured:
1. Share your .neo domain instead of addresses
2. Others can send NEO/GAS to your domain
3. dApps can resolve your domain to your wallet
4. Domain acts as an NFT - tradeable and transferable

## How It Works

### NNS Architecture

Neo Name Service is built on Neo N3 as a NEP-11 (NFT) contract:

```
┌─────────────────────────────────────────────────────────────┐
│              Neo Name Service Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐      ┌─────────────┐      ┌────────────┐ │
│   │    User     │─────►│   NNS Mini  │─────►│ NNS Contract│ │
│   │             │◄─────│     App     │◄─────│  (NEP-11)   │ │
│   └─────────────┘      └──────┬──────┘      └────────────┘ │
│                               │                             │
│                      ┌────────┴────────┐                   │
│                      │  MiniApp API    │                   │
│                      │  - Search       │                   │
│                      │  - Availability │                   │
│                      │  - Price lookup │                   │
│                      └─────────────────┘                   │
│                                                             │
│   NNS Contract Operations:                                  │
│   • register(name, owner)                                   │
│   • renew(name)                                             │
│   • setTarget(name, address)                                │
│   • transfer(to, tokenId)                                   │
│   • tokensOf(owner)                                         │
│   • properties(tokenId)                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Domain Resolution

1. **Registration**: Creates NFT with domain as token ID
2. **Storage**: Domain metadata stored on-chain
3. **Resolution**: Target address retrieved via contract call
4. **Transfer**: NFT ownership changes hands

### Technical Details

**Token ID Format:**
- Domain name encoded as UTF-8 bytes
- Base64 encoded for contract storage
- Example: "alice.neo" → base64 encoded bytes

**Contract Methods:**
- `isAvailable(name)`: Check if domain can be registered
- `getPrice(length)`: Get registration price for name length
- `register(name, owner)`: Mint domain NFT to owner
- `renew(name)`: Extend registration period
- `setTarget(name, address)`: Configure resolution address
- `ownerOf(tokenId)`: Get domain owner
- `tokensOf(owner)`: List domains owned by address
- `properties(tokenId)`: Get domain metadata

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

- Validates payments on-chain (PaymentHub receipts when enabled).

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x50ac1c37690cc2cfc594472833cf57505d5f46de` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x50ac1c37690cc2cfc594472833cf57505d5f46de) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | Not deployed |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [NeoTube](https://neotube.io) |
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
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

### Mainnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| Morpheus Oracle | `0x017520f068fd602082fe5572596185e62a4ad991` |

## Assets

- **Allowed Assets**: GAS

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
apps/neo-ns/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main app (Register/Domains tabs)
│   │   │   └── neo-ns-theme.scss      # CRT terminal theme
│   │   └── docs/
│   │       └── index.vue              # Documentation
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### Smart Contract Interface

```typescript
// Domain structure
interface Domain {
  name: string;        // Full domain (e.g., "alice.neo")
  owner: string;       // Owner address
  expiry: number;      // Expiration timestamp
  target?: string;     // Resolution address
}

// Contract operations
interface NNSContract {
  isAvailable(name: string): boolean;
  getPrice(length: number): number;
  register(name: string, owner: string): void;
  renew(name: string): void;
  setTarget(name: string, address: string): void;
  ownerOf(tokenId: string): string;
  tokensOf(owner: string): string[];
  properties(tokenId: string): DomainProperties;
}
```

## Best Practices

**Before Registering:**
- Search multiple variations of your desired name
- Consider premium pricing for short names
- Ensure sufficient GAS balance

**Domain Management:**
- Set target address immediately after registration
- Monitor expiration dates
- Renew before expiry to prevent loss
- Keep wallet secure (domains are NFTs)

**Security:**
- Domains can be transferred like any NFT
- Target address doesn't change on transfer
- Verify target address before receiving funds

## Troubleshooting

**Registration failing:**
- Ensure sufficient GAS balance
- Check network connection
- Verify domain is still available
- Confirm wallet is connected

**Domain not showing in list:**
- Wait for transaction confirmation
- Refresh the Domains tab
- Check you're on correct network
- Verify ownership via blockchain explorer

**Cannot set target:**
- Ensure domain hasn't expired
- Check target address format
- Verify you are the owner
- Wait for any pending transactions

**Renewal issues:**
- Renew before expiration date
- Ensure sufficient GAS balance
- Cannot renew expired domains (must re-register)

## Support

For NNS contract questions, visit the Neo NNS documentation.

For app issues, contact the Neo MiniApp team.
