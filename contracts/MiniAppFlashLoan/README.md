# MiniAppFlashLoan

`MiniAppFlashLoan` is a self-contained GAS flash-loan pool for Neo N3.

## Model

- liquidity providers prepay GAS directly to the contract and call `deposit`
- borrowers call `requestLoan`
- the contract transfers the principal to a callback contract
- the contract immediately calls the callback method in the same transaction
- the callback contract must return `principal + fee`
- if repayment is not exact, the whole transaction reverts

## Core Properties

- asset: `GAS`
- minimum loan: `1 GAS`
- maximum loan: `100,000 GAS`
- fee: `0.09%`
- cooldown: `5 minutes`
- daily limit: `10 loans per borrower`

## Important Methods

### `requestLoan(UInt160 borrower, BigInteger amount, UInt160 callbackContract, string callbackMethod)`

Starts and finishes the flash loan atomically in one transaction.

### `deposit(UInt160 depositor, BigInteger amount, BigInteger receiptId)`

Credits direct prepaid GAS into pool liquidity.

Note:
- `receiptId` is kept for ABI continuity, but the live funding path is direct prepaid GAS credit.

### `withdraw(UInt160 provider, BigInteger amount)`

Withdraws provider liquidity from the pool.

### `getLoan(BigInteger loanId)`

Returns stored details for successful executed loans.

### `getPoolBalance()`

Returns the contract's accounted pool balance.

## Repayment Rule

The callback contract must repay the lender before the callback returns.

The flash-loan contract checks:

- contract GAS balance before funding
- contract GAS balance after callback
- exact fee gain of `loan fee`

If the callback underpays or overpays incorrectly, the transaction reverts.
