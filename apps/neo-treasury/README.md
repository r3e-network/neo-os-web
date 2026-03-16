# Neo Treasury Neo 国库

Track Neo Foundation and Ecosystem Fund balances

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-treasury` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Transparent view of Neo's core network assets

The Neo Treasury MiniApp provides real-time transparency into the assets held by Neo's core founders and foundation. This tool is essential for monitoring network decentralization and governance health.

## Features

- **💰 Real-time Balances**: Live NEO and GAS holdings for foundation wallets
- **📊 Total Valuation**: USD value of treasury assets with current prices
- **💵 Price Tracking**: Integrated price feed for accurate valuation
- **👥 Founder Breakdown**: Individual holdings for Da Hongfei and Erik Zhang
- **🔗 Direct RPC**: Fetch live balances directly from the N3 blockchain
- **📈 Price Cards**: Current market prices for NEO and GAS tokens
- **🎨 Elegant Theme**: Sophisticated gold and navy treasury aesthetic
- **💾 Smart Caching**: Cached data loads instantly, updates in background

## Usage

### Getting Started

1. **Launch the App**: Open Neo Treasury from your Neo MiniApp dashboard
2. **View Overview**: Total treasury value and statistics load automatically
3. **Explore Details**: Navigate to individual founder tabs for breakdowns

### Total Tab - Treasury Overview

1. **Summary Card**:
   - Total USD value of all tracked wallets
   - Combined NEO balance
   - Combined GAS balance
   - Last updated timestamp

2. **Price Grid**:
   - Current NEO price in USD
   - Current GAS price in USD
   - Price source indicators

3. **Founders List**:
   - Da Hongfei holdings summary
   - Erik Zhang holdings summary
   - Click to view detailed breakdowns

### Individual Founder Tabs

**Da Hongfei Tab:**
1. View all wallets associated with Da Hongfei
2. See individual NEO and GAS balances per wallet
3. Calculate USD value per wallet
4. Total across all wallets displayed

**Erik Zhang Tab:**
1. View all wallets associated with Erik Zhang
2. See individual NEO and GAS balances per wallet
3. Calculate USD value per wallet
4. Total across all wallets displayed

### Understanding the Data

**Transparency Purpose:**
- Monitor founder token holdings
- Track ecosystem fund allocations
- Verify decentralization progress
- Ensure accountability

**Wallet Categories:**
- **Core Holdings**: Primary founder addresses
- **Ecosystem Funds**: Development and grant allocations
- **Operational Reserves**: Ongoing expenses and operations

**Price Sources:**
- Fetched from integrated price feed
- Real-time market data
- Used for USD valuation calculations

## How It Works

### Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Neo Treasury Data Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────────┐         ┌──────────────────┐        │
│   │   Neo N3         │         │   Price Feed     │        │
│   │   Blockchain     │         │   Service        │        │
│   └────────┬─────────┘         └────────┬─────────┘        │
│            │                            │                   │
│            ▼                            ▼                   │
│   ┌──────────────────────────────────────────────┐         │
│   │   Treasury Data Aggregation                  │         │
│   │   ┌──────────────────────────────────────┐   │         │
│   │   │  For each tracked wallet:            │   │         │
│   │   │  - Query NEO balance (NEP-17)        │   │         │
│   │   │  - Query GAS balance (native)        │   │         │
│   │   │  - Calculate USD value               │   │         │
│   │   └──────────────────────────────────────┘   │         │
│   └──────────────────────┬───────────────────────┘         │
│                          │                                  │
│                          ▼                                  │
│   ┌──────────────────────────────────────────────┐         │
│   │   Vue 3 Frontend                             │         │
│   │   - Total Summary Card                       │         │
│   │   - Price Grid                               │         │
│   │   - Founder Lists                            │         │
│   │   - Individual Detail Views                  │         │
│   └──────────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tracked Wallets

The app tracks known foundation and founder addresses:

**Categories:**
1. **Da Hongfei Holdings**: Wallets associated with Neo co-founder
2. **Erik Zhang Holdings**: Wallets associated with Neo co-founder
3. **Foundation Treasury**: Organization-controlled funds

**Balance Querying:**
- NEO: Called via NEP-17 `balanceOf`
- GAS: Called via native GAS contract
- Prices: Multi-source aggregated feed

### Caching Strategy

**Two-Tier Cache:**
1. **Initial Load**: Display cached data immediately
2. **Background Refresh**: Fetch fresh data asynchronously
3. **Update**: Replace cached data when fresh arrives

**Benefits:**
- Instant UI loading
- Always current data
- Graceful offline handling

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
apps/neo-treasury/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main app with tabs
│   │   │   ├── components/
│   │   │   │   ├── TotalSummaryCard.vue
│   │   │   │   ├── PriceGrid.vue
│   │   │   │   ├── FoundersList.vue
│   │   │   │   └── FounderDetail.vue
│   │   │   ├── utils/
│   │   │   │   └── treasury.ts        # Data fetching logic
│   │   │   └── neo-treasury-theme.scss
│   │   └── docs/
│   │       └── index.vue
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### Data Types

```typescript
interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: string;
  prices: {
    neo: { usd: number; source: string };
    gas: { usd: number; source: string };
  };
  categories: CategoryBalance[];
}

interface CategoryBalance {
  name: string;
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  wallets: WalletBalance[];
}

interface WalletBalance {
  address: string;
  label: string;
  neo: number;
  gas: number;
  usd: number;
}
```

## Transparency Goals

This app serves Neo's commitment to transparency:

**Decentralization Monitoring:**
- Track token distribution over time
- Monitor founder holdings
- Verify unlock schedules

**Ecosystem Health:**
- Ensure sufficient funds for development
- Track grant allocations
- Monitor operational reserves

**Community Trust:**
- Public visibility into finances
- On-chain verifiable data
- Regular reporting alignment

## Troubleshooting

**Data not loading:**
- Check internet connection
- Verify RPC endpoint availability
- Try refreshing the page

**Prices seem incorrect:**
- Prices are averaged from multiple sources
- May lag real-time by a few minutes
- Large trades can cause temporary discrepancies

**Balances showing zero:**
- Some wallets may be empty
- Check you're viewing correct founder tab
- Data updates periodically

**Slow loading:**
- Cached data displays first
- Fresh data loads in background
- Initial load may take a few seconds

## Privacy Note

This app only displays publicly available blockchain data. All tracked addresses are known foundation and founder wallets that are public information.

## Support

For questions about Neo's treasury or tokenomics, visit the Neo website or community forums.

For app technical issues, contact the Neo MiniApp team.
