# Neo Swap

Swap NEO and GAS with route preview and wallet settlement

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-swap` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Host-native React playarea |

## Summary

Fast, secure token swap planning on Neo N3

Neo Swap provides NEO/GAS quote preview, slippage review, route context, and wallet-submitted settlement from the unified MiniApp detail page. Prices come from the platform data feed; the shared operation panel handles final wallet submission and status tracking.

## Features

- **Instant route preview**: Direct NEO/GAS quote flow with sub-minute wallet settlement expectations
- **Live price quotes**: Real-time exchange rates from the platform data feed
- **Slippage review**: Minimum received, price impact, and tolerance controls before submission
- **Wallet-gated execution**: Final submissions require the connected wallet and shared operation panel
- **Route context**: Liquidity and route details for planning larger trades
- **Rate display**: Clear visualization of exchange rates and minimum received amounts
- **Modern UI**: Clean, intuitive interface designed for both beginners and advanced users
- **Mobile optimized**: Fully responsive design works seamlessly on mobile wallets

## Usage

### Getting Started

1. **Open the App**: Open Neo Swap from your Neo MiniApp dashboard
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
6. **Wait for Confirmation**: The submitted transaction settles on-chain within seconds
7. **Receive Tokens**: Your new tokens appear in your wallet automatically

### Reviewing Liquidity

1. **Go to Pool Tab**: Switch to the liquidity context section
2. **Select Token Pair**: Choose the NEO/GAS route
3. **Enter Amount**: Input the amount you want to swap
   - The quote updates from current route data
4. **Review Details**: Check depth, expected output, and price impact
5. **Review route context**: Use pool depth, share, and expected return data to plan the trade
6. **Submit from the operation panel**: Wallet submission stays in the shared platform flow

**Benefits of reviewing liquidity:**
- Understand expected price impact before signing
- Avoid accidental execution during thin liquidity
- Keep swap status and wallet submission in one shared panel

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
│   │   User      │────►│  Neo Swap   │────►│  Swap Route     │  │
│   │   Wallet    │     │   UI        │     │  Wallet Submit  │  │
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

1. **Quote Request**: User enters amount, app builds a route preview
2. **Price Calculation**: Current data feed and liquidity context determine the exchange rate
3. **Slippage Protection**: Minimum output calculated based on user tolerance
4. **Transaction Build**: Swap parameters encoded for contract invocation
5. **Wallet Signing**: User signs transaction in their wallet
6. **On-Chain Execution**: Transaction submitted to the Neo N3 blockchain
7. **Confirmation**: Tokens settle through the wallet-submitted route
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
- Route fees are included in the received-amount preview
- The app shows minimum received before wallet confirmation
- Platform custody fees are not added by this MiniApp

### Security Features

- **Wallet-Gated Submission**: No swap is submitted without explicit wallet confirmation
- **Reentrancy Protection**: All external calls protected against reentrancy
- **Deadline Protection**: Transactions include expiration timestamps
- **Slippage Checks**: Minimum output enforced at contract level
- **No Custody**: The platform does not take custody of user funds

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

- Swaps are previewed in the MiniApp and submitted through the shared wallet flow.
- Price quotes use the platform data feed and liquidity context.
- No platform-owned custody contract is deployed for this app.

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x77b4349e5a62b3f77390afa50962096d66b0ab99` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x77b4349e5a62b3f77390afa50962096d66b0ab99) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xf970f4ccecd765b63732b821775dc38c25d74f23` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0xf970f4ccecd765b63732b821775dc38c25d74f23) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

### Mainnet

| Contract | Address |
| --- | --- |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| Morpheus Oracle | `0x017520f068fd602082fe5572596185e62a4ad991` |

## Assets

- **Allowed Assets**: NEO, GAS
- **Supported Pairs**: NEO/GAS
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
│   ├── main.tsx                       # Host-native playarea entry
│   ├── manifest.ts                    # Platform-rendered app metadata
│   └── locale/
│       └── messages.ts                # Localized copy
├── neo-manifest.json                  # Platform catalog manifest
├── package.json
└── README.md
```

### Component Details

- **Playarea entry**: Host-native route preview with token selection and amount input
- **Manifest**: Shared MiniApp detail-page metadata, permissions, docs, and operation wiring
- **Messages**: Localized labels, empty states, and wallet submission copy

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
- Consider splitting or delaying very large trades

**Rate different from expected:**
- Prices change constantly based on pool ratios
- Your trade itself affects the price (price impact)
- Compare rates on multiple platforms before trading

**Can't find a token:**
- Currently only NEO and GAS are supported
- Additional tokens may be added in future updates

## Support

For questions about swap mechanics or this MiniApp, contact the Neo MiniApp team.
