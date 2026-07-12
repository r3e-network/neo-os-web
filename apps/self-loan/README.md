# SelfLoan

SelfLoan is a standalone Neo N3 collateral-loan desk: deposit whole NEO, choose a 20%, 30%, or 40% LTV tier, and receive GAS from an owner-funded pool. The debt has no interest and the deployed contract has no liquidation method. Collateral remains in contract custody until the borrower fully repays the GAS debt.

This is not an auto-repaying or yield-bearing loan. The deployed contract does not vote with collateral, harvest NEO rewards, run a keeper, or consume a live market oracle. New debt is sized from an operator-configured `neoPrice` value stored on-chain.

## Product flow

1. Connect a Neo N3 wallet. The app reads NEO/GAS balances, the active position, recovery credits, LTV tiers, fee, configured price, and pool liquidity.
2. Choose whole-number NEO collateral and one LTV tier.
3. Review the exact gross debt, 0.5% origination fee, net GAS disbursement, configured quote, and two-wallet-confirmation route.
4. Confirm the NEO deposit (`selfloan:collateral`) and then `borrow(borrower, tier)`.
5. Manage the single active position by partially/fully repaying GAS or adding NEO collateral.
6. A full repayment releases all locked NEO. A partial repayment reduces debt while collateral stays locked.

Native NEO/GAS transfers do not use an ERC-20-style allowance. Borrow/add-collateral use up to two wallet confirmations. Repayment batches the GAS transfer and `repay` call atomically in one transaction, so a failed second script cannot leave a new standalone repay credit.

## Fail-closed behavior

- Quote, fee, pool, wallet balance, position, and recovery-credit reads are validated separately from real zero values. A failed or malformed read disables writes.
- Every money-moving action refreshes its critical reads before the first transfer.
- Borrow reviews carry the exact price, fee, LTV, and net disbursement. If any value changes before signing, the action stops for a new review.
- Existing collateral or repay credit is read exactly. The app transfers only the shortfall and never treats a failed credit read as zero.
- If a deposit is broadcast but not confirmed, the second contract call is not sent.
- Broadcast-but-unconfirmed calls are shown as pending, never as success.
- Before any wallet request, the app pins the selected network, script hash, live NEF checksum `927006627`, update counter `0`, contract name, ABI, and events. Same-address deployment drift disables writes.
- Every broadcast txid is persisted immediately. Refresh recovery requires the exact event and matching contract-state readback before clearing the journal or enabling another write.
- A failed borrow/add second step leaves recoverable NEO credit; `withdraw(account)` returns it. The published v1 ABI has `withdrawRepayCredit` but omits its confirmation event, so that legacy GAS-credit recovery control is fail-closed. New repayment no longer creates this risk because it is atomic.

## Deployed contract model

Both manifest networks currently point to:

`0x87f94598c78cb954ca8200d3964ded9b584d7250`

The live ABI was read from Neo mainnet and testnet on 2026-07-11. User-facing methods are:

| Kind | Methods |
| --- | --- |
| Reads | `neoPrice`, `pool`, `collateralCreditOf`, `repayCreditOf`, `getLoan`, `ltvTierBps`, `feeBps`, `totalLoans`, `totalBorrowed`, `totalRepaid` |
| Borrower writes | `borrow(borrower, tier)`, `addCollateral(borrower)`, `repay(borrower)`, `withdraw(account)`, `withdrawRepayCredit(account)` |
| Token callback | `onNEP17Payment(from, amount, data)` |
| Owner writes | `setNeoPrice(gasPerNeo)`, `withdrawPool(to, amount)` |

The live LTV tiers are 2000/3000/4000 bps and the origination fee is 50 bps. `neoPrice` is GAS base units per whole NEO; GAS amounts use 8 decimals while NEO is indivisible.

The published MainNet contract currently reports `3 GAS / NEO` and `5 GAS` of pool liquidity; TestNet reports `5 GAS / NEO` and `2 GAS`. See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) and [TESTNET_STATUS.md](./TESTNET_STATUS.md). The current local NEF checksum is different from the published generation and is not represented as deployed.

## Recovery semantics

- NEO deposit memo: `selfloan:collateral`
- GAS repayment memo: `selfloan:repay` (executed in the same transaction as `repay`)
- Borrow/add consumes all collateral credit associated with the borrower.
- Repay consumes all GAS repay credit, caps the applied amount at outstanding debt, and refunds excess on-chain. The frontend atomically batches any required shortfall transfer with this call.
- One active loan is allowed per borrower address.

## Local development

```bash
cd apps/self-loan
npm run test
npm run build
npm run dev -- --port 5346
```

The UI uses the shared Neo Press Kit NEO/GAS token assets. The old generated scene files in `public/` are not used because they contain non-official token marks.

## License

MIT — R3E Network
