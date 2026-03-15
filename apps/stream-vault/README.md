# NeoPay — Streaming Payments on Autopilot

> Set up payroll, subscriptions, or recurring payments that execute automatically on-chain. Private, programmable, and unstoppable.

## What is NeoPay?

NeoPay is a streaming payment protocol that brings the power of programmable money to everyday use cases. Set up a payment stream — for payroll, subscriptions, memberships, or any recurring obligation — and funds flow automatically from sender to recipient on a configurable schedule. Once created, streams execute trustlessly on-chain without any manual intervention.

Think of it as the Web3 equivalent of direct deposit or auto-pay subscriptions, but with blockchain guarantees: funds are locked in a smart contract, released on schedule, and claimable by the beneficiary at any time. The sender retains the ability to cancel and reclaim unreleased funds, while the beneficiary has full assurance that released funds cannot be revoked.

NeoPay leverages three cutting-edge Neo service layer technologies. AA Hooks enable automatic scheduled payment execution without the sender being online. NeoDID provides identity verification for payroll scenarios — employers verify employee identities before streaming salaries. TEE processes sensitive payroll details privately, with only aggregated transfer amounts visible on-chain.

> **Note**: NeoPay is currently in development. Smart contract deployment is pending.

## How to Use

1. **Connect Wallet** — Link your Neo N3 wallet as the payment stream creator.
2. **Set Beneficiary** — Enter the Neo N3 address of the payment recipient.
3. **Choose Asset** — Select GAS or NEO as the payment asset.
4. **Configure Stream** — Set the total amount, release rate per interval, and interval duration (1–365 days).
5. **Add Details** — Optionally add a title and notes for record-keeping.
6. **Create Stream** — Confirm the transaction. The total amount is locked in the smart contract immediately.
7. **Beneficiary Claims** — The recipient can claim released funds at any time by visiting NeoPay and connecting their wallet.
8. **Cancel (Optional)** — The creator can cancel the stream at any time to reclaim unreleased funds.

## Key Features

- **Programmable Payments**: Define total amount, release rate, and interval. Payments execute automatically.
- **Dual Dashboard**: Creators see streams they've set up; beneficiaries see streams paying them. Both views in one interface.
- **Multi-Asset Support**: Stream GAS or NEO — both supported natively.
- **Cancel & Reclaim**: Creators can cancel streams at any time to recover unreleased funds.
- **Claim Anytime**: Beneficiaries claim released funds whenever convenient — no fixed claim windows.
- **Privacy via TEE**: Sensitive payroll details (individual salaries) are processed in TEE — only aggregated totals appear on-chain.
- **Identity Verification**: NeoDID ensures beneficiary identity for compliance-sensitive payroll scenarios.
- **Auto-Execution**: AA Hooks trigger scheduled payments automatically — no sender action needed after creation.

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
| **Contract Name**    | `MiniAppStreamVault`                    |
| **Language**         | C# (Neo N3 Smart Contract)              |
| **Blockchain**       | Neo N3                                  |
| **Supported Assets** | GAS, NEO                                |
| **Interval Range**   | 1–365 days                              |
| **Status**           | Development (contract not yet deployed) |

### Service Layer Technologies

- **AA Hooks (Account Abstraction)**: Automated payment hooks execute scheduled releases without the sender needing to be online. Once a stream is created, AA Hooks handle the recurring execution.
- **NeoDID (Decentralized Identity)**: Employee and subscriber identity verification. Employers can require NeoDID verification before streaming salary payments.
- **TEE (Trusted Execution Environment)**: Payroll details (individual amounts, recipient info) are processed inside a TEE enclave. Only aggregated transfer amounts are recorded on-chain, preserving salary privacy.

### Contract Methods

| Method                  | Type   | Parameters                                                                                          | Description                             |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `CreateStream`          | Action | `creator`, `beneficiary`, `asset`, `totalAmount`, `rateAmount`, `intervalSeconds`, `title`, `notes` | Create a new payment stream             |
| `ClaimStream`           | Action | `beneficiary`, `streamId`                                                                           | Claim released funds                    |
| `CancelStream`          | Action | `creator`, `streamId`                                                                               | Cancel stream, reclaim unreleased funds |
| `GetStreamDetails`      | Query  | `streamId`                                                                                          | Get stream parameters and status        |
| `getUserStreams`        | Query  | `user`, `offset`, `limit`                                                                           | Get streams created by a user           |
| `getBeneficiaryStreams` | Query  | `beneficiary`, `offset`, `limit`                                                                    | Get streams where user is beneficiary   |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/stream-vault

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
| Testnet | _Not yet deployed_ |
| Mainnet | _Not yet deployed_ |

> Contract deployment is pending. The `neo-manifest.json` contains empty addresses until deployment is complete.

## Tech Stack

| Layer          | Technology                                |
| -------------- | ----------------------------------------- |
| Frontend       | Vue 3 + TypeScript (uni-app)              |
| Smart Contract | C# / Neo N3                               |
| Auto-Execution | AA Hooks (Scheduled Payment Triggers)     |
| Identity       | NeoDID (Employee/Subscriber Verification) |
| Privacy        | TEE (Private Payroll Processing)          |

## License

MIT License — R3E Network
