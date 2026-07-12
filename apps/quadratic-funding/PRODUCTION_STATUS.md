# Quadratic Funding production status

Updated 2026-07-11. Live deployment state was rechecked through read-only RPC calls at `2026-07-11T06:48:30Z`. This is a MiniApp product-development status, not a cybersecurity report.

## Product experience

- The first surface is a bright public-goods funding desk built around a real scene asset, live rounds, project cards, donor breadth, available matching funds, and pledge controls.
- The platform cover and social preview use that same funding-desk scene instead of the stale generic banner that labelled the production-capable app as TestNet-only.
- Public round and project discovery no longer requires a wallet. Wallet connection is deferred until a production-approved transaction begins.
- Project missions appear on the primary cards and validated HTTP(S) project links remain reachable from the secondary ledger.
- Round creation, project registration, optional memo, matching top-up, finalization, claim, and cancellation stay in the secondary workspace and appear only when funding writes are available.
- Explore mode keeps all live reads useful. Its primary action refreshes funding data instead of presenting an inert disabled transaction button.
- Finalized rounds display their actual on-chain project allocations; active and ended rounds display the clearly labelled aggregate estimate.

## Transaction behavior

- Every supported write rechecks the current network, contract identity, pause state, wallet role, and live round/project state before signing.
- A write is successful only after the exact contract event and matching chain readback.
- Every consuming transaction broadcast is journaled for refresh recovery and blocks duplicate writes until resolved.
- A journal containing an unconsumed prepaid deposit cannot be manually discarded from the UI; the credit must be reclaimed first.
- The current configured TestNet and MainNet deployments remain in explore mode because they do not expose the recovery ABI required by the two-transaction prepaid asset flow.

## Matching model

The contract exposes project totals and wallet counts, not each donor amount or a unique-person credential. The preview therefore uses the aggregate equal-split estimate `(wallet count - 1) × total contributed`, allocates integer dust deterministically, and never presents the result as exact CLR or verified-human matching. The platform operator remains responsible for the final on-chain allocation.

## Oracle boundary

The current Quadratic Funding contract does not consume Morpheus VRF, TEE, or privacy-compute output. The app therefore does not display an Oracle-backed matching claim. A future private matching version should add a defined Oracle request, verifiable result binding, unique-person/eligibility policy, and contract-side acceptance rules before replacing the current operator-reviewed estimate.

## Release gates

Before transaction tools can be enabled for an exact deployment:

1. Deploy the recovery-capable contract source with a stable deployment fingerprint.
2. Record the prepaid deposit txid at broadcast time with durable cross-tab storage, then expose user-facing prepaid-credit reclaim, sponsor cancellation refund, contributor recovery, and unclaimed-match recovery flows.
3. Verify deposit, action, event, readback, cancellation, claim, and recovery scenarios on TestNet with distinct wallet roles.
4. Approve the exact `network:contract:fingerprint` only after those scenarios pass.

No deployment, update, wallet signature, or user key was used during this frontend production pass.
