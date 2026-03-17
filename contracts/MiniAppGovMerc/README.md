# MiniAppGovMerc

`MiniAppGovMerc` powers **Gov Merc**, the NEO voting-power rental market.

## Current Live Flow

- depositors send NEO into the pool with `DepositNeo`
- bidders prepay GAS directly to the contract
- `PlaceBid` consumes the prepaid GAS credit for the current epoch
- epoch settlement determines the winning bidder and allocates revenue to NEO depositors

## Core Methods

- `DepositNeo(UInt160 depositor, BigInteger amount)`
  Adds NEO to the voting-power pool.
- `PlaceBid(UInt160 candidate, BigInteger bidAmount)`
  Consumes direct prepaid GAS credit and updates the bidder's current-epoch bid.
- `WithdrawNeo(UInt160 depositor, BigInteger amount)`
  Removes NEO principal from the pool.
- `ClaimRewards(UInt160 depositor)`
  Claims accumulated bid revenue.
- `SettleEpoch()`
  Finalizes the current epoch and rolls into the next one.
- `OnNEP17Payment(UInt160 from, BigInteger amount, object data)`
  Records direct GAS credit for later bid consumption.

## Integration Notes

- canonical app id: `miniapp-gov-merc`
- the frontend should transfer GAS to the contract before calling `PlaceBid`
- no PaymentHub receipt is required in the live path
- AA session keys can drive bidding and reward-claim UX, but the contract logic itself remains direct

## Epoch Model

- epoch duration: `604800` seconds (`7 days`)
- bids accumulate per bidder inside the active epoch
- highest cumulative bid wins the epoch
- bid revenue is distributed to depositors after settlement
