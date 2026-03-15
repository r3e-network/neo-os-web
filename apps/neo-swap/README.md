# Neo Swap

Swap NEO and GAS instantly via Flamingo DEX

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-swap` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Fast, secure token swapping on Neo N3

Neo Swap provides direct swaps between NEO and GAS using Flamingo's on-chain router. It uses the platform data feed for price quotes and submits swaps via wallet invocation. With deep liquidity pools and minimal slippage, you can exchange your tokens instantly and securely.

## Features

- **⚡ Instant Swaps**: Direct NEO/GAS swaps via Flamingo DEX router with sub-minute settlement
- **💰 Live Price Quotes**: Real-time exchange rates from the platform data feed
- **📉 Low Slippage**: Deep NEO/GAS liquidity pools ensure minimal price impact
- **🔒 Secure Transactions**: All swaps executed through audited Flamingo smart contracts
- **💧 Liquidity Provision**: Add liquidity to pools and earn fees from trades
- **📊 Rate Display**: Clear visualization of exchange rates and minimum received amounts
- **🎨 Modern UI**: Clean, intuitive interface designed for both beginners and advanced users
- **📱 Mobile Optimized**: Fully responsive design works seamlessly on mobile wallets

## Usage

### Getting Started

1. **Launch the App**: Open Neo Swap from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet to enable trading
3. **Select Swap Direction**: Choose whether to swap NEO→GAS or GAS→NEO

### Making a Swap

1. **Select Swap Tab**: Navigate to the Swap section (default view)
2. **Enter Amount**: Type the amount you want to swap in the input field
3. **Review Quote**: The app will display:
   - Current exchange rate
   - Estimated amount you'll receive
   - Minimum received (with slippage protection)
   - Price impact percentage
4. **Adjust Slippage** (optional): Set your preferred slippage tolerance
5. **Click "Swap"**: Confirm the transaction in your wallet
6. **Wait for Confirmation**: The swap executes on-chain within seconds
7. **Receive Tokens**: Your new tokens appear in your wallet automatically

### Adding Liquidity

1. **Go to Pool Tab**: Switch to the liquidity provision section
2. **Select Token Pair**: Choose the NEO/GAS pool
3. **Enter Amounts**: Input the amount of each token you want to add
   - The ratio is automatically balanced based on current pool prices
4. **Review Details**: Check your share of the pool and expected returns
5. **Click "Add Liquidity"**: Confirm the transaction
6. **Receive LP Tokens**: You'll receive liquidity provider tokens representing your share

**Benefits of Providing Liquidity:**
- Earn fees from every swap transaction
- Contribute to ecosystem stability
- No minimum lock-up period

### Understanding Rates

**Exchange Rate**: The current market rate between NEO and GAS, determined by the constant product formula (x * y = k).

**Minimum Received**: The worst-case amount you'll receive based on your slippage tolerance. If the price moves beyond this during transaction confirmation, the swap will revert.

**Price Impact**: How much your trade affects the pool price. Larger trades have higher impact. Keep this below 1% for optimal rates.

**Slippage Tolerance**: The maximum price movement you're willing to accept. Default is 0.5%, but you can adjust between 0.1% and 3%.

### Swap Best Practices

1. **Check Price Impact**: Keep trades under 1% price impact for best rates
2. **Set Appropriate Slippage**: Use 0.5% for normal conditions, 1-2% during volatility
3. **Verify Token Addresses**: Always double-check you're trading the correct tokens
4. **Consider Splitting Large Trades**: Breaking large swaps into smaller ones reduces price impact
5. **Watch for High Gas**: During network congestion, gas fees may increase

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Neo Swap Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐  │
│   │   User      │────►│  Neo Swap   │────►│  Flamingo DEX   │  │
│   │   Wallet    │     │   UI        │     │    Router       │  │
│   └─────────────┘     └─────────────┘     └─────────────────┘  │
│          │                   │                      │          │
│          │                   │                      ▼          │
│          │                   │            ┌─────────────────┐  │
│          │                   │            │  Liquidity Pool │  │
│          │                   │            │  (NEO/GAS)      │  │
│          │                   │            └─────────────────┘  │
│          │                   │                      │          │
│          │                   ▼                      ▼          │
│          │            ┌─────────────────────────────────────┐  │
│          │            │        Data Feed Integration        │  │
│          │            │  - Real-time price quotes           │  │
│          │            │  - Liquidity depth info             │  │
│          │            │  - Historical rate data             │  │
│          │            └─────────────────────────────────────┘  │
│          │                                                      │
│          └─────────────────────────────────────────────────────►│
│                           Transaction Flow                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Swap Process

1. **Quote Request**: User enters amount, app queries Flamingo router for quote
2. **Price Calculation**: Current pool reserves determine exchange rate
3. **Slippage Protection**: Minimum output calculated based on user tolerance
4. **Transaction Build**: Swap parameters encoded for contract invocation
5. **Wallet Signing**: User signs transaction in their wallet
6. **On-Chain Execution**: Transaction submitted to Neo N3 blockchain
7. **Confirmation**: Tokens transferred atomically via smart contract
8. **Balance Update**: UI reflects new balances after confirmation

### Liquidity Pool Mechanics

**Constant Product Formula**: 
```
x * y = k
Where:
- x = NEO reserves
- y = GAS reserves
- k = Constant product (invariant)
```

**Price Calculation**:
```
Price = y / x (NEO price in GAS)
Price = x / y (GAS price in NEO)
```

**Fee Structure**:
- 0.3% fee on all swaps
- Fees distributed pro-rata to liquidity providers
- No protocol fees (100% to LPs)

### Security Features

- **Audited Contracts**: Flamingo contracts have been security audited
- **Reentrancy Protection**: All external calls protected against reentrancy
- **Deadline Protection**: Transactions include expiration timestamps
- **Slippage Checks**: Minimum output enforced at contract level
- **No Admin Keys**: No centralized control over user funds

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ❌ No |
| Data Feed | ✅ Yes |
| RNG | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

Note: Wallet access is required to sign the swap transaction.

## On-chain behavior

- Swaps execute via the Flamingo router contract (third-party deployment).
- Price quotes use the platform data feed.
- No platform-owned swap contract is deployed for this app.

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x77b4349e5a62b3f77390afa50962096d66b0ab99` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x77b4349e5a62b3f77390afa50962096d66b0ab99) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xf970f4ccecd765b63732b821775dc38c25d74f23` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xf970f4ccecd765b63732b821775dc38c25d74f23) |
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
- **Supported Pairs**: NEO/GAS, GAS/bNEO, NEO/FLM
- **Minimum Swap**: 0.01 GAS or 0.001 NEO
- **Maximum Swap**: Limited by pool liquidity

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
apps/neo-swap/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main app component
│   │   │   └── components/
│   │   │       ├── SwapTab.vue        # Swap interface
│   │   │       ├── PoolTab.vue        # Liquidity provision
│   │   │       ├── TokenInput.vue     # Amount input component
│   │   │       ├── TokenSelectorModal.vue
│   │   │       ├── RateDetails.vue    # Rate display
│   │   │       └── AddLiquidityForm.vue
│   │   └── docs/
│   │       └── index.vue              # Documentation view
│   ├── composables/
│   │   └── useI18n.ts                 # Internationalization
│   └── static/
│       ├── neo-token.png
│       ├── gas-token.png
│       └── flm-token.png
├── package.json
└── README.md
```

### Component Details

- **SwapTab**: Main swapping interface with token selection and amount input
- **PoolTab**: Liquidity provision interface for adding/removing liquidity
- **TokenInput**: Reusable input component with balance display
- **TokenSelectorModal**: Modal for choosing input/output tokens
- **RateDetails**: Shows exchange rate, price impact, and route information

## Troubleshooting

**"Insufficient liquidity" error:**
- Try a smaller swap amount
- The pool may have low liquidity for large trades

**Transaction failing:**
- Check you have sufficient GAS for transaction fees
- Try increasing slippage tolerance (up to 2-3%)
- Ensure you're on the correct network (mainnet/testnet)

**Price impact too high:**
- Split your trade into smaller amounts
- Wait for more liquidity to be added to the pool
- Consider using a different DEX for very large trades

**Rate different from expected:**
- Prices change constantly based on pool ratios
- Your trade itself affects the price (price impact)
- Compare rates on multiple platforms before trading

**Can't find a token:**
- Currently only NEO and GAS are supported
- Additional tokens may be added in future updates

## Support

For questions about Flamingo DEX or swap mechanics, visit the Flamingo Finance documentation.

For issues with this MiniApp, contact the Neo MiniApp team.
