# ProfitAnchor Deployment Notes

ProfitAnchor is deployed by registering `miniapp-profitanchor` in the shared
`PlatformAnchor` contract with mode `2`.

Deployment sequence:

1. Deploy or update `PlatformAnchor`.
2. Call `registerAnchorApp("miniapp-profitanchor", 2, appAdmin)`.
3. Register AA-generated agent accounts with `registerAgent`.
4. Feed candidate profit observations with `setAgentProfitScore`.
5. Trigger `voteBestProfitCandidate` for pooled stake, or let SelfLoan call
   `syncProfitAnchorVote` after `setProfitAnchor` is configured.

User staking can be a single NEO transfer when the transfer data is
`miniapp-profitanchor`. The contract credits the sender and immediately stakes
that credit after checking the sender witness.

Do not add admin transfer methods. User NEO exits through `withdraw`; user GAS
exits through `claimRewards`.
