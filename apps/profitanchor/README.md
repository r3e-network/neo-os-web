# ProfitAnchor MiniApp

ProfitAnchor is the profit-policy counterpart to TrustAnchor. It uses the
shared `PlatformAnchor` contract as a manual AA-agent routing desk: operators
rebalance NEO between candidate agent accounts and sync votes explicitly.

| Field | Value |
| --- | --- |
| App ID | `miniapp-profitanchor` |
| Contract | `PlatformAnchor` shared contract, mode `2` |
| Asset | NEO |
| Agent set | 21 AA accounts |

## Model

- Each registered anchor owns 21 AA agent accounts, one per council candidate.
- Agent account derivation should include anchor/app/agent/nonce material so the
  account IDs cannot be maliciously pre-registered.
- Rebalancing is a simple transfer from candidate A's agent to candidate B's
  agent.
- Candidate-list changes are handled by updating an agent's vote target and then
  syncing that agent vote.
- SelfLoan can follow ProfitAnchor's selected manual route without transferring
  collateral custody.

## Voting route boundary

ProfitAnchor is an operator-controlled route book. Rebalances happen only when
an authorized operator chooses a source agent, target agent, and amount.

## Source Layout

```text
apps/profitanchor/
├── src/
│   ├── main.tsx
│   ├── PlayArea.tsx
│   ├── hooks/useProfitAnchor.ts
│   └── pages/index/data/agentAccounts.ts
└── neo-manifest.json
```
