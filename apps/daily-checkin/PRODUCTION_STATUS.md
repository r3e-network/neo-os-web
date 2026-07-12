# Daily Check-in production status

Version: `2.1.0`

## Product result

- The first screen is a warm streak plaza with a focused seven-day chapter,
  live UTC window, GAS milestone and one context-sensitive primary action.
- Activity history, reward-pool detail and technical confirmation evidence stay
  in three secondary drawer panels; the host renders no duplicate operation
  form.
- Mainnet and testnet reads are pinned to the canonical deployed contract.
  Failed or inconsistent reads remain unavailable/partial instead of becoming
  zero streaks or empty rewards.
- Wallet prompt and broadcast are pending states. Success requires exact
  check-in/claim and GAS transfer events plus authoritative contract readback;
  ambiguous writes remain durable and recoverable.
- Live fee and milestone values come from contract state. The interface does not
  invent rewards beyond the configured day-7 and day-14 milestones.
- Runtime art and official GAS-token usage are documented in
  `ASSET_PROVENANCE.md`; dated read-only deployment facts are documented in
  `NETWORK_STATUS.md`.

## Verification evidence (2026-07-11)

- App safety/solvency: 12/12 tests passed.
- Shared logic, integration, product-surface and publication truth: 21/21 tests
  passed.
- TypeScript and ESLint passed for the app and its focused shared tests.
- Manifest/package validation: both report `2.1.0`; generic operation forms are
  disabled.
- Production build: 3,582 modules transformed in 3.92 seconds. The app entry is
  212.52 kB (64.84 kB gzip); React, UI, platform SDK and crypto are separated
  into vendor chunks.
- The drawer now uses the dependency-light shared Open UI adapters, reducing
  its UI JavaScript chunk from 185.21 kB to 31.74 kB without changing the
  rendered design-system contract.

- HTTP smoke: every one of the 17 emitted production files returned HTTP 200;
  active launcher and streak-plaza rasters are byte-identical between `public/`
  and `dist/`.
- Dist-to-host copy: all 17 files are byte-identical in the host miniapp
  directory.
- Catalog: 77 entries, 77 unique IDs, exactly one `daily-checkin` entry at
  version `2.1.0`.
- Git index remained empty; no files were staged or committed.
