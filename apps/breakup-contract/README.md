# Breakup Contract

Relationship commitment with GAS stakes

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-breakupcontract` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app)


## How It Works

1. **Create Agreement**: The proposer initiates a breakup agreement by specifying terms and the other party's address
2. **Counterparty Sign**: The other party reviews and signs the agreement on-chain
3. **Time-Lock Period**: A configurable cooldown period allows both parties to reconsider
4. **Execute**: After the time-lock expires, either party can execute the final settlement
5. **On-Chain Record**: The agreement and its final state are permanently recorded on the Neo blockchain
## Features

- **Commitment Contracts**: Create binding agreements between parties
- **Stake-Based**: Both parties stake GAS as commitment
- **Milestone Rewards**: Earn rewards at relationship milestones
- **Fair Resolution**: Multiple ways to end contracts
- **Penalty System**: Penalties for unilateral breakup

## Usage

### Creating a Contract

1. **Connect Wallet**: Link your Neo N3 wallet
2. **Set Terms**: Define stake amount and duration
3. **Invite Partner**: Share contract with other party
4. **Both Sign**: Both parties must sign to activate
5. **Activate**: Contract becomes active after both signatures

### During the Contract

- **Track Milestones**: Earn rewards at 25%, 50%, 75%, 100% duration
- **View Stats**: Monitor stake, time remaining, rewards earned
- **Amend Terms**: Mutually agree to modify contract terms

### Ending a Contract

**Mutual Breakup (Recommended)**
1. Either party requests mutual breakup
2. Other party confirms within timeout period
3. Funds distributed evenly

**Unilateral Breakup**
1. Either party can trigger at any time
2. Initiator pays penalty to loyal party
3. Remaining stake split according to rules

## Milestone Rewards

| Milestone | Reward |
|-----------|--------|
| 25% duration | 10% of stake back |
| 50% duration | 20% of stake back |
| 75% duration | 30% of stake back |
| 100% duration | Full stake + yield returned |

## Contract Terms

| Parameter | Value |
|-----------|-------|
| Min Stake | 1 GAS per party |
| Max Duration | 365 days |
| Early Withdrawal Penalty | 20% of initiator's stake |
| Mutual Breakup Timeout | 7 days |

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
| **Contract** | `0x20ebda5a9ed93e3ae29489e2ad329a29cdd5ba6f` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x20ebda5a9ed93e3ae29489e2ad329a29cdd5ba6f) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x7742a80565ef04c0b7487d1679e6efbeb2d0c6a9` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x7742a80565ef04c0b7487d1679e6efbeb2d0c6a9) |
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
