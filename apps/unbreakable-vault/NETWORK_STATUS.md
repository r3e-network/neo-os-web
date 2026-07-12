# Unbreakable Vault network status

Last read-only network evidence: 2026-07-11  
Current product verification: 2026-07-12

No live network request, wallet connection, signature, funded transaction, or
contract deployment was performed during the current product-development pass.
The deployment facts below preserve the prior read-only ABI/RPC evidence from
`TESTNET_STATUS.md`; they were not refreshed on 2026-07-12.

## Supported deployments

| Network | Canonical contract | Product mode |
|---|---|---|
| Neo N3 testnet | `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0` | Direct GAS prepay followed by the contract action |
| Neo N3 mainnet | `0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa` | Read-only until PaymentHub is configured |

The app rejects a launch/wallet-network mismatch, a non-canonical contract, a
paused contract, and an unavailable mainnet PaymentHub before requesting a new
wallet transaction. Reads remain distinct from writes: an unavailable or
incomplete vault catalog retains the last verified list and surfaces an error;
a verified `totalVaults = 0` remains a genuine empty list.

## Contract-backed game rules

- `createVault`: escrow at least 1 GAS behind a locally computed SHA-256 digest.
- `attemptBreak`: pay the contract-defined 0.1 / 0.5 / 1 GAS attempt fee for
  Easy / Medium / Hard; failed attempts grow the escrow.
- `increaseBounty`: add GAS to an active vault.
- `claimExpiredVault`: creator reclaims an unbroken expired vault.
- Confirming events: `VaultCreated`, `AttemptMade`, `BountyIncreased`, and
  `VaultExpired`.
- Winner and creator-expiry settlements are 98% after the 200 bps protocol fee,
  according to the preserved 2026-07-11 read/simulation evidence.

This contract is a deterministic hash-lock bounty product. It does not expose a
VRF, privacy-compute, or oracle method in its reviewed ABI, so the miniapp does
not invent an oracle result or claim confidential execution. The plaintext
creation secret stays in component memory only; the chain receives its digest.

## Transaction recovery boundary

Testnet payment and business action are separate broadcasts. The UI stores an
exact wallet/network/contract/operation journal and blocks all other writes
until it is resolved. If only payment was broadcast, recovery validates the
exact HALT GAS transfer and resumes the action without paying again. If an
action txid exists, recovery only checks that transaction; it never replays the
action. A post-broadcast storage failure keeps the exact in-memory journal and
requires durable readback restoration before network recovery continues.

Success requires the exact contract event plus authoritative
`getVaultDetails` readback. VM `FAULT`, unavailable application logs, missing
events, contradictory state, and incomplete txids remain faulted, pending, or
blocked rather than becoming a success or zero-value state.

## External verification still required

- Browser/device-emulation review of the real host wallet surface.
- A funded Neo N3 testnet matrix for create, failed attempt, successful break,
  top-up, expiry reclaim, wallet rejection, delayed indexing, and VM `FAULT`.
- Confirmation that mainnet PaymentHub is configured before enabling mainnet
  writes.
- The contract has no public per-payer/per-memo credit getter. Payment-stage
  recovery therefore validates the transfer and then relies on the contract's
  memo-specific credit bucket when the user signs the resumed business action.
