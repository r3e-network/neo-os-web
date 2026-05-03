# TrustAnchor MiniApp

TrustAnchor is the governance-focused anchor app for NEO staking. It uses the
shared `PlatformAnchor` contract and AA-generated agent accounts for vote
identity.

| Property | Value |
| --- | --- |
| App ID | `miniapp-trustanchor` |
| Category | Governance |
| Contract | `PlatformAnchor`, mode `1` |
| Admin scope | Register agents, update candidates, sync votes |

## Safety Model

- User NEO is accounted inside `PlatformAnchor` and can only be withdrawn by the
  same user witness.
- NEO transfers that include `miniapp-trustanchor` as transfer data are credited
  and staked in the same receipt; un-staked credits can be recovered with
  `withdrawCredit`.
- User reward GAS is claimable only by the same user witness.
- Admins cannot transfer staked NEO or reward GAS to arbitrary recipients.
- AA agent accounts provide vote identities. `voteAgent` also requires the agent
  account witness, so admin authority alone is not enough to move an AA agent.

## Product Model

- TrustAnchor routes governance exposure explicitly through registered AA agent
  accounts.
- Each agent has an account hash, candidate public key, verification-script hash,
  and display weight.
- Admin operations are limited to route configuration and vote-only sync.
- GAS reward accounting uses the shared reward-per-NEO accumulator.

## Voting-yield Routing Boundary

TrustAnchor supports pooled NEO voting and candidate routing for GAS rewards
without exposing an admin custody path over user stake or accrued GAS.

## Deployment

The frontend and contract source are ready for the shared `PlatformAnchor`
deployment. Network hashes stay empty until the shared contract is deployed and
`registerAnchorApp("miniapp-trustanchor", 1, appAdmin)` has been called.

## Development

```bash
npm install
npm run build
```
