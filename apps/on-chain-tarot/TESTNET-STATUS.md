# On-Chain Tarot testnet status

Checked against Neo N3 testnet RPC on 2026-07-11.

## Live deployments

### Catalog/domain legacy deployment

- Script hash: `0x5cdf29c30727ce06696736ae0fb49abd9fd79730`
- Manifest name: `MiniAppOnChainTarot`
- Relevant methods: `requestReading`, `initiateReading`, `settleReading`, `getReading`, `onOracleResult`
- Relevant events: `ReadingRequested`, `ReadingCompleted`, `ReadingRevealed`, `ReadingInitiated`
- Incompatibility: it does not expose the standalone client's deposit + `draw` + `ReadingDrawn` ABI.

### Hardened standalone deployment

- Script hash: `0xb680225a1be276b03ecd7de82ea985dcc7435cec`
- Manifest name: `MiniAppTarot`
- Relevant methods: `onNEP17Payment`, `draw`, `withdraw`, `getReading`, `creditOf`
- Relevant events: `Credited`, `ReadingDrawn`, `CreditWithdrawn`
- Security boundary: the deployed implementation uses Neo `Runtime.GetRandom` in the draw transaction. It is authoritative on-chain but is not an oracle/VRF result.

### Local replacement candidate (not deployed)

- Contract: `MiniAppTarotVrf`
- Flow: reusable GAS credit → `requestReading(player,maxOracleFee)` → Morpheus callback → terminal `getReading`
- Recovery: Oracle failure/timeout restores the complete reading fee to credit; `refundExpiredReading` is permissionless and `withdrawAllCredit` returns unused credit.
- HUD accounting: successful spreads use `playerCompletedReadingCount`; pending/refunded requests are not counted as cards drawn.
- Frontend: the dormant GameFi path now persists a pending reading, displays real sealed card backs while waiting, refreshes from `getReading`, and exposes timeout recovery as the primary action.
- Build receipt: NEF `940ad17df103c834db9224de38235496ce19d154b56b16c690ec8fd9f0fe36da`; manifest `da57e33613febe9c07a9de50d4724e77a7188c4d6b3aca7356980cfbfa15c016`.

## Published app behavior

- `supportsGameFi: false`
- Guest mode remains playable with secure local randomness.
- No wallet, payment, contract, or oracle permission is advertised.
- No production claim is made for either testnet deployment.

## Activation checklist

- [x] Replacement Oracle/VRF contract compiled and contract-tested.
- [ ] Testnet deployment hash verified through RPC.
- [ ] Registry, manifest, host catalog, and domain resolve to that same hash.
- [ ] Deposit/draw request is bound to the connected player and unique request id.
- [ ] Only an authenticated oracle callback can settle a pending reading.
- [ ] Settlement writes three unique card indices and emits a matching event.
- [ ] Client accepts success only after `verified === true` plus contract readback.
- [ ] Timeout/cancel/refund and unused-credit withdrawal are tested live.
- [ ] Mainnet remains disabled until the same gate passes independently.
