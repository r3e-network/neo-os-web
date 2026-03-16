# MiniAppCoinFlip

`MiniAppCoinFlip` currently powers **FogPlay**.

## Current Reality

This contract is a fast single-player coin-flip game:

- user places a heads/tails bet
- contract requests oracle randomness
- callback resolves the outcome
- the contract emits the payout result

It is **not yet** the encrypted real-time PvP duel model from the flagship product brief.

## Contract Role

The contract is responsible for:

- storing bet state
- requesting randomness from the configured Morpheus Oracle
- validating oracle callbacks
- resolving the bet outcome deterministically
- emitting result events for payout/indexing

## Core Methods

- `placeBet(UInt160 player, BigInteger amount, bool choice, BigInteger receiptId)`
- `getBet(BigInteger betId)`
- `onOracleResult(BigInteger requestId, string requestType, bool success, ByteString result, string error)`

## Integration Notes

- canonical app id: `miniapp-coinflip`
- frontend and host materials should treat this as an instant coin-flip product until a dedicated PvP contract lands
- AA rapid-play wiring is not part of the live miniapp flow yet
