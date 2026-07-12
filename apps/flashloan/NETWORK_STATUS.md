# Flash Loan network status

Offline review date: 2026-07-12

This pass made no network request. The deployment facts below are the frozen
read-only evidence recorded on 2026-07-11; they were not refreshed or promoted
to a new live claim.

## Frozen deployment snapshot

| Network | Magic | Contract | Snapshot pool | Snapshot state |
| --- | ---: | --- | ---: | --- |
| Neo N3 mainnet | `860833102` | `0xb5d8fb0dc2319edc4be3104304b4136b925df6e4` | `0 GAS` | Not paused; zero pool; `paymentHub()` returned zero Hash160 |
| Neo N3 testnet | `894710606` | `0xde8e595d8d3c293731db499367ee2a768e1e458b` | `5.0009 GAS` | Not paused; one recorded loan |

Both recorded manifests identified `MiniAppFlashLoan` version `3.0.0` and
reported these constants:

```text
minLoan                100000000        (1 GAS)
maxLoan                10000000000000   (100,000 GAS)
feeBasisPoints         9                 (0.09%)
loanCooldownSeconds    300
maxDailyLoans          10
providerFeeShare       80
```

The MiniApp manifest defaults a missing launch-network hint to mainnet and binds
both hashes explicitly. Writes additionally require the wallet-detected network
and active configured contract to match that launch context.

## ABI binding

Both recorded deployments expose:

```text
requestLoan(borrower: Hash160, amount: Integer,
            callbackContract: Hash160, callbackMethod: String) -> Integer
withdraw(provider: Hash160, amount: Integer)
getLoanDetails(loanId: Integer) -> Map
getPlatformStats() -> Map
getBorrowerEligibility(borrower: Hash160) -> Map
getProviderStatsDetails(provider: Hash160) -> Map
```

The deposit ABI differs by deployment and the frontend keeps the lanes separate:

```text
mainnet: deposit(depositor: Hash160, amount: Integer, receiptId: Integer)
testnet: deposit(depositor: Hash160, amount: Integer)
```

The exact events used for confirmation are:

```text
LoanExecuted(loanId, borrower, amount, fee, success)
LiquidityDeposited(provider, amount, totalDeposited)
LiquidityWithdrawn(provider, amount, remaining)
```

All monetary values remain decimal Fixed8 integer strings through wallet args,
pending records, events and authoritative reads. Decimal conversion is only a
display concern.

## Frozen callback evidence

The 2026-07-11 read-only evidence recorded this testnet harness:

```text
0x7aa01290d33f6b2313a7efd6acde58f3e64b636f
execute(borrower: Hash160, amount: Integer, fee: Integer, loanId: Integer)
```

A non-persisting signer-context simulation returned `HALT` for `execute` with
the expected principal, repayment and `LoanExecuted` notifications. Replacing
the method with `onFlashLoan` returned `FAULT` because that method was absent.
This evidence only establishes recorded ABI compatibility; it is not a current
availability guarantee, broadcast receipt or successful user loan.

## Current product posture

- Mainnet borrowing remains disabled when the fresh pool read is zero.
- Mainnet deposits remain disabled when a fresh `paymentHub()` read is missing,
  unreachable or zero; eligible provider withdrawals remain independently
  available.
- Testnet borrowing and prepaid deposit controls open only after fresh contract,
  pause, pool, eligibility, wallet-network and canonical binding checks.
- Any read outage preserves the last display snapshot but marks contract health
  unavailable and disables signing.
- Malformed pause or eligibility booleans and malformed loan records are treated
  as unavailable chain evidence, never as an unpaused contract or a believable
  loan. Base58 wallet accounts are normalized to canonical Hash160 arguments
  before every write.

Signed loan, deposit, finalize-only recovery and withdrawal flows remain an
operator-authorized acceptance gate. They were not exercised in this offline
pass.
