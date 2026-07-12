# NFT Factory production status

Version: `1.2.0`

## Product result

- Artwork and the live collector card are the primary surface; collection
  configuration updates that object instead of presenting a flat deployment
  form.
- Discovery metadata classifies the product as NFT, while the app shell uses
  the existing bright social/artifact theme rather than generic tool chrome.
- Creators can preview a real local PNG, JPEG, WebP or AVIF file. The interface
  clearly states that the object URL is local-only and is not uploaded, pinned
  or included in the deterministic package. When token #1 supplies an HTTPS
  image and no local override is active, that verified collector-facing image
  becomes the live card source.
- Exact network, metadata origin and owner controls are contained in the
  secondary provenance drawer.
- Package signing is enabled only after token #1 metadata, the testnet Factory
  template, canonical contract/call payload, connected owner and network are
  verified. The wallet message binds the exact network, Factory contract,
  template, package id, digest and canonical payload shown in the export. A
  completed commitment is one-shot and cannot reopen a second wallet prompt;
  concurrent clicks also collapse to one request. If the wallet, network, or
  locked package changes while the prompt is open, the returned signature is
  discarded instead of being attached to a different package.
  A failed metadata/template read remains unavailable and never becomes a
  signable/deployable success or a misleading zero.
- Deployment stays hidden/locked because the deployed Factory ABI lacks
  `deployArtifactFromTemplate` and the registered NEP-11 template has no
  artifact. No write permission or transaction claim is published.
- Dated chain facts are in `NETWORK_STATUS.md`; generated visual provenance and
  hashes are in `ASSET_PROVENANCE.md`. The older filenames remain compatibility
  records only.

## Verification evidence (2026-07-12)

- Focused metadata/setup/surface/runtime/plan suite: 65/65 tests passed across
  eight files.
- TypeScript and ESLint passed for the app and directly affected shared Factory
  files/tests.
- Dedicated NFT Factory frontend structure gate passed.
- Production build: 1,885 modules transformed in 4.17 seconds; app entry
  270.22 kB (81.25 kB gzip), with React, UI, platform SDK and crypto separated
  into vendor chunks.
- Static HTTP smoke: every one of the 13 emitted files returned HTTP 200; active
  launcher/studio rasters are byte-identical between `public/` and `dist/`.
- Host synchronization was intentionally not performed in this app-scoped
  lane. The host still contains the preceding v1.2.0 bundle and must be updated
  by the parent integration pass after review.
- The current catalog contains exactly one `miniapp-nft-factory` entry at
  version `1.2.0` with the canonical testnet contract.
- Git index remained empty; no files were staged or committed.
