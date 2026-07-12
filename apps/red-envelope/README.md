# Red Envelope

Red Envelope is a Neo N3 lucky-packet social app with a bright Phaser opening experience. A creator locks GAS into 1–100 packets, shares the envelope ID/link, and each wallet may claim once. Unclaimed GAS is reclaimable by the creator after expiry.

The link is a **public bearer link**, not private access control: any wallet that
learns or guesses the network-bound envelope ID may claim once while packets
remain. The app never publishes a global "latest envelopes" list. A private or
recipient allow-listed product requires a new contract.

## Current product flow

1. Choose one of the designed low-stakes packet bundles on the Phaser table.
2. Connect a wallet as a separate gesture.
3. Create the envelope. The app deposits only the missing GAS credit, confirms it, then creates the exact envelope.
4. Share the generated network-bound envelope link.
5. Each connected wallet opens one random packet. The celebration and amount card appear only after the exact claim transaction is confirmed.
6. After expiry, the creator may reclaim the exact unclaimed remainder. Unused create credit can be withdrawn at any time.

There is one lucky-split mode. The deployed contract does not implement blessing text, equal splits, NEO-holding gates, automatic refunds, or a 5% best-luck bonus; the UI and documentation must not promise those features.

## Randomness and limits

The contract uses Neo `Runtime.GetRandom()` at claim time with a double-average cap and a one-base-unit reservation for every remaining packet. This is not oracle/VRF-grade randomness: a sophisticated claimer may abort and retry across blocks to bias their own result toward the cap.

The v1.1 contract therefore enforces a low-stakes boundary:

- maximum 20 GAS per envelope;
- maximum 100 packets;
- duration from 60 seconds to 7 days;
- each non-final share is bounded near twice the running average;
- all shares plus creator reclaim equal the funded total.

Use a VRF/commit-reveal product for high-value fair lotteries. Red Envelope deliberately optimizes a one-tap social gift flow within the limits above.

## Public ABI

| Method | Purpose |
| --- | --- |
| `createEnvelope(creator,total,packets,duration)` | Consume prepaid credit and create a funded lucky envelope |
| `claim(envelopeId,claimer)` | Claim once and receive one random share atomically |
| `reclaim(envelopeId,creator)` | Return the unclaimed remainder after expiry |
| `withdraw(account)` | Withdraw unused create credit |
| `getEnvelope(id)` | Read exact envelope status and best-luck state |
| `creatorEnvelopeCount` / `getCreatorEnvelopes` | Paginated creator index |
| `claimerEnvelopeCount` / `getClaimerEnvelopes` | Paginated claimer index |
| `claimedAmount` / `hasClaimed` | Exact wallet claim state |

## Deployments

| Network | Contract | Status |
| --- | --- | --- |
| Neo N3 TestNet | `0x5a5ecc80cd5225acd7431a5dd6f0e32bb9260a87` | v1.1 bounded contract; two-wallet live flow verified 2026-07-10 |
| Neo N3 MainNet | `0x363c5de9760d1aaaed5096fdf3bdc877cd0368e9` | Legacy unbounded contract; new creation is gated, existing claim/reclaim/withdraw remains available |

The canonical mapping is [`neo-manifest.json`](./neo-manifest.json).
At runtime the app also verifies the network, script hash, deployed NEF
checksum, contract version, and required ABI before enabling a paid action. A
failed or unreachable attestation keeps the action disabled.

## Development

```bash
cd apps/red-envelope
npm test
npm run build
npm run dev
```

Guest mode is a local packet-opening game and never invokes wallet, contract, oracle, or reward writes.
