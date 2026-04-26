# TrustAnchor Deployment Notes

TrustAnchor deploys through the shared `PlatformAnchor` contract.

## Required Setup

1. Deploy `PlatformAnchor`.
2. Call `registerAnchorApp("miniapp-trustanchor", 1, appAdmin)`.
3. Register AA-generated agent accounts with `registerAgent`.
4. Sync governance votes with `voteAgent` or `votePooledStake`.
5. Write the deployed `PlatformAnchor` hash into the app manifest and host
   definition for the target network.

User staking can be a single NEO transfer when the transfer data is
`miniapp-trustanchor`. The contract credits the sender and immediately stakes
that credit after checking the sender witness.

## Custody Boundary

- Admins can register agents, update candidates, set display weights, pause the
  app, and sync votes.
- Admins cannot withdraw user-staked NEO.
- Admins cannot claim or redirect user reward GAS.
- User withdrawals and reward claims require the user witness.

## Status

The shared contract compiles to `contracts/build/PlatformAnchor.nef`. Mainnet
and testnet hashes remain intentionally empty until deployment is performed and
the app is registered on-chain.
