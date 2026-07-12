# ProfitAnchor Admin

ProfitAnchor Admin is the operator-only route desk for the ProfitAnchor AA-agent network. Its primary surface is a complete 21-node capital topology, not a generic form or a truncated directory.

## Operator flow

1. The app verifies both the on-chain agent roster and the connected wallet's platform/app-admin authority.
2. The operator selects a source and target directly on the topology. Selecting a source advances focus to the target slot.
3. The operator chooses a whole-NEO amount. Known source balances constrain quick amounts and submission; an unavailable advisory balance remains unknown rather than being misreported as zero.
4. Candidate changes accept only a new 33-byte compressed public key. Unchanged and malformed keys remain non-submittable.
5. Vote sync is a separate, explicit transaction and displays its AA witness requirement before submission.

Full account addresses, candidate keys, policy notes, and the 21-row directory are progressively disclosed through the agent inspector and route-details drawer.

## Safety invariants

- No write is enabled while authority or roster verification is pending.
- An empty or failed live read keeps the configured 21-route topology visible as degraded context, while routing stays disabled until a non-empty live roster is verified.
- Source and target agent IDs must differ.
- NEO amounts stay positive and integral; known balances are checked before dispatch.
- Candidate keys are normalized and validated in the UI, then validated again by the shared ProfitAnchor composable.
- An in-flight write locks the primary action against duplicate submission; a rejected wallet/chain request keeps the prepared route intact for retry.
- No automatic rebalancing occurs. `transferAgentNeo`, `setAgentCandidate`, and `voteAgent` remain distinct contract operations.

## Verification

From `apps/shared`:

```sh
npx vitest run test/profitanchor-admin.playarea.test.tsx test/profitanchor-admin.integration.test.tsx test/anchor-admin.model.test.ts
```

From this directory:

```sh
npm run build
npx tsc --noEmit -p tsconfig.json
```

## 中文说明

主界面一次呈现完整 21-agent 资金拓扑。来源、目标和操作类型都在拓扑与路由规划器中直接选择；完整地址、公钥、规则和名册仅在需要时展开。链上名册或运营权限尚未验证时，配置的 21 条路由会以降级态保留用于排查，但所有写操作都会锁定，绝不会把未验证数据当作链上真值。
