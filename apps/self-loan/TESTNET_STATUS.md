# SelfLoan TestNet status

Read-only verification on 2026-07-11 found the configured TestNet contract at `0x87f94598c78cb954ca8200d3964ded9b584d7250` with name `MiniAppSelfLoan`, NEF checksum `927006627`, and update counter `0`.

The safe reads returned:

- `neoPrice = 500000000` base units (`5 GAS / NEO`)
- `pool = 200000000` base units (`2 GAS`)
- `feeBps = 50`
- `ltvTierBps(1..3) = 2000 / 3000 / 4000`
- `totalLoans / totalBorrowed / totalRepaid = 0 / 0 / 0`

The live ABI exposes `borrow`, `addCollateral`, `repay`, `withdraw`, `withdrawRepayCredit`, and the required safe reads. It exposes exact events for collateral credit, borrow, add, repayment, loan close, and collateral withdrawal, but omits `RepayCreditWithdrawn`. The UI therefore uses an atomic transfer-plus-repay batch for new repayments and fail-closes the legacy GAS-credit reclaim control. It also does not expose the newer local build's `update` method; the local NEF checksum is `1749916863`, so the local artifact is not represented as deployed.

No TestNet transaction, transfer, deployment, update, or key use occurred in this pass. A fresh two-wallet lifecycle replay (borrow, partial repay, add collateral, full repay, and both credit-recovery branches) remains required for final release signoff against this exact checksum.
