# ProfitAnchor MiniApp

ProfitAnchor is the profit-only counterpart to TrustAnchor. It uses the shared
`PlatformAnchor` contract mode for NEO staking/reward accounting and limits
admin authority to candidate scoring plus vote execution.

| Field | Value |
| --- | --- |
| App ID | `miniapp-profitanchor` |
| Contract | `PlatformAnchor` shared contract, mode `2` |
| User asset | NEO |
| Reward asset | GAS |

## Model

- Users retain accounting ownership of staked NEO.
- NEO transfers that include `miniapp-profitanchor` as transfer data are credited
  and staked in the same receipt; un-staked credits can be recovered with
  `withdrawCredit`.
- Admins can register AA-generated agent accounts and update candidate profit scores.
- ProfitAnchor exposes only the highest-profit candidate for pooled NEO voting.
- Admin methods do not transfer user-staked NEO or user-rewarded GAS.
- SelfLoan can read ProfitAnchor's best candidate and vote collateralized NEO from the SelfLoan contract without transferring collateral custody.

## Voting-yield routing boundary

ProfitAnchor monitors candidate returns and routes voting toward better GAS yield while keeping the admin surface limited to candidate-profit scoring. It does not add custody authority over user-staked NEO or user-rewarded GAS.

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
