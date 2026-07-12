# Neo Swap production status

Version: `1.2.0`

Product boundary:

- Neo Swap is a focused NEO/GAS oracle quote and trade-planning application.
- The live product journey is asset selection → timestamped quote → exact output → slippage floor → optional wallet balance review.
- The warm route artwork and official NEO/GAS `CoinArt` establish asset identity without embedding controls or token marks in a screenshot.
- Public quotes do not require a wallet. Wallet connection is optional and uses exact raw NEP-17 balances.
- No production swap router is deployed. Settlement stays disabled, price impact stays unavailable, and no simulated or broadcast-only action can become a success state.
- A future settlement route remains fail-closed behind an exact network/hash/ABI binding and a route-specific event validator that must bind the wallet, pair and integer amount intent.

Verification evidence (2026-07-12):

- Focused logic, PlayArea, integration and production-boundary suites: `62/62` passed.
- Neo Swap locale parity: `1/1` passed; official-token asset guard: `5/5` passed.
- Neo Swap deploy structure/rate-source gates: `2/2` passed.
- TypeScript and scoped ESLint passed.
- dApp verifier: `77` MiniApps checked, `0` failures.
- Production build: Vite `7.3.2`, `3585` modules transformed, completed in `21.55s` under concurrent workspace load.
- Main app bundle: `210.08 kB` (`64.07 kB` gzip).
- App stylesheet: `108.71 kB` (`19.37 kB` gzip).
- Static preview: all `18/18` emitted files returned HTTP `200` with expected MIME families.
- Public source-to-dist assets: `9/9` byte-identical; source and emitted manifest are byte-identical.
- Manifest SHA-256: `165ae722c5936c3aae331a1e127ab9830c6e289e120a54f10fd93294cae5fac6`.
- The build emits only the existing Semi UI Sass `@import` deprecation notices; it has no compile error.

Operational boundary:

- `platform/host-app/public/miniapps/neo-swap` was not synchronized in this work lane.
- No wallet signature, deployment, approval, funded transaction, Git staging or commit was performed.
- Browser/Playwright capture was intentionally not run. Local route/logo/banner assets were inspected directly, while responsive and wallet interaction acceptance remains a later chosen-browser pass.
- A fleet-wide locale run was not claimed as green: a concurrent `neo-x-bridge` change currently has 13 missing locale keys, outside the Neo Swap scope.
