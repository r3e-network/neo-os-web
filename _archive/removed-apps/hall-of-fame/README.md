# Neo Hall of Fame Neo 名人堂

Neo Hall of Fame - Neo MiniApp

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-hall-of-fame` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Community recognition through GAS voting

Neo Hall of Fame is a community-driven leaderboard where you can boost your favorite people, communities, and developers in the Neo ecosystem by voting with GAS.


## How It Works

1. **Nomination**: Community members nominate candidates for recognition
2. **Boosting**: Supporters can boost their favorite candidates
3. **Voting Period**: During voting, the community decides rankings
4. **Leaderboard**: Rankings are displayed on a public leaderboard
5. **Permanent Record**: Inductees are permanently recorded on-chain
## Features

- **GAS Voting**: Vote with real GAS tokens to boost rankings.
- **Multiple Categories**: Recognize people, communities, and developers.

## How to use

1. Connect your Neo wallet
2. Browse categories: People, Communities, Developers
3. Click BOOST to vote with GAS
4. Watch your favorites climb the leaderboard

## Usage

### Getting Started

1. **Launch the App**: Open Neo Hall of Fame from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet (optional for browsing)
3. **Browse Categories**: Explore People, Communities, and Developers
4. **Vote**: Use GAS to boost your favorites

### Categories

| Category | Description |
|----------|-------------|
| **People** | Individual community members, contributors, and leaders |
| **Communities** | Neo ecosystem projects, teams, and groups |
| **Developers** | Smart contract developers, tool builders, and core contributors |

### Boosting (Voting)

1. **Select Entry**: Browse the leaderboard and find someone to support
2. **Click BOOST**: Click the boost button on your chosen entry
3. **Enter Amount**: Specify how much GAS to vote with
4. **Confirm**: Confirm the transaction in your wallet

### Voting Power

- **1 GAS = 1 Vote**: Each GAS token equals one vote
- **Cumulative**: You can vote multiple times for the same entry
- **Real-Time**: Rankings update immediately after votes

### Leaderboard Features

- **Live Rankings**: See real-time position changes
- **Category Filter**: Switch between People, Communities, Developers
- **Search**: Find specific entries by name

### Maximizing Impact

- **Strategic Voting**: Focus on entries you believe deserve recognition
- **Community Support**: Coordinate with others to boost community favorites
- **Regular Participation**: Check back regularly for new entrants

### Best Practices

- **Vote Thoughtfully**: Your GAS represents real value
- **Support Diverse Voices**: Consider recognizing unsung contributors
- **Engage Respectfully**: The Hall of Fame celebrates achievements

### FAQ

**Does voting cost anything?**
Yes, you spend GAS to vote. The GAS goes to the recipient.

**Can I unvote?**
No, votes are final once submitted.

**How are rankings calculated?**
By total GAS received, highest first.

**Can I vote for myself?**
Yes, self-nomination is allowed.

**Is there a minimum vote?**
Check the app for current minimum requirements.

### Troubleshooting

**Transaction failed:**
- Ensure you have sufficient GAS
- Check network connectivity
- Try with a smaller amount

**Wallet not connecting:**
- Refresh the page
- Check wallet extension
- Try reconnecting

**Rankings not updating:**
- Wait for block confirmation
- Refresh the app
- Check transaction status

### Support

For voting questions, refer to Neo documentation.

For technical issues, contact the Neo MiniApp team.

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ❌ No |
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- Validates payments on-chain (PaymentHub receipts when enabled).

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0xfdfd94a2a0819d97c0c681ddef4dbcad25973940` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xfdfd94a2a0819d97c0c681ddef4dbcad25973940) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x3c00cbea1c4e502bafae4c6ce7a56237a7d71ded` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0x3c00cbea1c4e502bafae4c6ce7a56237a7d71ded) |
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
