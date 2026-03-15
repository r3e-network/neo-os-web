# Red Envelope — Crypto Gifts That Spread Like Wildfire

> Create a red packet, share a link, friends claim instantly — no wallet needed. Web3 gifting, perfected.

## What is Red Envelope?

Red Envelope brings the beloved tradition of hongbao (红包) to the blockchain. Create a crypto red packet filled with GAS, generate a shareable link, and let friends claim their portion — even if they've never touched a crypto wallet before. Account Abstraction creates instant shadow accounts for new users, and TEE ensures fair distribution for lucky-draw mode.

This is social virality, Web3-style. A sender deposits GAS into a smart contract, chooses between equal splits or lucky-draw random amounts, and shares a link via any messaging app. Recipients tap the link, log in with a social account, and claim their share — gas fees are sponsored, no wallet setup required. It's the onboarding tool that doesn't feel like onboarding.

What elevates Red Envelope beyond a simple transfer tool is its anti-sybil layer powered by NeoDID. Verified social identities prevent a single person from claiming multiple shares, keeping the game fair. The TEE (Trusted Execution Environment) handles random distribution computation, ensuring lucky-draw amounts are truly unpredictable and verifiable.

## How to Use

1. **Create** — Connect your wallet, enter the total GAS amount and number of packets. Add a custom blessing message.
2. **Choose Distribution** — Select equal split (everyone gets the same) or lucky draw (random amounts, with a best-luck bonus of 5%).
3. **Set Conditions** — Optionally require recipients to hold a minimum amount of NEO or have held it for a minimum number of days.
4. **Share** — Get a unique link or QR code. Share it via WeChat, Telegram, Twitter, or any platform.
5. **Friends Claim** — Recipients open the link, log in with a social account, and claim instantly. No wallet or gas needed.
6. **Expiry** — Unclaimed packets are automatically refunded to the sender after the expiry window (default: 24 hours).

## Key Features

- **Zero-Friction Claiming**: Recipients don't need a wallet. AA auto-creates a shadow account via social login with sponsored gas fees.
- **Lucky Draw Mode**: Random distribution computed in TEE for provable fairness. The luckiest recipient gets a 5% bonus.
- **Anti-Sybil Protection**: NeoDID verifies social identities to prevent one person from claiming multiple shares.
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

- **Account Abstraction (AA)**: Auto-creates accounts for new users via social login. Gas fees are sponsored so recipients pay nothing. Temporary accounts can later be upgraded to full wallets.
- **TEE (Trusted Execution Environment)**: Lucky-draw random distribution runs inside a TEE enclave, ensuring amounts are unpredictable yet verifiable after the fact.
- **NeoDID (Decentralized Identity)**: Anti-sybil protection — claims require a verified social identity to prevent duplicate claiming.

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
| Testnet | `0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e` |
| Mainnet | `0x5f371cc50116bb13d79554d96ccdd6e246cd5d59` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x5f371cc50116bb13d79554d96ccdd6e246cd5d59)

## Tech Stack

| Layer           | Technology                                          |
| --------------- | --------------------------------------------------- |
| Frontend        | Vue 3 + TypeScript (uni-app)                        |
| Smart Contract  | C# / Neo N3                                         |
| User Onboarding | Account Abstraction (Social Login + Gas Sponsoring) |
| Fair Randomness | TEE (Trusted Execution Environment)                 |
| Identity        | NeoDID (Anti-Sybil Verification)                    |
| Payment         | PaymentHub (GAS)                                    |

## License

MIT License — R3E Network
