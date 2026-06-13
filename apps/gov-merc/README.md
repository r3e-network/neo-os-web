# Gov Merc

Governance influence auction — stake NEO to earn the GAS auction yield; bid GAS to win the epoch's influence title.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-gov-merc` |
| **Category** | Governance |
| **Version** | 1.0.0 |
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

> **Migration note (v2, 2026-06-12):** MiniAppGovMerc v2 adds a fixed 5-minute
> bidding window per epoch (the first bid opens it; later bids must land before
> the deadline, and settlement unlocks after it). The v1 contract
> `0x1eb83eb5d4d3f073112064e8a3825f3b0e5f88e9` stays live on both networks for
> user exits only (withdraw stake / reclaim bids / withdraw credit).

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
- wallet signs the transfer first, then calls `placeBid`


## License

MIT License - R3E Network
