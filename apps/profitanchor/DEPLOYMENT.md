# ProfitAnchor Deployment Notes

ProfitAnchor is deployed by registering `miniapp-profitanchor` in the shared
`PlatformAnchor` contract with mode `2`.

Deployment sequence:

1. Deploy or update `PlatformAnchor`.
2. Call `registerAnchorApp("miniapp-profitanchor", 2, appAdmin)`.
3. Register the 21 AA-generated agent accounts with `registerAgents` or
   `registerAgent`.
4. Rebalance by calling `transferAgentNeo(appId, fromAgentId, toAgentId, amount)`
   with the source agent AA witness.
5. When candidates change, call `setAgentCandidate` and then `voteAgent`.

AA account IDs should be derived from verifier params that include
`anchor + appId + agentId + nonce`; the nonce is operator-provided to prevent
pre-registration griefing.
