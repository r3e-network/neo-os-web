# MiniAppRedEnvelope

`MiniAppRedEnvelope` powers **Red Envelope**.

## Current Product Rules

- creator deposits a total GAS amount and packet count
- packet count range: `1..100`
- minimum envelope total: `0.1 GAS`
- minimum per packet floor: `0.01 GAS`
- packet randomness is generated up front through the direct Morpheus Oracle flow
- users claim individual packets until the envelope is exhausted or refunded after expiry

## Contract Role

The contract is responsible for:

- creating envelope state
- requesting randomness for packet distribution
- mapping oracle requests back to envelope ids
- enforcing single-claim semantics
- exposing envelope state and claim status
- handling expiry-driven refund flow

## Core Methods

- `createEnvelope(UInt160 creator, BigInteger totalAmount, BigInteger packetCount, BigInteger expiryDurationMs, BigInteger receiptId)`
- `claim(BigInteger envelopeId, UInt160 claimer)`
- `getEnvelope(BigInteger envelopeId)`
- `hasClaimed(BigInteger envelopeId, UInt160 claimer)`
- `getPacketAmount(BigInteger envelopeId, BigInteger index)`
- `onOracleResult(BigInteger requestId, string requestType, bool success, ByteString result, string error)`

## Integration Notes

- canonical app id: `miniapp-redenvelope`
- the contract now assumes direct Morpheus Oracle callbacks, not ServiceLayerGateway
- AA / NeoDID / sponsored-claim UX lives above the contract layer
