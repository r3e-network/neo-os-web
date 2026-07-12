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

## Current status

As read-only verified on 2026-07-12, the app is already registered as mode `2`
on mainnet `0x02beeef6f65c6989a121c0a0e6b23190333edb98` and testnet
`0xab079b4f9a0a2471d136392e25eb8e99898dcad0`. Both registrations are live and
unpaused. See `NETWORK_STATUS.md`. This frontend pass did not deploy or update
either contract.
