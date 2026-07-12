# Gas Sponsor production status

Version: `2.0.0`

Product direction:

- Contract-backed community sponsorship pools replace the non-functional platform-faucet UI.
- Public browsing is wallet-free.
- The pool, remaining GAS and expiry are the primary visual hierarchy.
- Exact parameters and sponsor lifecycle controls are secondary.
- Every broadcast transaction remains pending until its required event/receipt and authoritative pool readback agree.
- Prepaid create/top-up flows persist payment and target phases separately to avoid duplicate transfers during recovery.

Verification evidence (2026-07-11):

- Scoped Vitest suites: `25/25` passed across chain logic, PlayArea product behavior and framework integration.
- TypeScript: `npx tsc -p apps/gas-sponsor/tsconfig.json --noEmit` passed.
- ESLint: app source plus all Gas Sponsor scoped tests passed.
- Locale parity: the Gas Sponsor target in `i18n-key-parity.test.ts` passed.
- Production build: Vite `7.3.2`, `1853` modules transformed, completed in `3.73s`.
- Main app bundle after shared UI-vendor splitting: `228.75 kB` (`67.94 kB` gzip), down from `259.43 kB` (`79.12 kB` gzip).
- App stylesheet: `107.09 kB` (`19.42 kB` gzip).
- HTTP smoke: entry HTML, every emitted JS/CSS asset, scene artwork, logo, banner and manifest returned `200` from the production preview server.
- Source manifest and emitted manifest SHA-256: `7faa31f4fce7af2a709105bc1d7d9792e86952aca34b4b2383c81fd7719ad292`.
- Source artwork and emitted artwork SHA-256: `0f1e987c51923a254e1ef914e32f62a793cbbfda221ac5536b3eb071a1580f16`.
- Dist-to-host copy: `16/16` files, byte-identical (`diff -qr` clean).
- Host catalog: `77` total entries and exactly one `miniapp-gas-sponsor` entry at version `2.0.0`.
- Host catalog, source manifest, emitted manifest and legacy definition agree on the dual-network contract mapping.
- Git index remained empty. No wallet signature, transaction or contract deployment was performed.

The HTTP check is an artifact/runtime smoke test, not a visual browser claim. Visual interaction review remains a separate chosen-browser pass.
