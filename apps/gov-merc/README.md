# Gov Merc

Governance influence auction — stake NEO to earn the GAS auction yield; bid GAS to win the epoch's influence title.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-gov-merc` |
| **Category** | Governance |
| **Version** | 1.1.0 |
| **Framework** | Host-native React playarea |

## Features

- Governance
- Voting
- Marketplace

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ✅ Yes |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x140f5faf5692d21421a79278b0e45b9b9bd4bb46` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x140f5faf5692d21421a79278b0e45b9b9bd4bb46) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x140f5faf5692d21421a79278b0e45b9b9bd4bb46` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x140f5faf5692d21421a79278b0e45b9b9bd4bb46) |
| **Network Magic** | `860833102` |

> **Migration note (v2, verified read-only 2026-07-12):** MiniAppGovMerc v2 adds a fixed 5-minute
> bidding window per epoch (the first bid opens it; later bids must land before
> the deadline, and settlement unlocks after it). The v1 contract
> `0x1eb83eb5d4d3f073112064e8a3825f3b0e5f88e9` stays live on both networks for
> user exits only by platform policy (withdraw stake / reclaim bids / withdraw
> credit). The v1 ABI still exposes its legacy bid/settle methods, so the app
> deliberately never binds new activity to v1.

Read-only RPC verification on 2026-07-12 confirmed both hashes exist on mainnet
and testnet as `MiniAppGovMerc` with update counter 0. The bound v2 contract
returns `HALT`, `minBid = 100000000` (1 GAS), and `epochDuration = 300000` ms on
both networks. No wallet signature, transaction, or deployment was performed.

## Platform Contracts

### Current Integration Surface

- direct prepaid GAS to the MiniApp contract
- direct contract invocation only
- governance logic remains on-chain; Oracle / AA integrations stay external

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

## Production interaction model

- The app verifies the selected Neo N3 network, the connected wallet, and the
  canonical v2 contract hash immediately before every write.
- Positive whole NEO and up-to-8-decimal positive GAS inputs are validated
  before a wallet request. Fractional NEO is rejected; it is never truncated.
- A durable, binding-scoped pending record is written as soon as a payment or
  contract transaction ID is broadcast. Refresh recovery is read-only and does
  not sign, pay, or resubmit.
- A write is reported as complete only after the exact contract event and a
  matching contract readback are observed. `FAULT`, `HALT` without the expected
  event/readback, and unknown RPC state remain distinct.
- If a bid payment lands but the bid action does not, the recovered GAS credit
  is reused before any new payment.

## Usage

### Stakers (earn yield)

1. **Connect Wallet**: Link your Neo N3 wallet holding NEO.
2. **Stake NEO**: Transfer whole NEO into the pool (memo `govmerc:stake`). Your stake weights your pro-rata share of the auction revenue.
3. **Earn**: When an epoch settles, the winning GAS bid is distributed to stakers in proportion to stake.
4. **Claim / Unstake**: Claim accrued GAS rewards or unstake your NEO at any time.

### Mercenaries (bid for the title)

1. Place a GAS bid for the current epoch (first bid must be at least 1 GAS).
2. The highest bidder when the bidding window closes wins the epoch's influence title.
3. Anyone can settle the epoch after the window closes; the winning bid is paid to stakers.
4. Losing bidders reclaim their bids from settled epochs.

## How It Works

Gov Merc is a two-sided auction over governance influence:

1. **Stake → reward weight**: Staked NEO is held as a reward-share weight; the contract does NOT delegate or cast a vote with it.
2. **Bid → influence title**: Mercenaries bid GAS each epoch to win the epoch's influence title.
3. **Settlement**: The top bidder is recorded on-chain as the epoch winner and their bid is distributed to stakers pro-rata.
4. **Off-contract execution**: The on-chain record is the influence title; any vote execution happens off-contract.
5. **Permissionless settle**: Anyone can settle a closed epoch.
6. **Transparency**: Stakes, bids, and settlements are visible on-chain.

## Assets

- **Allowed Assets**: GAS

## Funding Model

- direct prepaid GAS to the MiniApp contract
- direct contract invocation only
- existing bid credit is consumed first; only the shortfall is paid, then the
  wallet calls `bid`


## License

MIT License - R3E Network
