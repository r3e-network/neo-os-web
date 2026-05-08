# Flash Loan

Self-contained atomic GAS flash loans on Neo N3.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-flashloan` |
| **Category** | DeFi |
| **Version** | 1.0.0 |
| **Model** | Callback-based atomic execution |

## Current Testnet Contract

| Property | Value |
|----------|-------|
| **Contract** | `0xde8e595d8d3c293731db499367ee2a768e1e458b` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0xde8e595d8d3c293731db499367ee2a768e1e458b) |

## How It Works

1. Liquidity providers prepay GAS directly into the flash-loan contract and call `deposit`.
2. Borrowers call `requestLoan(borrower, amount, callbackContract, "onFlashLoan")`.
3. The flash-loan contract transfers the principal to the callback contract.
4. In the same transaction, the flash-loan contract calls `onFlashLoan`.
5. The callback contract must repay `amount + fee` before control returns.
6. If repayment is not exact, the entire transaction reverts.

## Callback Contract Requirements

- It must implement `onFlashLoan`.
- It should expect to receive the principal first.
- It must transfer back the principal plus `0.09%` fee inside the same transaction.
- It should treat the flash-loan contract as the lender and `Runtime.CallingScriptHash`.

## Notes

- This miniapp is for advanced users and contract developers.
- The live flow is self-contained on-chain; pool funding goes straight into the flash-loan contract.
- AA can still be used as the caller path, but the flash-loan core is now self-sufficient.
