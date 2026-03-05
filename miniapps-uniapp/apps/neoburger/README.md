# NeoBurger NeoBurger 质押

Stake NEO to earn GAS rewards with NeoBurger liquid staking

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neoburger` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Liquid staking protocol for NEO with bNEO rewards

NeoBurger is a liquid staking protocol that lets you stake NEO and receive bNEO tokens. Earn GAS rewards while maintaining liquidity - use bNEO in DeFi while your NEO generates yield.


## How It Works

1. **Swap Assets**: Exchange NEO and GAS tokens seamlessly
2. **Liquidity Pools**: trades are executed against liquidity pools
3. **Fee Structure**: A small fee is applied to each swap
4. **Slippage Control**: Maximum slippage can be configured
5. **On-Chain Settlement**: All swaps settle directly on Neo blockchain
## Features

- **Liquid Staking**: Receive bNEO tokens that can be used in DeFi while your NEO earns rewards.
- **Auto-Compounding**: Rewards are automatically compounded, increasing your bNEO value over time.

## Usage

### Getting Started

1. **Launch the App**: Open NeoBurger from your Neo MiniApp dashboard
2. **Connect Your Wallet**: Click "Connect Wallet" to link your Neo N3 wallet
3. **View Dashboard**: See your NEO balance, bNEO balance, and current APY

### Staking NEO (Burger Station)

The Burger Station is your primary interface for staking operations:

1. **Input Amount**:
   - Enter the amount of NEO you want to stake in the input field
   - Use quick-select buttons: 25%, 50%, 75%, or MAX for convenience
   - Balance updates automatically when wallet is connected

2. **Review Transaction**:
   - See estimated bNEO output (1 NEO ≈ 0.99 bNEO with 1% fee)
   - View USD equivalent value
   - Toggle between stake/unstake modes

3. **Execute Stake**:
   - Click "Stake NEO" to stake your NEO
   - Confirm transaction in your wallet
   - Receive bNEO tokens representing your staked position

### Unstaking bNEO

1. **Toggle to Unstake Mode**:
   - Click the exchange icon (↕️) to switch from stake to unstake
   - Input the amount of bNEO to unstake
   - View estimated NEO output (1 bNEO ≈ 1.01 NEO with 1% fee)

2. **Confirm Unstake**:
   - Click "Unstake bNEO" to convert back to NEO
   - Your NEO plus staking rewards will be returned

### Claiming GAS Rewards (Jazz Up Tab)

The Jazz Up tab displays your earned GAS rewards:

1. **View Rewards**:
   - Daily rewards estimate
   - Weekly rewards estimate
   - Monthly rewards estimate
   - Total accumulated rewards

2. **Claim Rewards**:
   - Click "Claim Rewards" to harvest accumulated GAS
   - Rewards are auto-compounded in your bNEO balance

### Understanding bNEO

bNEO is a liquid staking token that represents your staked NEO:

- **1:1 Value**: bNEO is designed to maintain parity with NEO
- **GAS Rewards**: Holding bNEO earns you GAS staking rewards
- **DeFi Integration**: Use bNEO in other Neo DeFi protocols
- **No Lockup**: Unstake anytime with no unbonding period

### bNEO Contract Information

| Property | Value |
|----------|-------|
| **Contract Script Hash** | `0x48c40d4666f93408be1bef038b6722404d9a4c2a` |
| **Decimal Places** | 8 |
| **Symbol** | bNEO |

### Dashboard Tabs

| Tab | Purpose |
|-----|---------|
| **Home** | Main staking interface (Burger Station) + Jazz Up rewards |
| **Airdrop** | NOBUG token airdrop information and distribution |
| **Treasury** | NeoBurger treasury wallet and asset tracking |
| **Dashboard** | Protocol statistics, token metrics, and governance info |
| **Docs** | Documentation and guides |

### Best Practices

1. **Start Small**: Test with a small amount first to understand the flow
2. **Check Gas**: Ensure you have sufficient GAS for transaction fees
3. **Monitor APY**: Check current APY before staking (shown in hero)
4. **Keep Records**: Track your bNEO balance over time

### FAQ

**Is there a minimum stake amount?**
No minimum stake amount. You can stake any amount of NEO.

**Is there an unbonding period?**
No unbonding period. You can unstake anytime.

**How are rewards distributed?**
GAS rewards are automatically compounded into your bNEO balance. Claim them anytime.

**What is the stake fee?**
1% of staked NEO is deducted as a protocol fee.

**What is the unstake fee?**
1% of unstaked bNEO is deducted as a protocol fee.

**Can I use bNEO in other protocols?**
Yes, bNEO is a standard NEP-17 token and can be used in any Neo DeFi protocol.

### Troubleshooting

**Transaction failed:**
- Ensure you have sufficient GAS for fees
- Check you are on Neo N3 network
- Try with a smaller amount

**Balance not updating:**
- Click refresh or reconnect wallet
- Check network connection
- Verify contract is deployed

**Wrong network warning:**
- Switch to Neo N3 in your wallet
- Restart the app after switching

### Support

For staking questions, refer to the [NeoBurger Documentation](https://docs.neoburger.io).

For technical issues, contact the Neo MiniApp team.

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

- Calls the NeoBurger bNEO contract to stake/unstake NEO (third-party deployment).
- Uses standard contract invocation flows (no PaymentHub receipts).

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x833b3d6854d5bc44cab40ab9b46560d25c72562c` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x833b3d6854d5bc44cab40ab9b46560d25c72562c) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x48c40d4666f93408be1bef038b6722404d9a4c2a` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x48c40d4666f93408be1bef038b6722404d9a4c2a) |
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

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
