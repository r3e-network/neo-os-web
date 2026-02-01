# Self Loan

Alchemix-style self-repaying loans - borrow now, repay with yield using tiered LTV

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-self-loan` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Tiered LTV (20/30/40%)
- Self-repaying
- No liquidation mechanics
- 0.5% origination fee

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
| **Contract** | `0xb7522afccd80ad5b3cbc112033c22b3d8f2d120c` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xb7522afccd80ad5b3cbc112033c22b3d8f2d120c) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x942da575b31f39cbb59e64b5813b128739b44c25` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x942da575b31f39cbb59e64b5813b128739b44c25) |
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

## Usage

### Taking a Self-Repaying Loan

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Deposit Collateral**: Lock your NEO as collateral in the contract
3. **Select LTV Tier**: Choose 20%, 30%, or 40% loan-to-value ratio
4. **Receive GAS**: Borrow GAS against your collateral immediately
5. **Monitor Yield**: Watch your collateral generate yield to repay the loan

### Managing Your Loan

1. View your active loan status and repayment progress
2. Add more collateral to increase borrowing power
3. Partially repay with external GAS if desired
4. Withdraw excess collateral as yield accrues
5. Close loan fully when yield has repaid principal

## How It Works

Self Loan uses yield-bearing collateral to create self-repaying loans:

1. **Collateral Yield**: Your locked NEO generates GAS rewards over time
2. **Loan Issuance**: Borrow GAS immediately against your NEO collateral
3. **Auto-Repayment**: Generated yield automatically pays down the loan balance
4. **No Liquidation**: Since the loan repays itself, liquidation risk is eliminated
5. **LTV Tiers**: Higher LTV = higher fee, lower LTV = faster repayment
6. **Flexibility**: Users can repay early or add collateral at any time

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
