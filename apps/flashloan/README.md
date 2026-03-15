# Flash Loan

Instant uncollateralized loans for arbitrage

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-flashloan` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app)

## Features

- **Flash Loans**: Instant uncollateralized loans for arbitrage opportunities
- **Zero Collateral**: No need to provide collateral for flash loans
- **Atomic Execution**: Loan must be repaid in the same transaction
- **Multi-Asset Support**: Support for various token types

## Usage

### Taking a Flash Loan

1. **Identify Opportunity**: Find an arbitrage opportunity between exchanges
2. **Prepare Contract**: Write a smart contract that executes the arbitrage
3. **Execute Loan**: Call the flash loan function with your contract address
4. **Profit**: The profit remains in your wallet after repayment

### Flash Loan Process

1. **Borrow**: Request a loan of any supported token
2. **Execute**: Your contract receives the tokens and executes trades
3. **Repay**: The contract must repay the loan + fees in the same transaction
4. **Success**: Any remaining profit is yours; if repayment fails, transaction reverts

### Best Practices

- Always test arbitrage strategies on testnet first
- Account for all gas costs in your calculations
- Consider slippage and price impact
- Have fallback mechanisms for failed transactions

## How It Works

Flash loans enable borrowing without collateral by leveraging atomic transaction execution:

1. **Loan Initiation**: Borrower requests a loan of any amount
2. **Token Transfer**: Contract sends tokens to the borrower
3. **Arbitrage Execution**: Borrower executes trades acrossDEXs
4. **Repayment**: Borrower must return the full amount + fee in same tx
5. **Finalization**: If repayment succeeds, transaction completes
6. **Revert on Failure**: If repayment fails, entire transaction reverts

## Limits

| Parameter | Value |
|-----------|-------|
| Max per Transaction | 1000 GAS |
| Daily Cap | 10000 GAS |
| Platform Fee | 0.3% |

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
| **Contract** | `0xee51e5b399f7727267b7d296ff34ec6bb9283131` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xee51e5b399f7727267b7d296ff34ec6bb9283131) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xb5d8fb0dc2319edc4be3104304b4136b925df6e4` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xb5d8fb0dc2319edc4be3104304b4136b925df6e4) |
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
- **Max per TX**: 1000 GAS
- **Daily Cap**: 10000 GAS

## License

MIT License - R3E Network
