# SelfLoan production status

Last read-only verification: 2026-07-11. No deployment, contract update, signed transaction, token transfer, or private-key use was performed in this frontend pass.

## Published binding

| Network | Contract | Name | NEF checksum | Update counter | Configured NEO price | Lending pool |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Neo N3 MainNet | `0x87f94598c78cb954ca8200d3964ded9b584d7250` | `MiniAppSelfLoan` | `927006627` | `0` | `3 GAS / NEO` | `5 GAS` |
| Neo N3 TestNet T5 | `0x87f94598c78cb954ca8200d3964ded9b584d7250` | `MiniAppSelfLoan` | `927006627` | `0` | `5 GAS / NEO` | `2 GAS` |

Both RPCs returned `HALT` for `neoPrice`, `pool`, `feeBps`, `ltvTierBps(1..3)`, `totalLoans`, `totalBorrowed`, `totalRepaid`, and `getOwner`. The live tiers are `2000 / 3000 / 4000` bps, the origination fee is `50` bps, and the three aggregate activity counters currently read zero.

The frontend pins the network, script hash, checksum, update counter, contract name, exact borrower/read ABI, and exact event signatures before enabling a wallet action. A same-address upgrade or ABI drift fails closed.

## Product truth

- NEO collateral is indivisible and stays in contract custody until full manual repayment.
- GAS debt uses 8-decimal base units. Debt is the gross draw; the one-time fee is deducted from the amount disbursed.
- `neoPrice` is an owner-configured on-chain value, not a live oracle or market feed.
- The deployed contract has no liquidation, interest, keeper, staking-yield collection, auto-repayment, or third-party voting path.
- Borrow and add-collateral use deposit-then-act. Repayment atomically batches any GAS shortfall transfer with `repay`, preventing a new stranded repay-credit leg.
- Every broadcast is journaled with its exact txid. Success requires the exact expected event and a matching canonical contract readback. A restored pending journal blocks duplicate writes.
- Unused collateral credit is recoverable through `withdraw`. Published v1 exposes `withdrawRepayCredit` but omits `RepayCreditWithdrawn`; the frontend therefore locks that legacy recovery control instead of claiming an unverifiable success.

## Reviewed artifact distinction

The current local `contracts/build/MiniAppSelfLoan.nef` has checksum `1749916863` and its manifest includes an owner-gated `update` method. It is not byte-identical to either published checksum-`927006627` deployment. The production frontend therefore attests the actual published generation; it does not claim that the current local build was deployed.

## Verification completed

- App Vitest suite, focused shared logic/integration/PlayArea/production/RPC tests
- TypeScript no-emit check
- App build and output asset/MIME checks
- Manifest/i18n and shared product guards
- Read-only MainNet and TestNet `getcontractstate` plus safe-method reads

Live wallet lifecycle replay remains a separate release-signoff step because this pass intentionally submitted no transaction.
