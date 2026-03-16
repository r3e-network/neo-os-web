# MiniAppSelfLoan

`MiniAppSelfLoan` powers **SelfLoan**, the NEO-collateralized self-repaying lending flow.

## Current Product Rules

- Collateral asset: `NEO`
- Borrowed asset: `GAS`
- LTV tiers:
  - tier 1: `20%`
  - tier 2: `30%`
  - tier 3: `40%`
- Origination fee: `0.5%`
- Minimum collateral: `1 NEO`
- Minimum loan duration guard: `24 hours`

## Contract Role

The contract is responsible for:

- opening loans against locked NEO collateral
- tracking debt, original debt, total repaid amount, and borrower stats
- allowing manual repayment and collateral management
- accounting for auto-repayment from modeled NEO GAS yield
- exposing health-factor and loan-state queries for the frontend

The contract does **not** perform liquidation. The product promise is still “self-repaying liquidity with zero liquidation risk”.

## Core Methods

- `CreateLoan(UInt160 borrower, BigInteger neoAmount, BigInteger ltvTier, BigInteger receiptId)`
  Creates a new loan using the selected LTV tier.
- `Repay(UInt160 payer, BigInteger loanId, BigInteger amount, BigInteger receiptId)`
  Repays debt manually.
- `AddCollateral(UInt160 borrower, BigInteger loanId, BigInteger neoAmount, BigInteger receiptId)`
  Adds more NEO collateral to an active loan.
- `WithdrawCollateral(UInt160 borrower, BigInteger loanId, BigInteger neoAmount)`
  Withdraws excess collateral when safe.
- `GetLoan(BigInteger loanId)`
  Returns the full stored loan struct.
- `GetHealthFactor(BigInteger loanId)`
  Returns the health factor used by the UI / automation layer.
- `GetBorrowerStats(UInt160 borrower)`
  Returns aggregate borrower metrics and badge progress.

## Integration Notes

- The canonical app id is `miniapp-self-loan`.
- Frontend, manifest, and host definitions should describe all three LTV tiers, not only the conservative tier.
- AA can be used for smoother UX, but the lending logic itself remains fully on-chain.

## Important Clarification

Older docs in this repo described SelfLoan as a fixed `20%` LTV product. That is no longer accurate.
The live contract exposes `20% / 30% / 40%` tiers, and all user-facing materials should reflect that.
