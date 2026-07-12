# Neo X Bridge production status

Version: `1.2.0`

Product boundary:

- Neo X Bridge is a bright, route-first GAS/NEO wallet-readiness, handoff, and source-receipt companion for the official Neo bridge.
- It does not construct, approve, sign, or submit bridge transactions and never guesses destination-chain delivery.
- A local ticket binds environment, direction, N3 magic, Neo X chain ID, asset precision, source account, amount, destination account, request identity, and expiry.
- Launch parameters configure the workspace only. Wallet account/network readiness is attested separately on connection and rechecked before ticket preparation.
- Live limits, quotas, bridge/network fees, approval requirements, quote expiry, signing, and submission remain authoritative on the official bridge.

Verification evidence (2026-07-12):

- Bridge console suite: `29/29` passed.
- Shared PlayArea and integration suites: `13/13` passed.
- TypeScript and ESLint passed with zero warnings.
- Production build: Vite `7.3.2`, `1845` modules transformed, completed in `5.38s`.
- Main app bundle: `227.78 kB` (`68.50 kB` gzip).
- App stylesheet: `108.92 kB` (`20.08 kB` gzip).
- Static preview: `15/15` emitted files returned HTTP 200 and were byte-identical to local dist files.
- Public/manifest source-to-dist check: `8/8` byte-identical.
- Source and emitted manifest SHA-256: `d25500287617bdcb3fa358d91bce1e63c8b23024cbbb2c96796015c93a6718df`.
- Global dApp verifier: `77` checked, `0` failures.
- Live network checks passed for Neo N3 MainNet/TestNet magic, Neo X MainNet/TestNet chain IDs, both official bridge URLs, the bridge indexer, and the official asset guide.
- Local generated logo, banner, and route artwork were inspected directly; they contain no text, fake token marks, fake UI, or dark visual treatment.
- Build emitted upstream Sass `@import` deprecation warnings from the shared Semi theme; no app-owned compile error or warning was produced.

Host boundary:

- The host was intentionally not synchronized in this lane.
- The host catalog remains at `neo-x-bridge` version `1.1.0`; local dist/manifest are version `1.2.0` and correctly differ from the existing host copy.
- Git index is empty. No deployment, wallet signature, funded transaction, contract write, Git staging, or commit was performed.

Remaining operational boundary:

- Real-wallet prompts, account/network switching, exact provider behavior, live official quote/limit/approval presentation, and a full source-to-destination bridge lifecycle still require a separately authorized wallet-enabled MainNet/TestNet run.
- Browser/Playwright/screenshot verification was explicitly out of scope for this lane. The completed checks are code, local-image, build, static-HTTP, RPC identity, and test evidence only.
