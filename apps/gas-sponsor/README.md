# Gas Sponsor

Gas Sponsor is a community refill station for the deployed `MiniAppGasSponsor` v2 contracts. It is an on-chain pool application—not the retired platform faucet API and not a transfer to a hard-coded operator wallet.

## Product flow

1. Browse live and historical pools without connecting a wallet.
2. Select a public pool and inspect its exact remaining GAS, per-wallet allowance, claim count and expiry.
3. Connect a wallet only when claiming or sponsoring.
4. Create a public pool from visual GAS presets or exact values in the secondary drawer.
5. Sponsors can top up, extend or withdraw their own pool from the management drawer.

The primary surface always shows the pool itself. Contract hashes, exact amounts and lifecycle controls stay secondary.

## On-chain behavior

| Action | Contract flow | Confirmation |
| --- | --- | --- |
| Create public pool | Prepay GAS, then `createPool(sponsor, amount, maxClaimPerUser, 1, description)` | `SponsorshipCreated` plus `getPoolDetails` readback |
| Claim | `claimSponsorship(beneficiary, poolId, amount)` | `SponsorshipClaimed` plus pool/user-claim readback |
| Top up | Prepay GAS, then `topUpPool(sponsor, poolId, amount)` | HALT receipt plus exact pool-balance readback |
| Extend | `extendPoolExpiry(poolId, newExpiry)` | `PoolExtended` plus expiry readback |
| Withdraw | `withdrawPool(sponsor, poolId)` | `PoolRefunded` plus inactive/zero-remaining readback |

Payment and target transaction IDs are persisted separately. If a prepaid transfer confirms while the target call is delayed, recovery resumes the target call without sending the GAS twice.

## Deployed contracts

| Network | Contract |
| --- | --- |
| Neo N3 MainNet | `0x80ea8435a88334b9b80077220097d88c440615f1` |
| Neo N3 TestNet | `0x31888679572bf2de61462ff9934b6265d60284f2` |

Both deployments expose the pool lifecycle methods and events used by the app. Network-specific administrative integrations are not treated as shared product features.

## Current contract facts

- Minimum new pool: `1 GAS`.
- Maximum claim per transaction: `0.1 GAS`.
- Minimum top-up: `0.5 GAS`.
- Pool type `1` is the public community-pool path used by the application.
- The deployed contract reports `defaultExpirySeconds = 2592000`, while current pool timestamps differ by `2,592,000 milliseconds` (about 43.2 minutes). The application displays the actual chain expiry and does not call it “30 days.”

See `NETWORK_STATUS.md` for the current read-only deployment snapshot.

## Development

```bash
npm run build --workspace=miniapp-gas-sponsor
```

Targeted logic and PlayArea tests live under `apps/shared/test/gas-sponsor.*.test.*`.
