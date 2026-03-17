# MiniAppRedEnvelope

`MiniAppRedEnvelope` powers **Red Envelope**.

## Current Product Rules

- creator prepays the full GAS amount directly to the contract
- the envelope is created with total GAS amount and packet count
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
- receiving direct prepaid GAS credit in `OnNEP17Payment`

## Core Methods

- `CreateEnvelope(UInt160 creator, BigInteger totalAmount, BigInteger packetCount, BigInteger expiryDurationMs)`
  Consumes direct prepaid GAS credit and starts the RNG request.
- `Claim(BigInteger envelopeId, UInt160 claimer)`
  Pays the next precomputed packet amount to the claimer.
- `GetEnvelope(BigInteger envelopeId)`
- `HasClaimed(BigInteger envelopeId, UInt160 claimer)`
- `GetPacketAmount(BigInteger envelopeId, BigInteger index)`
- `OnOracleResult(BigInteger requestId, string requestType, bool success, ByteString result, string error)`
- `OnNEP17Payment(UInt160 from, BigInteger amount, object data)`

## Integration Notes

- canonical app id: `miniapp-redenvelope`
- the contract now assumes direct Morpheus Oracle callbacks, not ServiceLayerGateway
- frontend should transfer GAS to the contract before calling `CreateEnvelope`
- AA / NeoDID / sponsored-claim UX lives above the contract layer
