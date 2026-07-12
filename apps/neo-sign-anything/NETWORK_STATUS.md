# Neo Signature Desk network status

Reviewed: 2026-07-12

## Runtime boundary

- There is no miniapp contract, oracle request, RPC read, transaction, token
  transfer, GAS payment, or deployment path.
- The only chain-facing operations are wallet connection, explicit Neo N3
  network detection, and the wallet provider's message-signing interface.
- `neo-manifest.json` declares MainNet and TestNet support and the single
  `wallet:sign-message` permission; `platform.transactions` is `false` and
  `contracts` is empty.
- Bound-envelope payloads include the normalized network and account in the
  bytes sent to the signing adapter. Exact-text mode deliberately does not and
  labels them only as observed request context.

## Deterministic validation completed

- MainNet/TestNet identifiers, network-change review, ambiguous-network failure,
  wallet-change invalidation, provider-reported signer matching, signature
  normalization, and stale response rejection are covered by focused tests.
- No live wallet prompt was opened in this lane. A real signature is a user
  authorization event and must not be replaced by a mock success claim.

## Live compatibility matrix still required

For each supported wallet on MainNet and TestNet, record:

1. connected address and normalized network;
2. exact payload displayed before approval;
3. provider response fields (`signature`/`data`, public key, reported account);
4. whether the wallet display preserves the intended UTF-8 message semantics;
5. exported artifact and an independent verifier result using that wallet's
   documented message-signing convention.

This matrix is the remaining network release evidence; it does not require a
contract deployment or a funded transaction.
