# MiniAppStreamVault | Stream Vault

StreamVault provides time-based release vaults for payrolls, subscriptions, and scheduled payouts.
Creators lock NEO or GAS, then beneficiaries claim fixed releases at a configured interval.

## Features
- NEO/GAS deposits into a vault
- Fixed interval releases to a beneficiary
- Beneficiary claims on schedule
- Creator can cancel and reclaim remaining funds

## Core Methods

### `CreateStream`
Creates a new stream vault and transfers funds into the contract.

```
CreateStream(
  UInt160 creator,
  UInt160 beneficiary,
  UInt160 asset,
  BigInteger totalAmount,
  BigInteger rateAmount,
  BigInteger intervalSeconds,
  string title,
  string notes
)
```

- `asset` must be NEO or GAS native contract hash
- `totalAmount` and `rateAmount` are in raw units (NEO uses 0 decimals, GAS uses 8)
- `intervalSeconds` must be within 1 day and 365 days

### `ClaimStream`
Beneficiary claims the available releases since the last claim.

```
ClaimStream(UInt160 beneficiary, BigInteger streamId)
```

### `CancelStream`
Creator cancels an active stream and receives the remaining amount.

```
CancelStream(UInt160 creator, BigInteger streamId)
```

## Read Methods

- `GetStreamDetails(streamId)`
- `GetUserStreams(user, offset, limit)`
- `GetBeneficiaryStreams(beneficiary, offset, limit)`
- `GetPlatformStats()`

## Events
- `StreamCreated`
- `StreamClaimed`
- `StreamCancelled`
- `StreamCompleted`

## Notes
- Use `MiniAppBase` update method for upgrades.
- All timestamps are Unix seconds (`Runtime.Time`).
