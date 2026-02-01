# Neo Explorer Neo 浏览器

Explore Neo N3 blockchain - transactions, addresses, contracts

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-explorer` |
| **Category** | tools |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Browse Neo N3 blockchain data in real-time

Explorer provides a comprehensive view of the Neo N3 blockchain. Search transactions, inspect addresses, and analyze smart contracts with a sleek Matrix-themed interface.

## Features

- **🔍 Universal Search**: Search by transaction hash, wallet address, or contract hash across both MainNet and TestNet
- **📊 Network Statistics**: Real-time display of block height and total transaction counts for both networks
- **📜 Transaction History**: View recent transactions with automatic caching for offline access
- **🔎 Detailed Results**: Comprehensive transaction and address information with related interactions
- **🎨 Matrix Theme**: Cyberpunk-inspired interface with retro terminal aesthetics
- **📱 Responsive Design**: Optimized for both desktop and mobile viewing

## Usage

### Getting Started

1. **Launch the App**: Open Neo Explorer from your Neo MiniApp dashboard
2. **Select Network**: Choose between MainNet or TestNet using the network selector
3. **Search Blockchain Data**: Enter any of the following in the search box:
   - Transaction hash (e.g., `0x...`)
   - Wallet address (e.g., `N...`)
   - Smart contract hash (e.g., `0x...`)

### Exploring the Interface

**Search Tab:**
1. Enter your query in the search field
2. Click the search button or press enter
3. View detailed information about the searched item
4. Copy relevant data to clipboard for further analysis

**Network Tab:**
1. View live statistics for both MainNet and TestNet
2. Monitor block height progression
3. Track total transaction counts
4. Data refreshes automatically every 15 seconds

**History Tab:**
1. Browse recently searched transactions
2. Click any transaction to view details again
3. Access cached data even when offline
4. Clear history by refreshing the page

**Documentation Tab:**
1. Read comprehensive app documentation
2. Learn about available features
3. Understand how to interpret blockchain data

### Tips for Effective Searching

- **Transaction Hashes**: Always include the `0x` prefix for best results
- **Addresses**: Use the complete Neo address starting with `N`
- **Contract Hashes**: Include the full 40-character hash with `0x` prefix
- **Network Selection**: Ensure you're searching on the correct network (MainNet vs TestNet)

## How It Works

### Architecture

Neo Explorer operates as a lightweight blockchain data viewer with the following components:

**Frontend (Vue 3 + uni-app):**
- Responsive layout with tab-based navigation
- Matrix-themed UI with custom CSS animations
- Client-side caching for improved performance

**Data Layer:**
- Fetches data via `/api/explorer` endpoints
- Automatic fallback to cached data when network is unavailable
- 15-second polling interval for live statistics

**Caching System:**
- Local storage for network statistics
- Transaction history caching
- Offline-first design for better user experience

### Data Flow

1. **User Input**: Search query entered and validated
2. **API Request**: Query sent to backend explorer API
3. **Data Processing**: Response parsed and formatted for display
4. **Cache Update**: Results stored locally for future reference
5. **UI Rendering**: Data displayed in themed card components

### Security Considerations

- No private keys or sensitive data is handled
- Read-only access to blockchain data
- All data is publicly available on-chain information
- No user data is stored on external servers

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ❌ No |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ✅ Yes |
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
apps/explorer/
├── src/
│   ├── pages/
│   │   └── index/
│   │       ├── index.vue           # Main app component
│   │       ├── components/         # Sub-components
│   │       │   ├── NetworkStats.vue
│   │       │   ├── SearchPanel.vue
│   │       │   ├── SearchResult.vue
│   │       │   └── RecentTransactions.vue
│   │       └── explorer-theme.scss # Matrix theme styles
│   ├── locale/                     # i18n translations
│   └── static/                     # Static assets
├── package.json
└── README.md
```

### Customization

The Matrix theme can be customized by modifying CSS variables in `explorer-theme.scss`:
- `--matrix-green`: Primary accent color
- `--matrix-bg`: Background color
- `--matrix-scanlines`: Scanline overlay effect

## Troubleshooting

**Search returns no results:**
- Verify the hash/address format is correct
- Check that you're searching on the right network
- Ensure the transaction has been confirmed on-chain

**Statistics not updating:**
- Check your internet connection
- Data updates every 15 seconds - wait for the next refresh cycle
- Try switching between tabs to force a refresh

**Slow loading:**
- Cached data will display first while fresh data loads
- Large transactions may take longer to process

## Support

For issues or feature requests, please contact the Neo MiniApp team.
