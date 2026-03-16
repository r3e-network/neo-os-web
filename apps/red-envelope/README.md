# Red Envelope — Crypto Gifts That Spread Like Wildfire

> Create a red packet, share a link or code, and let friends claim through the miniapp flow. Social gifting on Neo N3.

## What is Red Envelope?

Red Envelope brings the beloved tradition of hongbao (红包) to the blockchain. Create a GAS red packet, generate a shareable link or code, and let friends claim their portion through the miniapp flow.

This is social gifting, Web3-style. A sender deposits GAS into a smart contract, chooses between equal splits or lucky-draw amounts, and shares a link or code via any messaging app. Recipients open the miniapp and claim their share through the standard wallet flow.

What elevates Red Envelope beyond a simple transfer tool is that creation, claiming, and remaining balances are tracked directly on-chain. Lucky-draw mode still adds tension, but the current release keeps the implementation grounded in the contract flow that is actually deployed.

## How to Use

1. **Create** — Connect your wallet, enter the total GAS amount and number of packets. Add a custom blessing message.
2. **Choose Distribution** — Select equal split (everyone gets the same) or lucky draw (random amounts, with a best-luck bonus of 5%).
3. **Set Conditions** — Optionally require recipients to hold a minimum amount of NEO or have held it for a minimum number of days.
4. **Share** — Get a unique link or QR code. Share it via WeChat, Telegram, Twitter, or any platform.
5. **Friends Claim** — Recipients open the link, connect a wallet in the miniapp, and claim their share.
6. **Expiry** — Unclaimed packets are automatically refunded to the sender after the expiry window (default: 24 hours).

## Key Features

- **Shareable Claims**: Create a link or code and let recipients claim through the miniapp.
- **Lucky Draw Mode**: Switch between equal split and randomized claim amounts.
- **On-Chain Tracking**: Envelope status, claims, and remaining balance stay queryable on-chain.
- **Eligibility Gates**: Optionally require recipients to hold NEO (minimum amount and/or holding duration) to claim.
- **Expiry & Refund**: Unclaimed packets return to the sender automatically.
- **Cultural Flair**: Custom blessing messages, themed UI, and celebration animations.

## Technical Architecture

### Smart Contract

| Component          | Details                    |
| ------------------ | -------------------------- |
| **Contract Name**  | `MiniAppRedEnvelope`       |
| **Language**       | C# (Neo N3 Smart Contract) |
| **Blockchain**     | Neo N3                     |
| **Min Amount**     | 0.1 GAS total              |
| **Max Packets**    | 100 per envelope           |
| **Min Per Packet** | 0.01 GAS                   |

### Service Layer Technologies

- **Contract-based distribution**: The current release relies on contract logic and on-chain state rather than external AA / TEE / NeoDID services.

### Contract Methods

| Method               | Type   | Parameters                                                   | Description                           |
| -------------------- | ------ | ------------------------------------------------------------ | ------------------------------------- |
| `CreateEnvelope`     | Action | `creator`, `amount`, `count`, `expiry`, `minNeo`, `holdDays` | Create a new red envelope             |
| `ClaimEnvelope`      | Action | `claimer`, `envelopeId`                                      | Claim a share from an envelope        |
| `RefundEnvelope`     | Action | `creator`, `envelopeId`                                      | Refund unclaimed packets after expiry |
| `GetEnvelopeDetails` | Query  | `envelopeId`                                                 | Get envelope info and claim status    |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/red-envelope

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production (H5)
npm run build
```

## Contract Addresses

| Network | Address                                      |
| ------- | -------------------------------------------- |
| Testnet | `0x4079c09a0ff121fc44d817c37d6ae8694b268e9f` |
| Mainnet | `0x5f371cc50116bb13d79554d96ccdd6e246cd5d59` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0x4079c09a0ff121fc44d817c37d6ae8694b268e9f)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x5f371cc50116bb13d79554d96ccdd6e246cd5d59)

## Tech Stack

| Layer           | Technology                                          |
| --------------- | --------------------------------------------------- |
| Frontend        | Vue 3 + TypeScript (uni-app)                        |
| Smart Contract  | C# / Neo N3                                         |
| Claim Flow      | Direct miniapp + wallet interaction                 |
| Distribution    | Smart contract state                                |
| Sharing         | Link / code based social distribution               |
| Payment         | PaymentHub (GAS)                                    |

## License

MIT License — R3E Network
