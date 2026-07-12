# Oracle Price Console production status

Version: `1.1.0`

Product direction:

- A resource-led oracle market board replaces the generic request form.
- Pair selection, official token artwork, price, source and freshness are the visible hierarchy.
- Contract and request-path details stay in the secondary drawer.
- Public reads require no wallet and never mutate chain state.
- Network-specific Morpheus DataFeed dependencies are now declared in the public manifest; no static mainnet-only `stateSource` can misdescribe a testnet launch.
- The stale OP lettermark and Testnet-only launcher banner are no longer active; the app uses a generated text-free price-oracle mark and the real warm market stage.

Verification evidence (2026-07-11):

- Freshness, exact-price, launch-context, catalog-normalization, route-binding, PlayArea and integration suites: `34` passed across `3` files.
- TypeScript and ESLint passed.
- Production build: Vite `7.3.2`, `3580` modules transformed, completed in `13.32s` while other workspace lanes were active.
- Main app bundle: `188.73 kB` (`57.41 kB` gzip); app stylesheet: `101.57 kB` (`18.23 kB` gzip).
- Shared chunks: platform SDK `93.79 kB` (`30.37 kB` gzip), React `142.41 kB` (`45.79 kB` gzip), UI JavaScript `183.67 kB` (`59.04 kB` gzip), UI CSS `136.83 kB` (`14.82 kB` gzip), noble crypto `6.19 kB` (`2.68 kB` gzip).
- HTTP smoke: all `17/17` emitted files returned `200` and matched their local bytes, including entry HTML, every JS/CSS chunk, market artwork, launcher assets and manifest.
- Source-to-dist public/manifest check: `9/9` pairs byte-identical.
- Source and emitted manifest SHA-256: `6a9b48814817f19ccb0160f15da495dd3d225e2fbf15bf06b03fa25164e60a6a`.
- Repository MiniApp dApp verifier: `77/77` entries checked with `0` failures.
- The exact deployed Morpheus contract is asserted in the route-binding test; reads attempt `AGG:<ASSET>-USD` first and expose the resolved key when the provider fallback is used.
- Six-decimal price parsing rejects strings, non-finite values, unsafe values and values that cannot map back to the contract's integer scale.
- Pair and request generations prevent stale catalog or quote responses from taking ownership after a newer selection or teardown.
- Launch-context normalization accepts exact aggregate/provider USD keys but refuses to relabel non-USD pairs.
- The bright market stage, launcher banner and launcher logo were inspected locally at source resolution. The active market frame isolates the clean warm texture; official NEO/GAS identity remains shared `CoinArt`.
- Parent release synchronization copied the final dist byte-for-byte into the host and regenerated a valid `77/77` catalog with unique app IDs/slugs and Oracle Price Console `1.1.0`.
- No wallet signature, transaction, contract deployment or Git staging was performed.

Visual interaction review remains a separate chosen-browser pass; this lane does not claim browser screenshot acceptance.
