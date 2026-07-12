# Oracle NeoDID Console production status

Version: `2.1.0`

## Product result

- A bright Oracle workspace and foreground evidence pass now lead the experience; exact identifiers and catalog parameters live in the secondary drawer.
- The primary flow performs real same-origin resolver and provider-catalog GETs plus a read-only canonical Neo registry probe.
- Resolver return, registry deployment, catalog listing, runtime verifier metadata, and declared Oracle service remain distinct observations.
- Identity verification, claim attestation, signature verification, and Oracle dispatch are explicitly recorded as `not-performed` in every export.
- Results are SHA-256 digest checked, network isolated, short lived, recoverable after interrupted safe reads, and cleared before every retry or failure.
- Live results expire on the active surface, and copy performs an independent expiry gate.
- Storage availability requires write/delete readback; silent storage no-ops no longer produce a false recovery promise.
- Resolver and provider payloads use bounded structural decoding, and ambiguous provider aliases are rejected instead of silently selecting a record.
- Testnet `no-network-deployment` evidence is emitted only after RPC magic `894710606` is confirmed; an unexpected resolver anchor remains a mismatch.
- Runtime artwork lineage is documented in `ASSET_PROVENANCE.md`; the launcher/evidence-pass mark is now an app-specific, text-free identity inspection object rather than the old generic lettermark. Verified network boundaries are documented in `NETWORK_STATUS.md`.

## Verification evidence (2026-07-11)

- Focused config, logic, runtime-integration, and product-surface suite: **41/41 tests passed**.
- App TypeScript and scoped ESLint passed with no errors or warnings.
- Vite production build passed in 6.40 seconds and transformed 1,843 modules.
- Final app chunks: app JS `210.66 kB` raw / `63.38 kB` gzip; UI vendor `33.80 kB` / `11.99 kB`; app CSS `104.96 kB` / `19.21 kB`.
- Non-browser local HTTP returned `200` for all **18/18** requested routes (root plus 17 emitted files); all **9/9** public assets were byte-identical in `dist`.
- Non-browser live HTTP reconfirmed both resolver endpoints, 10 provider records per network, mainnet magic/hash/`NeoDIDRegistry`, and testnet magic `894710606`.

The accepted build is byte-identical to the host public MiniApp directory. The regenerated catalog remains **77/77** unique app IDs and slugs with one Oracle NeoDID Console entry at version `2.1.0`. The build reports upstream Dart Sass `@import` deprecation warnings from the shared Semi theme; they do not fail this app build and are outside this app-scoped change. No deployment, browser session, wallet, signature, or transaction was performed.
