# Neo Explorer Production Status

Status on 2026-07-12: **source-complete for the read-only Explorer miniapp; visual browser sign-off is not claimed in this non-browser task**.

## Product surface

- One search command bar leads the interface; real chain records replace the idle artwork.
- The release manifest does not create a duplicate host-side parameter form; the designed workspace remains the sole search surface.
- Transaction, block, address, and contract results expose their identifying fields, selected network, and source context.
- Network telemetry and recent transactions remain secondary and compact.
- Loading, invalid, not-found, unavailable, live, cached, and empty states are distinct.
- Complete raw records and source explanations stay in the detail drawer.

## Runtime behavior

- Mainnet and Testnet are both declared and supported.
- Search input mirrors the production API's identifier formats.
- Stats distinguish RPC block height from indexer transaction totals.
- Cached snapshots never become live merely because a fresh request failed.
- Late search responses cannot cross network/query generations.
- Recent-transaction network switches queue a new load when another request is already in flight.
- The app performs no wallet, signature, asset-transfer, or contract-write operation.

## Verification evidence

- Focused Explorer logic, PlayArea, integration, compatibility, and production-contract tests pass.
- Scoped Explorer English/Chinese message parity passes.
- TypeScript and ESLint pass without Explorer warnings.
- The host-app guard that rejects local Explorer chain-data mocks passes.
- The final production build emits 1,844 transformed modules. JavaScript totals 468,003 bytes raw / 148,389 bytes gzip; CSS totals 109,576 bytes raw / 19,403 bytes gzip.
- A clean local static server returned HTTP 200 with the expected MIME types for the document (`text/html`), entry JavaScript (`text/javascript`), stylesheet (`text/css`), banner and logo (`image/webp`), and manifest (`application/json`).
- Read-only API, Mainnet/Testnet RPC, block search, native-contract search, indexer-unavailable, recent-unavailable, and invalid-query paths were checked live on 2026-07-12; see [NETWORK_STATUS.md](./NETWORK_STATUS.md).
- Replacing the heavyweight Open UI adapters with the shared semantic `OpenUiLite` controls reduced transformed modules from 3,573 to 1,844. The UI vendor JavaScript fell from 108.79 kB to 33.21 kB and the separate 136.83 kB UI-vendor CSS output disappeared. Despite the richer real-record renderer, total built JavaScript fell by approximately 62.9 kB raw and total JavaScript plus CSS fell by approximately 194.7 kB raw.

## Contrast evidence

The scoped light theme keeps normal text and state colors above WCAG AA contrast against their actual surfaces: brand 6.62:1, accent 7.40:1, danger 5.98:1, warning 6.42:1, success 6.02:1, muted body text 6.88:1, and input placeholder 4.73:1.

## Remaining acceptance work

- Browser/IAB and Playwright were explicitly out of scope, so desktop/mobile screenshot comparison and interactive visual sign-off remain pending.
- A live transaction-detail record was not claimed because the production recent route returned `source: "unavailable"` and supplied no transaction hash during this pass. Block, contract, address-source, and invalid-query behavior were verified live.
