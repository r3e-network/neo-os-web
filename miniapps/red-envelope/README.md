# Red Envelope

Send lucky GAS gifts to friends

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-redenvelope` |
| **Category** | Social |
| **Version** | 2.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Features

- Red-envelope
- Social
- Gift
- Lucky

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ✅ Yes |
| Data Feed | ❌ No |
| Governance | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x5f371cc50116bb13d79554d96ccdd6e246cd5d59` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x5f371cc50116bb13d79554d96ccdd6e246cd5d59) |
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

### Sending Red Envelopes

1. **Connect Wallet**: Link your Neo N3 wallet to the application
2. **Create Envelope**: Choose total amount and number of recipients
3. **Select Distribution**: Pick equal split or random (lucky draw) distribution
4. **Add Message**: Include a greeting or occasion message
5. **Send**: Confirm and distribute the red envelope

### Receiving Red Envelopes

1. Receive a red envelope link or QR code from sender
2. Connect your wallet and open the envelope
3. Claim your share of the GAS (amount depends on distribution type)
4. View received amount and sender's message
5. Send thank you or reciprocate with your own envelope

## How It Works

Red Envelope brings traditional gifting to the blockchain:

1. **Cultural Tradition**: Based on the Chinese tradition of hongbao (lucky money)
2. **Smart Contract Escrow**: Sender's GAS is held in the contract until claimed
3. **Random Distribution**: "Lucky draw" mode assigns random amounts using verifiable RNG
4. **Equal Distribution**: "Equal split" mode gives all recipients the same amount
5. **Time Limits**: Unclaimed envelopes return to sender after expiry
6. **Social Sharing**: Envelopes can be shared via links or QR codes

## Assets

- **Allowed Assets**: GAS
- **Max per TX**: 100 GAS
- **Daily Cap**: 500 GAS

## License

MIT License - R3E Network
