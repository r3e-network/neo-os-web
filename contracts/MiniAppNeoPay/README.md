# MiniAppNeoPay

`MiniAppNeoPay` powers **NeoPay**.

## Current Capability

This contract provides the minimum on-chain stream ledger required by the current frontend:

- creator locks `GAS` or `NEO`
- beneficiary accrues claimable balance per interval
- beneficiary claims unlocked balance on demand
- creator can cancel and recover the not-yet-unlocked portion

## Core Methods

- `createStream(UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger totalAmount, BigInteger rateAmount, BigInteger intervalSeconds, string title, string notes)`
- `claimStream(UInt160 beneficiary, BigInteger streamId)`
- `cancelStream(UInt160 creator, BigInteger streamId)`
- `getStreamDetails(BigInteger streamId)`
- `getUserStreams(UInt160 user, BigInteger offset, BigInteger limit)`
- `getBeneficiaryStreams(UInt160 beneficiary, BigInteger offset, BigInteger limit)`

## Current Status

- contract source exists and compiles
- frontend ABI now matches the contract
- testnet deployment is live at `0x4e4a27ae72d06d057f54d4136ed8c5176b552b16`
- mainnet deployment is still pending

## Important Boundary

This contract does **not yet** implement AA scheduling, NeoDID verification, or TEE payroll privacy.
It currently provides the recurring-stream state machine required by the live NeoPay miniapp.
