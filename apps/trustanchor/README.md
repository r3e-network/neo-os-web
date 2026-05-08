# TrustAnchor MiniApp

TrustAnchor is the governance-focused anchor app for manual NEO vote routing.
It uses the shared `PlatformAnchor` contract and AA-generated agent accounts for
vote identity.

| Property | Value |
| --- | --- |
| App ID | `miniapp-trustanchor` |
| Category | Governance |
| Contract | `PlatformAnchor`, mode `1` |
| Admin scope | Register agents, update candidates, sync votes |

## Safety Model

- Each registered anchor owns 21 AA agent accounts, one per council candidate.
- Agent account derivation should include anchor/app/agent/nonce material so the
  account IDs cannot be maliciously pre-registered.
- Rebalancing is a simple transfer from candidate A's agent to candidate B's
  agent.
- Candidate-list changes are handled by updating an agent's vote target and then
  syncing that agent vote.
- AA agent accounts provide vote identities. `voteAgent` also requires the agent
  account witness, so admin authority alone is not enough to move an AA agent.

## Product Model

- TrustAnchor routes governance exposure explicitly through registered AA agent
  accounts.
- Each agent has an account hash, candidate public key, verification-script hash,
  and display weight.
- Admin operations are limited to route configuration and agent vote sync.

## Voting-yield Routing Boundary

TrustAnchor is intentionally manual. It is an operator-controlled route book,
not an automatic yield optimizer.

## Deployment

The frontend and contract source are ready for the shared `PlatformAnchor`
deployment. Network hashes stay empty until the shared contract is deployed and
`registerAnchorApp("miniapp-trustanchor", 1, appAdmin)` has been called.

## Development

```bash
npm install
npm run build
```
