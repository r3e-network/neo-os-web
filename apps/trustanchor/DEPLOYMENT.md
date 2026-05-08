# TrustAnchor Deployment Notes

TrustAnchor deploys through the shared `PlatformAnchor` contract.

## Required Setup

1. Deploy `PlatformAnchor`.
2. Call `registerAnchorApp("miniapp-trustanchor", 1, appAdmin)`.
3. Register the 21 AA-generated agent accounts with `registerAgents` or
   `registerAgent`.
4. Rebalance by calling `transferAgentNeo(appId, fromAgentId, toAgentId, amount)`
   with the source agent AA witness.
5. When candidates change, call `setAgentCandidate` and then `voteAgent`.
6. Write the deployed `PlatformAnchor` hash into the app manifest and host
   definition for the target network.

AA account IDs should be derived from verifier params that include
`anchor + appId + agentId + nonce`; the nonce is operator-provided to prevent
pre-registration griefing.

## Custody Boundary

- Admins can register agents, update candidates, set display weights, pause the
  app, and request agent vote sync.
- Moving NEO requires the source AA agent witness.
- Agent vote sync requires the AA agent witness.

## Status

The shared contract compiles to `contracts/build/PlatformAnchor.nef`. Mainnet
and testnet hashes remain intentionally empty until deployment is performed and
the app is registered on-chain.
