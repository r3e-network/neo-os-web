# SelfLoan Frontend Validation

Generated: 2026-06-01
Network: Neo N3 testnet
Wallet: NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu
Contract: 0x39d4584ddb0731e48e611647931993ee033bf373

## Result

- PASS: SelfLoan operation panel exposes Create Loan, Repay Loan, Add Collateral, and Sync Anchor Vote.
- PASS: Create Loan submits a single frontend-driven batch with optional GAS liquidity top-up, NEO collateral transfer, and PlatformDeFi createLoan.
- PASS: Repay Loan submits a frontend-driven GAS credit transfer plus repayLoan call.
- PASS: Add Collateral submits a frontend-driven NEO credit transfer plus addCollateral call.
- PASS: Final browser pass had 0 console errors.

## Testnet Transactions

- Create loan 142: 0x34a991da5ba3347688c8167c86ef66830f8cf7ea1a6b9841149e13d864136054
  - HALT, LoanCreated, collateral 1 NEO, borrowed 19900000 fixed8 GAS.
- Repay loan 142: 0x6e27cd7f5e720d5e5e70e8a5bfd469301d1d62987e05267a0e59c2ca28e62125
  - HALT, LoanRepaid, LoanClosed, debt 0, active false.
- Create loan 143: 0x2f3b6832cac9465a5c519a6a88fed52bbcd4cfab91dee0f5f42f6ff0ed714e31
  - HALT, LoanCreated, collateral 1 NEO.
- Add collateral to loan 143: 0x206a70609cbad8b4c326a3372b73a12c7c9cbeb5a3d2b2f3769ef06e25d97541
  - HALT, CollateralAdded, new collateral 2 NEO.
- Repay loan 143: 0x8847c3c3f1b9dd817e95b278bb902dcbe9bcfdb0ce0197f36a260e8b02eb1712
  - HALT, LoanRepaid, LoanClosed, debt 0, active false.

## Screenshots

- docs/reports/selfloan-before-connect.png
- docs/reports/selfloan-connected.png
- docs/reports/selfloan-create-validation.png
- docs/reports/selfloan-repay-validation.png
- docs/reports/selfloan-add-collateral-validation.png
- docs/reports/selfloan-second-repay-validation.png
