# Heritage Trust

Living trust DAO - lock NEO/GAS, earn rewards, and release monthly inheritances after inactivity

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-heritage-trust` |
| **Category** | nft |
| **Version** | 2.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Create Trust**: Set up a trust with beneficiary and release conditions
2. **Configure Release**: Define time-based or condition-based release rules
3. **Fund Trust**: Deposit assets that will be managed by the trust
4. **Beneficiary Access**: Beneficiaries can claim according to release rules
5. **Owner Control**: Trust owner can modify parameters or add funds
## Features

- Lock NEO and/or GAS as principal with a monthly release schedule
- Convert NEO to bNEO via NeoBurger to earn GAS rewards
- Three release modes: principal NEO + GAS, principal NEO + rewards, or rewards only
- Support GAS-only principal with monthly GAS releases
- Beneficiaries claim released assets monthly after inactivity trigger
- Owners can still claim accrued GAS rewards before execution

## Release Modes

| Mode | Principal Locked | Monthly Release |
|------|------------------|----------------|
| Fixed NEO + GAS | NEO + GAS | NEO + GAS (principal) |
| NEO + GAS Rewards | NEO | NEO (principal) + GAS rewards |
| Rewards Only | NEO | GAS rewards only |

## Release Mechanics

- Locked NEO is swapped to bNEO via NeoBurger inside the contract.
- GAS rewards accumulate on-chain and can be claimed by the owner before execution.
- After execution, beneficiaries claim monthly releases via `claimReleasedAssets`.
- In rewards-only mode, principal stays locked and only GAS rewards are released.

## Lifecycle

1. **Create trust**: lock NEO/GAS and set beneficiary + monthly schedule.
2. **Heartbeat**: owner submits a heartbeat to keep the trust active.
3. **Trigger**: if the heartbeat deadline passes, the trust becomes executable.
4. **Monthly claims**: beneficiary claims released NEO/GAS based on the chosen mode.

## User Flows

- **Owner**
  - Create trust and set release mode + interval.
  - Claim GAS rewards while the trust is active.
  - Send heartbeats to keep the trust from triggering.
- **Beneficiary**
  - Execute the trust after inactivity.
  - Claim monthly released NEO/GAS.

## Usage

### Getting Started

1. **Launch the App**: Open Heritage Trust from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet
3. **Create Trust**: Set up your living trust with beneficiary
4. **Manage**: Send heartbeats and claim rewards

### Creating a Trust

1. **Set Principal**:
   - Choose amount of NEO to lock
   - Choose amount of GAS to lock (optional)
   - Total principal determines monthly releases

2. **Configure Release**:
   | Mode | Principal Returns | Monthly Release |
   |------|-------------------|-----------------|
   | Fixed NEO + GAS | Both | Both (locked amount) |
   | NEO + GAS Rewards | NEO only | NEO + accrued GAS |
   | Rewards Only | Locked forever | GAS rewards only |

3. **Set Beneficiary**:
   - Enter beneficiary wallet address
   - Set heartbeat interval (days between required activity)
   - Define monthly release amounts

4. **Create Trust**:
   - Lock NEO/GAS in the contract
   - Trust becomes active immediately
   - Start earning GAS rewards on bNEO

### Owner Responsibilities

1. **Heartbeat**:
   - Submit heartbeat before deadline
   - Keeps trust from triggering
   - Required interval set during creation

2. **Claim Rewards**:
   - Claim accrued GAS rewards anytime
   - Does not affect locked principal
   - Rewards accumulate on bNEO

3. **Monitor**:
   - Check trust status regularly
   - Track release schedule
   - Update heartbeat as needed

### Beneficiary Actions

1. **After Trigger**:
   - Execute the trust after inactivity
   - Trust becomes claimable
   - Monthly releases begin

2. **Monthly Claims**:
   - Claim released NEO/GAS each month
   - Use claim function to access funds
   - Continue monthly until fully released

### Release Schedule

| Trust Type | Principal | Monthly | Duration |
|------------|-----------|---------|----------|
| Fixed | Full return | Full NEO + GAS | 12+ months |
| Rewards | Locked forever | GAS only | Indefinite |
| Hybrid | NEO only | NEO + rewards | 12+ months |

### Best Practices

- **Choose Reliable Heartbeat**: Set realistic intervals you can maintain
- **Communicate**: Inform beneficiary about the trust
- **Document**: Keep records of trust configuration
- **Review Regularly**: Check trust status and rewards

### FAQ

**Can I change the beneficiary?**
No, the beneficiary is set at creation and cannot be changed.

**What happens if I forget a heartbeat?**
The trust triggers and becomes executable by beneficiary.

**Can I cancel the trust?**
Only remaining funds can be cancelled before trigger.

**How are rewards calculated?**
Based on bNEO yield from NeoBurger integration.

**Can the beneficiary claim early?**
No, only after trigger and per monthly schedule.

### Troubleshooting

**Heartbeat missed:**
- Trust triggers automatically
- Cannot be reversed
- Beneficiary can now claim

**Transaction failed:**
- Check GAS balance for fees
- Verify amounts don't exceed balance
- Try again with correct amounts

**Rewards not accumulating:**
- Check bNEO conversion is working
- Wait for reward calculation period
- Verify NeoBurger integration

### Support

For trust questions, review the contract documentation.

For technical issues, contact the Neo MiniApp team.

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ❌ No |
| Automation | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0xd59eea851cd8e5dd57efe80646ff53fa274600f8` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0xd59eea851cd8e5dd57efe80646ff53fa274600f8) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xd260b66f646a49c15f572aa827e5eb36f7756563` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xd260b66f646a49c15f572aa827e5eb36f7756563) |
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

- **Allowed Assets**: NEO, GAS (bNEO used internally for rewards)
  - NEO is converted to bNEO to accrue GAS rewards via NeoBurger.
  - GAS principal is only released in fixed mode.

## Contract Interface (TestNet)

- `createTrust(owner, heir, neoAmount, gasAmount, heartbeatIntervalDays, monthlyNeo, monthlyGas, onlyRewards, trustName, notes, receiptId)`
- `heartbeat(trustId)` — reset inactivity timer
- `executeTrust(trustId)` — trigger monthly release schedule
- `claimReleasedAssets(trustId)` — beneficiary claim
- `claimYield(trustId)` — owner claims rewards before execution


## License

MIT License - R3E Network
