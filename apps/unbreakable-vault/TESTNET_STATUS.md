# Unbreakable Vault network status

Canonical cross-network product status now lives in
[`NETWORK_STATUS.md`](./NETWORK_STATUS.md). This file preserves the detailed
2026-07-11 testnet read-only snapshot for traceability.

Verified read-only on 2026-07-11 against Neo N3 mainnet and testnet. No
transaction was broadcast.

## Mainnet deployment

- Contract: `0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa`
- Contract name/version: `MiniAppUnbreakableVault` `2.0.0`
- Network magic: `860833102`
- The canonical read methods HALT and the contract is not paused.
- `totalVaults = 0`.
- `paymentHub()` currently returns null. Because the mainnet write ABI requires
  a trailing settled receipt ID, the app deliberately exposes mainnet as
  read-only until PaymentHub is configured on-chain.

## Deployment and ABI

- Contract: `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0`
- Contract name: `MiniAppUnbreakableVault`
- Read methods verified in the live ABI: `totalVaults`, `getVaultConstants`,
  `getVaultDetails`, `getPlatformStats`
- Write methods verified in the live ABI: `createVault`, `attemptBreak`,
  `increaseBounty`, `claimExpiredVault`
- Confirming events verified in the live ABI: `VaultCreated`, `AttemptMade`,
  `BountyIncreased`, `VaultExpired`
- GAS `Transfer` is the standard three-slot event: `from`, `to`, `amount`.
  It does not carry a memo slot.

## Live read snapshot

The 2026-07-11 RPC read returned:

- `totalVaults = 44`
- minimum bounty `1 GAS`
- attempt fees `0.1 / 0.5 / 1 GAS` for Easy / Medium / Hard
- platform fee `200 bps`
- default expiry `2,592,000 seconds` (30 days)
- platform totals: 44 vaults, 39 broken, 40 attempts

Recent vaults were also read through `getVaultDetails`; the response includes
the creator, bounty, attempt count, difficulty, fee, timestamps, winner, title,
description, and status required by the UI.

A non-persisting `invokefunction` simulation of `claimExpiredVault(44)` with
the creator signer HALTed and emitted `VaultExpired(..., refund=490000000)` for
a `500000000` base-unit bounty. This proves the creator expiry refund is 98%
and the same 200 bps protocol fee applies to reclaim. The simulation did not
broadcast or mutate chain state.

## Recovery evidence

Focused tests prove that:

- a payment-only CREATE recovery calls `createVault` directly and never sends a
  second GAS transfer;
- a payment-only ATTEMPT waits for the user to re-enter the unstored secret,
  then calls `attemptBreak` directly without a second payment;
- accidental recovery-record corruption is caught by a deterministic schema
  checksum; the checksum is not treated as transaction confirmation;
- a recomputed checksum cannot bypass the exact confirmed transfer check, the
  wallet signature, contract-side prepaid-credit bucket, or event/readback
  verification;
- confirmed create, attempt, increase, and reclaim paths require exact event
  fields plus authoritative readback before success is shown.

## Known external limitation

The contract has no public per-payer/per-memo prepaid-credit getter. Payment
recovery therefore validates the transfer VM state, GAS contract, sender,
recipient, and amount. The local recovery checksum is only a corruption/schema
guard; it is not a confirmation boundary. The wallet signer and the contract's
memo-specific prepaid-credit bucket remain authoritative for the resumed
business call. The app does not invent a memo in the three-slot NEP-17
`Transfer` event. A broadcast business tx remains pending until its exact app
event is found by the shared N3Index transport or by the transaction
application-log fallback.

No private key was used, no wallet was connected, and no write transaction was
submitted during this verification pass.
