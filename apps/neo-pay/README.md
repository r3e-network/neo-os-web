# NeoPay — On-Chain Recurring Payment Streams

> Create recurring GAS or NEO payment streams. Funds lock on-chain, release over time, and beneficiaries claim when available.

## What is NeoPay?

NeoPay is a streaming payment protocol that brings the power of programmable money to everyday use cases. Set up a payment stream for payroll, subscriptions, memberships, treasury allowances, or any recurring obligation, and funds unlock on a configurable schedule.

Think of it as the Web3 equivalent of a programmable vesting or subscription vault: funds are locked in a smart contract, released on schedule, and claimable by the beneficiary at any time. The sender retains the ability to cancel and reclaim unreleased funds, while the beneficiary has full assurance that released funds cannot be revoked.

> **Current status**: `MiniAppNeoPay` is deployed on both networks. On 2026-07-11, the live ABI, pause state, total count, and latest stream were verified read-only on mainnet and testnet. See [NETWORK_STATUS.md](./NETWORK_STATUS.md).

## How to Use

1. **Connect Wallet** — Link your Neo N3 wallet as the payment stream creator.
2. **Set Beneficiary** — Enter the Neo N3 address of the payment recipient.
3. **Choose Asset** — Select GAS or NEO as the payment asset.
4. **Shape the Schedule** — Set the total amount and duration (1–365 days). NeoPay derives the exact base-unit release rate without floating-point math. Fractional NEO remains visibly invalid instead of being silently rounded into a different payment.
5. **Add Context** — Optionally add a short note for the recipient.
6. **Atomic Fund + Create** — One wallet transaction transfers the full amount and immediately calls `createStream`; if either script faults, the complete transaction rolls back.
7. **Beneficiary Claims** — The recipient can claim released funds at any time by visiting NeoPay and connecting their wallet.
8. **Cancel (Optional)** — The creator can cancel the stream at any time to reclaim unreleased funds.

## Key Features

- **Programmable Payments**: Define total amount, release rate, and interval.
- **Dual Dashboard**: Creators see streams they've set up; beneficiaries see streams paying them. Both views in one interface.
- **Multi-Asset Support**: Stream GAS or NEO — both supported natively.
- **Cancel & Reclaim**: Creators can cancel streams at any time to recover unreleased funds.
- **Claim Anytime**: Beneficiaries claim released funds whenever convenient — no fixed claim windows.
- **On-Chain Schedule**: Release logic is stored and enforced directly by the contract.
- **Verified Confirmation**: Success requires the exact app event and a matching `getStreamDetails` readback.
- **Pending Recovery**: Submitted create, claim, and cancel transactions remain bound to the original wallet, network, and contract until confirmed or proven `FAULT`.
- **Durable Journal**: Wallet actions stay closed unless the local transaction journal passes write/read/delete readback checks; a failed cleanup keeps the exact pending action visible.
- **Stable Account View**: Late reads from a previous wallet are discarded and the newly connected wallet is loaded again.
- **Verified Write Network**: Read-only browsing may survive a transient network-detection outage, but create, claim, cancel, and recovery remain closed until the wallet network is positively detected.
- **Product-First Desk**: The illustrated payment route, amount console, recipient, and schedule are the primary experience. Notes, exact-day tuning, guidance, and verified stream history stay in the secondary drawer; histories beyond the bounded product cap are labelled partial.

## Use Cases

| Scenario                | Configuration                                  |
| ----------------------- | ---------------------------------------------- |
| **30-day Payroll**      | 12,000 GAS total over 30 days                  |
| **Weekly Subscription** | 7 GAS total over 7 days                        |
| **Whole-token Vesting** | 90 NEO total over 90 days                      |
| **Small NEO Grant**     | 5 NEO total over 30 days, disclosed as a cliff |

## Technical Architecture

### Smart Contract

| Component            | Details                                 |
| -------------------- | --------------------------------------- |
| **Contract Name**    | `MiniAppNeoPay`                    |
| **Language**         | C# (Neo N3 Smart Contract)              |
| **Blockchain**       | Neo N3                                  |
| **Supported Assets** | GAS, NEO                                |
| **Interval Range**   | 1–365 days                              |
| **Status**           | Mainnet and testnet deployed and read-verified |

### Current Boundary

- **Live today**: direct wallet transaction flow, on-chain stream accounting, beneficiary claims, creator cancellation.
- **Confirmation boundary**: relay is not success. NeoPay requires the expected app event and authoritative stream readback; unresolved broadcasts remain recoverable.
- **Interaction boundary**: create, claim, cancel, recovery, and journal repair share one operation lane. Wallet/network changes during preflight abort before broadcast.
- **Not live yet**: AA scheduling hooks, NeoDID verification, and TEE privacy processing.

### Contract Methods

| Method                  | Type   | Parameters                                                                                          | Description                             |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `createStream`          | Action | `creator`, `beneficiary`, `asset`, `totalAmount`, `rateAmount`, `intervalSeconds`, `title`, `notes` | Create the stream atomically with the NEP-17 transfer |
| `claimStream`           | Action | `beneficiary`, `streamId`                                                                           | Claim released funds                    |
| `cancelStream`          | Action | `creator`, `streamId`                                                                               | Cancel stream, reclaim unreleased funds |
| `getStreamDetails`      | Query  | `streamId`                                                                                          | Get stream parameters and status        |
| `getUserStreams`        | Query  | `user`, `offset`, `limit`                                                                           | Get streams created by a user           |
| `getBeneficiaryStreams` | Query  | `beneficiary`, `offset`, `limit`                                                                    | Get streams where user is beneficiary   |

## Getting Started

```bash
# Navigate to the app directory
cd apps/neo-pay

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
| Testnet | `0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e` |
| Mainnet | `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34` |

> The app rejects a wallet/network/contract mismatch before every write. This verification pass did not submit a funded transaction.

Production evidence and remaining external boundaries are recorded in
[PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md). Artwork custody and checksums
are recorded in [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).

## Domains

- Mainnet domain: `neopay.miniapp.neo`

## Tech Stack

| Layer          | Technology                                |
| -------------- | ----------------------------------------- |
| Frontend       | Host-native React + TypeScript              |
| Smart Contract | C# / Neo N3                               |
| Asset Support  | GAS / NEO                                 |
| Release Logic  | On-chain vesting schedule                 |
| Payment        | Direct wallet invocation                  |

## License

MIT License — R3E Network
