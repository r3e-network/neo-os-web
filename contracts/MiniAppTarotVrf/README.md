# MiniAppTarotVrf

Production-oriented asynchronous Tarot draw contract for Neo N3. It requests 32 bytes
from Morpheus, derives three distinct cards in `0..77` with rejection-sampled partial
Fisher-Yates, and never falls back to `Runtime.GetRandom`.

This contract is compiled and mock-E2E tested but is **not deployed**. It is independent
from the existing `MiniAppTarot` deployment and must not be used to update that contract
in place.

On network magic `894710606`, a null deploy payload selects the pinned canonical
TESTNET Morpheus hash. Every other network must provide an explicit deployed Oracle
Hash160 as the ContractManagement deploy payload; there is no cross-network default.

## Trust and callback model

- Requests use `onOracleResult` only when both network magic is `894710606` and the
  configured Oracle is the canonical TESTNET contract
  `0x4b882e94ed766807c4fd728768f972e13008ad52`.
- Every other deployment commits to the rich eight-argument `onMiniAppResult` adapter.
- Settlement binds caller, configured/stored Oracle, network, app/module/operation,
  requester, reading ID, request ID in both directions, active-player index, permanent
  request-ID tombstone, callback adapter, fees, request time, and a recomputed payload
  hash.
- `vrf_random` currently means signed Morpheus CSPRNG output. It is not a formal
  proof-carrying VRF.

## Funds

Player credit and Oracle reserve are separate accounting buckets:

- player credit memo: `miniapp-tarot-vrf:credit` (exact 0.1 GAS multiples);
- admin reserve memo: `miniapp-tarot-vrf:oracle`;
- reading fee: 0.1 GAS;
- Oracle request fee: read live and bounded by the player's `maxOracleFee` and the
  reading fee.

Successful readings allocate the reading fee between earned revenue and Oracle-reserve
replenishment. Oracle failure, malformed entropy, or local expiry restores the entire
reading fee to withdrawable player credit; any already-spent Oracle fee remains an
operator-reserve cost. After the deadline, both transaction orderings converge safely:
a keeper can refund first and invalidate a later callback, or a callback arriving first
will perform the expiry refund instead of drawing cards.

## Main ABI

Writes:

- `requestReading(player, maxOracleFee)`
- `refundExpiredReading(readingId)` / `cancelExpiredReading(readingId)`
- `withdrawCredit(account, amount)` / `withdrawAllCredit(account)`
- `proposeAdmin` / `acceptAdmin`
- `setPaused`
- `proposeOracle` / `activateOracle` / `cancelOracleProposal`
- `proposeUpdate` / `update` / `cancelUpdateProposal`
- `withdrawRevenue` / `withdrawOracleReserve`

Reads:

- `getReading`, `getPlayerReadings`, `playerReadingCount`
- `completedReadingsCount`, `playerCompletedReadingCount` (successful spreads only;
  pending and refunded requests are not presented as cards drawn)
- `creditOf`, `activeReadingOf`, `requestIdForReading`, `readingIdForRequest`,
  `requestIdSeen`
- `pendingCount`, `pendingFees`, `revenue`, `oracleReserve`,
  `totalCreditLiability`, `accounting`
- `currentOracleFee`, `currentOracleFeeCredit`, `integrationConfig`

## Build and verify

```bash
deploy/scripts/build_tarot_vrf.sh
node deploy/scripts/verify_tarot_vrf_morpheus_testnet.mjs
```

The build script pins Neo.Compiler.CSharp 3.9.1 and checked arithmetic. The second command
is read-only: it verifies TESTNET network magic, canonical Oracle hash, ABI generation,
method signatures/safety flags, and the current request fee. It does not load a WIF or
build a transaction.

The full activation checklist and current live-ABI evidence are in
`../../docs/reports/on-chain-tarot-vrf-contract-status-2026-07-11.md`.
