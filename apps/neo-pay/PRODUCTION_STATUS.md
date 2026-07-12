# NeoPay production status

Version: `2.1.0`  
Verification date: 2026-07-11

## Product result

- The bright payment vault, amount console, recipient route, and release
  schedule now form one primary payment-stream desk instead of a generic form
  wall.
- Creating a payment stream remains the dominant action. A currently claimable
  stream is a compact secondary action; cancellation, notes, exact-day tuning,
  guidance, and verified creator/beneficiary history stay in the drawer.
- The interface uses the repository's real `payment-stream-desk.webp` artwork,
  shared official GAS/NEO `CoinArt`, and Lucide controls. The background stays
  quiet and warm so the product surface remains visually dominant.
- Fractional NEO is never changed into a different payment amount. It remains
  visibly invalid until corrected. GAS accepts at most eight decimals, and the
  amount stepper stays exact beyond JavaScript's safe-number range.
- The dependency-light Open UI adapters preserve native keyboard and label
  behavior while removing the former heavy Semi UI runtime from this app's
  focused controls.

## Business correctness and recovery

- Stream creation uses one atomic multi-script transaction: the selected
  official NEP-17 transfer is followed by `createStream`. A VM fault rolls the
  complete transaction back.
- GAS uses exact Fixed8 base units; NEO remains indivisible. Release rates and
  intervals are derived with `BigInt`, including the explicitly disclosed
  small-NEO cliff schedule.
- Every create, claim, and cancel result requires the exact application event
  and an authoritative `getStreamDetails` readback. A relayed transaction is
  pending, never success.
- Create confirmation checks every immutable stream field. Claim confirmation
  accepts only monotonic released totals, so a valid transaction is not trapped
  forever when the stream advances again before readback. Cancel confirmation
  requires the authoritative cancelled state and zero remaining amount.
- Transaction IDs are exact 32-byte Neo hashes. Pending records are bound to
  operation, wallet actor, network, canonical contract, stream or schedule,
  event, and transaction.
- The transaction journal must pass write, readback, delete, and delete-readback
  checks before any wallet action. A post-broadcast storage failure preserves
  the exact in-memory guard and exposes a repair action instead of allowing a
  duplicate payment.
- Create, claim, cancel, recovery, and journal repair share one operation lane.
  Exact duplicate calls join the same promise; conflicting actions stop before
  a second wallet prompt.
- Wallet, network, and canonical contract are checked again after asynchronous
  preflight. Creator and beneficiary lists use a wallet generation guard, so a
  late response from the previous account cannot overwrite the current view.
- Read-only views may use the launch network during a transient detection
  outage, but create, claim, cancel, and transaction recovery remain closed
  until the wallet network is positively detected.
- Parsed stream state rejects inconsistent active/completed accounting,
  cancelled rows with remaining or claimable value, and non-Boolean pause-state
  lookalikes rather than coercing a mismatched contract response.
- Role histories are paged in 100-ID windows, details are resolved in bounded
  batches of 20, and views above the 500-stream product cap are labelled
  partial instead of silently pretending to be complete.
- Recovery reads the indexed transaction log and current stream state. It never
  automatically replays a transfer, create, claim, or cancel operation.

## Verification evidence

- App logic and presentation helpers: 39/39 tests passed.
- Focused shared logic, integration, and product-surface suite: 33/33 tests
  passed.
- Four broader companion suites covering i18n parity, official-token use,
  stateful-manifest truth, and Open UI adapters: 108/108 passed.
- Scoped TypeScript and ESLint checks passed.
- Dedicated NeoPay frontend structure, manifest, documentation, and asset gate:
  1/1 passed. The standalone dApp support audit checked all 77 manifests with
  zero failures.
- Production build passed with 1,857 modules. App JS is 196.80 kB raw / 59.68
  kB gzip; CSS is 109.39 kB / 19.48 kB. The platform SDK is 119.21 kB / 39.47
  kB, React is 141.84 kB / 45.56 kB, the Lucide/UI chunk is 32.25 kB / 11.44
  kB, and the crypto chunk is 6.19 kB / 2.68 kB.
- Emitted asset chunks total 605,677 bytes raw / 178,303 bytes gzip. The
  production dist was synchronized to the host after all local gates passed.
- Static local HTTP verification returned 200 for all 15/15 emitted files.
- Mainnet and testnet contract name, eight required ABI methods, three
  confirmation events, pause state, total stream count, and latest stream Map
  were rechecked read-only. Details are in [NETWORK_STATUS.md](./NETWORK_STATUS.md).
- `payment-stream-desk.webp`, `banner.webp`, and `logo.webp` were inspected
  locally at source resolution for crop, contrast, consistency, and product
  relevance. Checksums and provenance limits are in
  [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).
- The host copy is byte-identical to the verified production dist. The catalog
  remains 77 entries with unique app IDs and slugs.

## External product boundaries

- No funded create, claim, or cancel transaction was submitted in this pass.
  Wallet-adapter prompts, signer-scope behavior, block-time vesting, and live
  post-transaction indexing still require a controlled funded testnet run.
- No deployment or contract update was performed. The frontend is bound to the
  existing mainnet and testnet deployments recorded in the manifest.
- Browser automation and rendered-page screenshots were intentionally excluded
  from this lane. Product structure is covered by DOM and source tests, while
  the three raster assets were inspected directly.
- AA scheduling, NeoDID verification, and TEE privacy processing are accurately
  marked unavailable; the current product is a direct-wallet on-chain stream
  desk.

No wallet signature, transaction broadcast, deployment, funded account, secret,
or git staging was used in this verification pass.
