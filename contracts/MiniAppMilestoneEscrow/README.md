# MiniAppMilestoneEscrow | Milestone Escrow

MilestoneEscrow locks NEO or GAS and releases funds per approved milestones.

## Features
- NEO/GAS escrow deposits
- Creator approves milestones
- Beneficiary claims per milestone
- Creator can cancel and refund remaining funds

## Core Methods

### `CreateEscrow`
```
CreateEscrow(
  UInt160 creator,
  UInt160 beneficiary,
  UInt160 asset,
  BigInteger totalAmount,
  BigInteger[] milestoneAmounts,
  string title,
  string notes
)
```

- `milestoneAmounts` must sum to `totalAmount`
- `asset` must be NEO or GAS
- NEO amounts use 0 decimals; GAS uses 8 decimals

### `ApproveMilestone`
```
ApproveMilestone(UInt160 creator, BigInteger escrowId, BigInteger milestoneIndex)
```

### `ClaimMilestone`
```
ClaimMilestone(UInt160 beneficiary, BigInteger escrowId, BigInteger milestoneIndex)
```

### `CancelEscrow`
```
CancelEscrow(UInt160 creator, BigInteger escrowId)
```

## Read Methods
- `GetEscrowDetails(escrowId)`
- `GetMilestoneDetails(escrowId, milestoneIndex)`
- `GetCreatorEscrows(creator, offset, limit)`
- `GetBeneficiaryEscrows(beneficiary, offset, limit)`
- `GetPlatformStats()`

## Events
- `EscrowCreated`
- `MilestoneApproved`
- `MilestoneClaimed`
- `EscrowCancelled`
- `EscrowCompleted`
