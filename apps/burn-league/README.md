# Burn League

Winner-takes-all GameFi league powered by a Phaser 3 arena and an on-chain GAS pool.

> Product semantics: “burn” is the game verb. GAS is contributed to the season
> pool and redistributed to the top burner; it is not destroyed and does not
> reduce GAS supply.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-burn-league` |
| **Category** | GameFi |
| **Version** | 1.1.0 |
| **Framework** | Phaser 3 + React host bridge |

## Features

- Play-free push-your-luck mode with deliberate score banking
- On-chain winner-takes-all seasons
- Live leaderboard reconstructed from `Burned` events
- Explicit two-stage confirmation for irreversible GAS burns
- Exact-tx recovery for broadcast deposits and burns
- Withdrawable unused credit and settled winnings

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
| **Contract** | `0x21a527b50b839efeb73721a886c9b5994a206316` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x21a527b50b839efeb73721a886c9b5994a206316) |
| **Network Magic** | `894710606` |

### Mainnet legacy deployment (not active in the app manifest)

| Property | Value |
|----------|-------|
| **Contract** | `0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

### Mainnet

| Contract | Address |
| --- | --- |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| Morpheus Oracle | `0x5b492098fc094c760402e01f7e0b631b939d2bea` |

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

### Burning GAS

1. **Enter the arena**: Choose GameFi or the no-wallet local heat-streak mode.
2. **Connect separately**: Connecting a wallet never burns GAS in the same press.
3. **Choose fuel**: Pick a 1/5/10/25 GAS capsule in the Phaser arena.
4. **Review**: The first press displays the irreversible, winner-takes-all warning.
5. **Confirm**: Press again within 12 seconds, then approve the required wallet transactions.
6. **Recover safely**: If indexing times out, use **Check transaction**; never submit a duplicate burn.

Local play uses a different loop: stoke to build unbanked heat, then choose
**Bank run** before a later flare-out wipes the current run. Secure randomness
is mandatory; unsupported WebViews fail without changing the score.

### Viewing Stats

1. Open the in-game drawer for the current pool, leader, rules, and leaderboard.
2. The top burner at the deadline wins the whole pool; ties retain the existing leader.
3. Settle is permissionless. Settlement credits the winner's **claimable credit**.
4. Withdraw claimable credit to move unused deposits or winnings back to the wallet.

## How It Works

Burn League is an all-pay seasonal contest:

1. **Direct credit**: A GAS transfer with memo `miniapp-burnleague:burn` credits the player.
2. **Burn action**: `burn(player, amountFixed8)` consumes that credit into the live pool.
3. **Leaderboard**: The contract tracks the leader; the UI rebuilds the full board from events.
4. **Winner takes all**: `settle()` moves the whole pool into the top burner's claimable credit.
5. **Pull payment**: `withdraw(account)` returns the account's entire claimable balance.
6. **No oracle**: Season ranking and settlement are handled entirely by the contract.

## Funding Model

- Existing claimable credit is consumed first.
- The wallet transfers only the shortfall, waits for `Credited`, then calls `burn`.
- A confirmed deposit is never auto-burned after refresh; the player must review again.
- A `Burned` success is shown only when the exact tx/player/amount event and canonical contract readback agree.

## Production Note

Contract v1.1 uses a 24-hour daily season (`seasonDuration() = 86400000`) and is
deployed on TestNet. The MainNet address still reports the legacy two-minute demo
duration and is no longer published as an active app binding. MainNet requires a
reviewed v1.1+ deployment before it can be re-enabled.

## Assets

- **Allowed Assets**: GAS


## License

MIT License - R3E Network
