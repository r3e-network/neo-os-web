# Gas Lucky Pool production status

Last read-only verification: 2026-07-11 (Neo N3 mainnet and testnet).

## Legacy bindings removed from the active manifest

The active guest-only manifest now publishes an empty `contracts` map. The
legacy mappings removed from the active binding were:

| Network | Contract | Deployed name | NEF checksum | Update counter | GAS balance |
| --- | --- | --- | --- | --- | --- |
| Testnet | `0xfa1b7240fead2a63999c02defa3aec5eb274a919` | `MiniAppRedEnvelope` | `2198091396` | `2` | `14.79904177` |
| Mainnet | `0x5f371cc50116bb13d79554d96ccdd6e246cd5d59` | `MiniAppRedEnvelope` | `3202691422` | `3` | `0.87196114` |

Both deployments expose standalone red-envelope methods and events. Neither
exposes `getRangeGasPool`, `createRangeGasPool`, `claimRangeGasPool`,
`fundRangeGasPool`, `refundRangeGasPool`, or the direct-credit ABI consumed by
this app.

The reviewed local artifact is `contracts/build/PlatformSocial.nef`, checksum
`1654231107`, with contract name `PlatformSocial` and the required RangeGasPool
and credit methods. It is not the artifact deployed at either published app
address. The app therefore cannot establish an ABI or bytecode compatibility
proof for a paid lane.

Read-only state scanning found legacy liabilities that must be migrated rather
than reused:

- testnet has 238 expired envelopes with `13.69904177 GAS` remaining, including
  10 envelopes that never became ready, plus about `1.1 GAS` outside public
  envelope remaining totals;
- mainnet has 10 expired envelopes with `0.67196114 GAS` remaining, including
  3 envelopes that never became ready, plus about `0.2 GAS` outside public
  envelope remaining totals;
- both contracts are unpaused, have a zero automation anchor, and expose no
  public user refund/reclaim or direct-credit withdrawal path.

The historical sources matching those deployed checksums pre-generate packet
amounts, expose them through `getPacketAmount`, delete callback mappings before
validating callback success/result, and can leave failed requests permanently
not ready. These are recovery and fairness blockers, not a compatible fallback.

## Why GameFi remains disabled

The current PlatformSocial range-pool implementation also draws inside the
claim transaction with `Runtime.GetRandom`. It is not a proof-carrying Oracle
VRF flow and remains vulnerable to selective abort/retry across blocks. The
frontend's legacy paid path treats matching events or backend `paid` responses
as success before an exact application-log and canonical state readback, and it
does not durably persist transaction intents for reload recovery.

The separate OneGate server-claim lane also remains disabled. Its current payout
log verifier checks GAS/Transfer, recipient, amount, HALT, and return value, but
does not bind the transfer source to the campaign reward source or an authorised
signer. A documented mainnet validation transaction
`0x299ecd4abe0c98ad6f9ed8168e8ef917885404e7d21160d7f5419fe5de5c8466`
is a `44.26874529 GAS` self-transfer (`from == to`) yet was accepted as a payout.

Gas Lucky Pool therefore ships only the stakes-free Phaser lane:

- `supportsGameFi`, payments, randomness, oracle, operation-panel writes, and
  platform transactions are disabled in both manifests;
- independent local-play, OneGate server-claim, and RangePool on-chain flags
  prevent one lane from implicitly enabling another; both paid flags and the
  composable gates default to disabled before wallet discovery, chain calls, or
  OneGate backend calls;
- Guest draws use Web Crypto only and fail closed when secure randomness is not
  available;
- a local animation, score, event, or submitted transaction never confirms a
  GameFi payout.

## Paid-lane activation gate

Before GameFi can be re-enabled:

1. Deploy a reviewed RangeGasPool v2 artifact to the intended network and bind
   its exact hash, NEF checksum, ABI fingerprint, version, and update counter.
2. Replace same-transaction randomness with an Oracle VRF or a non-cancellable
   request/settle protocol that produces a verifiable result after commitment.
3. Persist each create, claim, fund, refund, and credit-withdraw intent by
   network, contract, account, operation, parameters, and txid before broadcast.
4. Query the transaction application log and distinguish `HALT`, `FAULT`, and
   not-yet-mined states. Never automatically replay an ambiguous financial
   operation.
5. Confirm the exact event envelope and canonical contract readback: app id,
   pool id, actor, Fixed8 amount, claim bounds, remaining amount, claim count,
   completion/refund state, and GAS transfer.
6. Add idempotency keys for pool creation and funding so recovery cannot create
   or charge twice.
7. Run an explicitly authorised testnet sequence covering deposit/credit,
   create, multiple claims, final remainder, top-up, expiry/refund, failed
   transaction recovery, reload/cross-device recovery, and credit withdrawal.
8. Bind OneGate payout proof to the exact campaign reward source and authorised
   signer; reject self-transfers and source/recipient identity collisions.
9. Migrate or explicitly settle the expired legacy envelope and credit
   liabilities before retiring the old addresses.
10. Re-enable source, runtime, published manifest, host operations, payments,
   randomness, and transaction capability together only after every gate passes.

No transaction, deployment, contract update, or key access was performed during
this verification.
