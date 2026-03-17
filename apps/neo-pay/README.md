# NeoPay — On-Chain Recurring Payment Streams

> Create recurring GAS or NEO payment streams. Funds lock on-chain, release over time, and beneficiaries claim when available.

## What is NeoPay?

NeoPay is a streaming payment protocol that brings the power of programmable money to everyday use cases. Set up a payment stream for payroll, subscriptions, memberships, treasury allowances, or any recurring obligation, and funds unlock on a configurable schedule.

Think of it as the Web3 equivalent of a programmable vesting or subscription vault: funds are locked in a smart contract, released on schedule, and claimable by the beneficiary at any time. The sender retains the ability to cancel and reclaim unreleased funds, while the beneficiary has full assurance that released funds cannot be revoked.

> **Current status**: the `MiniAppNeoPay` smart contract is deployed on both testnet and mainnet, and the current frontend targets the network-specific contract address from the manifest.

## How to Use

1. **Connect Wallet** — Link your Neo N3 wallet as the payment stream creator.
2. **Set Beneficiary** — Enter the Neo N3 address of the payment recipient.
3. **Choose Asset** — Select GAS or NEO as the payment asset.
4. **Configure Stream** — Set the total amount, release rate per interval, and interval duration (1–365 days).
5. **Add Details** — Optionally add a title and notes for record-keeping.
6. **Fund Then Create** — The wallet first transfers the full amount into the stream contract, then `createStream` consumes that credited balance and opens the stream.
7. **Beneficiary Claims** — The recipient can claim released funds at any time by visiting NeoPay and connecting their wallet.
8. **Cancel (Optional)** — The creator can cancel the stream at any time to reclaim unreleased funds.

## Key Features

- **Programmable Payments**: Define total amount, release rate, and interval.
- **Dual Dashboard**: Creators see streams they've set up; beneficiaries see streams paying them. Both views in one interface.
- **Multi-Asset Support**: Stream GAS or NEO — both supported natively.
- **Cancel & Reclaim**: Creators can cancel streams at any time to recover unreleased funds.
- **Claim Anytime**: Beneficiaries claim released funds whenever convenient — no fixed claim windows.
- **On-Chain Schedule**: Release logic is stored and enforced directly by the contract.

## Use Cases

| Scenario                | Configuration                                  |
| ----------------------- | ---------------------------------------------- |
| **Monthly Payroll**     | 12,000 GAS total, 1,000/month, 30-day interval |
| **Weekly Subscription** | 52 GAS total, 1/week, 7-day interval           |
| **Quarterly Vesting**   | 10 NEO total, 2.5/quarter, 90-day interval     |
| **Daily Allowance**     | 30 GAS total, 1/day, 1-day interval            |

## Technical Architecture

### Smart Contract

| Component            | Details                                 |
| -------------------- | --------------------------------------- |
| **Contract Name**    | `MiniAppNeoPay`                    |
| **Language**         | C# (Neo N3 Smart Contract)              |
| **Blockchain**       | Neo N3                                  |
| **Supported Assets** | GAS, NEO                                |
| **Interval Range**   | 1–365 days                              |
| **Status**           | Testnet and mainnet deployed             |

### Current Boundary

- **Live today**: direct wallet transaction flow, on-chain stream accounting, beneficiary claims, creator cancellation.
- **Not live yet**: AA scheduling hooks, NeoDID verification, and TEE privacy processing.

### Contract Methods

| Method                  | Type   | Parameters                                                                                          | Description                             |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `createStream`          | Action | `creator`, `beneficiary`, `asset`, `totalAmount`, `rateAmount`, `intervalSeconds`, `title`, `notes` | Create a new payment stream from prepaid contract balance |
| `claimStream`           | Action | `beneficiary`, `streamId`                                                                           | Claim released funds                    |
| `cancelStream`          | Action | `creator`, `streamId`                                                                               | Cancel stream, reclaim unreleased funds |
| `getStreamDetails`      | Query  | `streamId`                                                                                          | Get stream parameters and status        |
| `getUserStreams`        | Query  | `user`, `offset`, `limit`                                                                           | Get streams created by a user           |
| `getBeneficiaryStreams` | Query  | `beneficiary`, `offset`, `limit`                                                                    | Get streams where user is beneficiary   |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/neo-pay

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production (H5)
npm run build
```

## Contract Addresses

| Network | Address            |
| ------- | ------------------ |
| Testnet | `0x89d2499928e3035247186f412934d6b0e0b665ef` |
| Mainnet | `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34` |

> The current miniapp is now deployed on mainnet and should use the correct network-specific contract and Oracle / AA configuration.

## Domains

- Mainnet domain: `neopay.miniapp.neo`

## Tech Stack

| Layer          | Technology                                |
| -------------- | ----------------------------------------- |
| Frontend       | Vue 3 + TypeScript (uni-app)              |
| Smart Contract | C# / Neo N3                               |
| Asset Support  | GAS / NEO                                 |
| Release Logic  | On-chain vesting schedule                 |
| Payment        | Direct wallet invocation                  |

## License

MIT License — R3E Network
