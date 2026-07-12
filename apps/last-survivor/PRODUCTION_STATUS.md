# Last Survivor production status

Version: `2.2.0`

## Product result

- The shipping entry is a bright Phaser 3 last-seat duel, not a wallet form. The arena, countdown, active leader, key packs, rival takeover, clutch bonus, win/loss result, restart, sound, motion, touch, pointer, and keyboard controls form the primary experience.
- Free play is local-only and never opens a wallet or submits a chain action. New paid rounds remain hidden until this exact frontend build completes a current wallet/browser acceptance pass.
- Secondary GameFi state stays behind the game surface. Unavailable round, quote, credit, key, history, or wallet-balance reads are distinct from authoritative zero values.
- Runtime artwork uses the warm arena and official shared token art. Foreground information sits on opaque, high-contrast surfaces, and reduced-motion behavior is implemented.

## GameFi correctness and recovery

- Every write is bound to the exact wallet, launch network, configured contract, action, amount, and round before the wallet is opened.
- Recovery storage must pass a write/read/delete round trip before a new broadcast. After a wallet returns a transaction id, the exact pending record is also retained in session memory before the durable write is attempted, so a storage failure cannot turn a broadcast into an apparent invitation to submit again.
- A pending transaction blocks duplicate writes. The recovery action only checks the existing transaction; it never replays the wallet action.
- Success requires the expected event from the bound contract and an authoritative contract readback. The transaction outcome reader distinguishes indexing delay, `HALT` with a missing event, and a proven VM `FAULT`; none is converted into success.
- Wallet GAS is loaded through an explicit read with its own availability state. A failed read is shown as unavailable, never as `0.00 GAS`.

## Local verification

- App production suite: `50/50` tests passed.
- Focused shared Last Survivor suites: `37/37` tests passed.
- Frontend structure gates: `3/3` passed.
- TypeScript no-emit, scoped ESLint, production build, and scoped diff checks passed.
- Production build: Vite transformed `1863` modules; the app entry is `242.99 kB` / `74.83 kB` gzip, the Phaser scene is `24.02 kB` / `7.30 kB` gzip, and the shared Phaser/audio chunk is `331.28 kB` gzip.
- Static delivery: all `21/21` emitted HTML, manifest, JavaScript, CSS, and image files returned HTTP `200` with appropriate MIME types.
- The arena, logo, banner, and legacy scene raster were inspected locally for brightness, crop, and foreground suitability. A rendered browser/device comparison was not performed in this scoped pass and is not inferred from the build.

## Release boundary

The verified TestNet contract generation and remaining paid activation matrix are documented in [TESTNET-STATUS.md](./TESTNET-STATUS.md). This frontend pass did not deploy a contract, sign a wallet request, submit a funded transaction, or use the supplied funded account. Paid GameFi entry remains disabled until that matrix is recorded against this exact build.

