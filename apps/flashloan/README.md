# Flash Loan

A production-oriented Neo N3 DeFi desk for atomic, callback-based GAS loans.

## Product model

| Property | Value |
| --- | --- |
| App ID | `miniapp-flashloan` |
| Category | DeFi |
| Version | 1.1.0 |
| Asset | GAS |
| Callback model | Neo-specific four-argument callback |

The primary screen is an execution desk, not a parameter form. It keeps the
principal, live pool, fee, exact repayment, callback route, risk boundary and
local preflight result visible together. Callback configuration, liquidity
management, lookup, history and contract parameters are progressively disclosed
in the tools drawer.

## Deployed contracts

| Network | Contract | Current pool | Current write posture |
| --- | --- | ---: | --- |
| Neo N3 mainnet | `0xb5d8fb0dc2319edc4be3104304b4136b925df6e4` | `0 GAS` | Borrowing has no available liquidity; deposits are disabled because `paymentHub()` is zero |
| Neo N3 testnet | `0xde8e595d8d3c293731db499367ee2a768e1e458b` | `5.0009 GAS` | Callback loans and prepaid deposits are available when all live checks pass |

Read-only verification used `https://mainnet1.neo.coz.io:443` and
`https://testnet1.neo.coz.io:443`. No wallet transaction was signed or broadcast
during the 2026-07-11 verification pass.

## Atomic route

1. The borrower calls
   `requestLoan(borrower, amount, callbackContract, callbackMethod)`.
2. The lender transfers the GAS principal to the callback contract.
3. It invokes
   `callbackMethod(borrower, amount, fee, loanId)` in the same transaction.
4. The callback must return the principal plus the exact contract-reported fee.
5. If the callback is missing, faults, or under-repays, the transaction FAULTs
   and the loan is not executed.

This deployed interface is not ERC-3156. The current live constants are:

- minimum loan: `1 GAS`
- configured maximum: `100,000 GAS`, further capped by live pool and borrower eligibility
- fee: `9` basis points (`0.09%`)
- cooldown: `300` seconds
- daily limit: `10` loans
- liquidity-provider fee share: `80%`

All GAS values stay in integer Fixed8 base units through validation, wallet
arguments, events and readback. Decimal formatting occurs only at the UI edge.

## Verified testnet callback

The bundled testnet harness is:

```text
0x7aa01290d33f6b2313a7efd6acde58f3e64b636f
```

Its manifest exposes:

```text
execute(borrower: Hash160, amount: Integer, fee: Integer, loanId: Integer)
```

A read-only `invokefunction` simulation with a signer context returned `HALT`
for `execute` and emitted the principal transfer, exact repayment transfer and
`LoanExecuted`. The same simulation with `onFlashLoan` returned `FAULT` because
that method does not exist. This simulation is compatibility evidence only; it
is not a broadcast, receipt or successful user loan.

## Transaction and recovery rules

- Every write checks the wallet-detected network and canonical contract before
  the wallet prompt, immediately after it, and again before invocation; pause
  state and current contract data are refreshed inside that boundary.
- Loan, deposit, finalize-only recovery and withdrawal are serialized. A
  different financial flow cannot begin while any submitted action remains
  unresolved.
- Recovery storage must pass a write/read/delete round trip before the wallet is
  opened.
- A broadcast payload, local callback, timeout or txid alone is never success.
- Conflicting transaction IDs from wallet callbacks and the final wallet result
  keep the first broadcast locked for review instead of selecting one silently.
- Loan success requires the exact tx-bound `LoanExecuted` event and matching
  `getLoanDetails` plus fresh platform readback.
- Deposit and withdrawal success require the exact tx-bound liquidity event and
  matching provider/platform readback.
- Application-log `FAULT` is surfaced explicitly. An atomic loan or withdrawal
  FAULT clears its pending lock; it is not reported as success.
- A testnet prepaid GAS transfer is never paid twice. Finalize-only recovery is
  unlocked only after the exact confirmed GAS transfer to this contract is
  observed. If the consuming deposit FAULTs, the confirmed prepayment remains
  recoverable without another transfer.
- Switching wallet, network or contract while an action is pending blocks new
  writes until the original context is restored.

Only non-secret recovery metadata is stored locally. Wallet keys and callback
secrets are never stored.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the frozen read-only deployment
evidence and [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for current offline
acceptance status.
