# The Ex-Files

Anonymous ex-partner database with encrypted records

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-exfiles` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Add Records**: Store important file references and metadata on-chain
2. **Categorize**: Organize files into custom categories
3. **Share**: Share records with specific addresses or publicly
4. **Verify**: All records have timestamp and creator verification
5. **Retrieve**: Access your records anytime from any device
## Features

- Anonymous Records: Store encrypted records of ex-partners
- Privacy-First: All data is encrypted and anonymous
- Community Database: Contributions from the community

## Usage

### Getting Started

1. **Launch the App**: Open The Ex-Files from your Neo MiniApp dashboard
2. **Connect Wallet**: Link your Neo N3 wallet to participate
3. **Browse Records**: View anonymous ex-partner records
4. **Add Records**: Contribute to the database (requires payment)

### Adding Records

1. **Prepare Information**:
   - Gather details about the ex-partner
   - Ensure information is accurate and fair
   - Consider the impact of your contribution

2. **Submit Record**:
   - Click "Add Record" or similar action
   - Fill in the required information
   - Pay the required GAS fee for submission

3. **Verification**:
   - Records may go through a review process
   - Some records may require community verification
   - Approved records become visible to others

### Browsing Records

1. **Search**: Use search to find specific records
2. **Filter**: Filter by category or other criteria
3. **View Details**: Click on a record to see full details

### Privacy Considerations

- **Anonymity**: Records are stored anonymously
- **Encryption**: All data is encrypted on-chain
- **Permanence**: Records cannot be easily deleted

### Best Practices

- **Accuracy**: Only add accurate information
- **Fairness**: Be fair and balanced in descriptions
- **Respect**: Consider privacy and legal implications

### FAQ

**Is this anonymous?**
Yes, records are stored with encryption and no personal identifiers.

**Can I remove my record?**
Contact the app administrators for record removal requests.

**Is there a cost to add records?**
Yes, a small GAS fee is required for each submission.

**How are records verified?**
Records may go through community or admin verification.

### Support

For privacy questions, review the app's privacy policy.

For technical issues, contact the Neo MiniApp team.

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x6057934459f1ddc6c63a63bc816afed971514b43` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x6057934459f1ddc6c63a63bc816afed971514b43) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x9cfc02ad75691521cceb2ec0550e6a227251ad35` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x9cfc02ad75691521cceb2ec0550e6a227251ad35) |
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

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
