# Sudoku Arena testnet status

Read-only verification on 2026-07-11 against `https://api.n3index.dev/testnet`.
No transaction was signed or broadcast.

## Published mode

- The production miniapp publishes the complete local Phaser 3 game only.
- `gamePage.modes.gamefi` is `false`, transaction/oracle/compute permissions are off,
  and the public operation panel is empty.
- New paid entries remain fail-closed in code through
  `GAMEFI_NEW_ENTRIES_ENABLED = false`.

## Deployed historical contract

- Script hash: `0xd4ba00fb7297d08d563d8c281541dbb22725dad1`
- Name: `MiniAppSudoku`
- Live NEF checksum: `1847762914`
- Local `contracts/build/MiniAppSudoku.nef` checksum: `1847762914`
- Network magic: `894710606`
- Oracle: `0x4b882e94ed766807c4fd728768f972e13008ad52`
- Client/runtime engine hash:
  `679aea4220667dec0e921eb364392f7983dae440a3aa9e43a215a4d054ab58c8`
- Live ABI includes the expected start/finalize/callback/expiry/withdraw/read methods
  and matches the locally built manifest.

The client engine hash matches the current workspace Morpheus Sudoku wrapper
source and operator registry. The runtime deterministic-engine suite passes its
Sudoku deal and difficulty vectors; the platform contract suite passes all 24 scoped
Sudoku contract/integration tests.

## Live state

- `isPaused`: `false`
- `poolBalance`: `0`
- `reservedPool`: `0`
- `freePool`: `0`
- `lastGameId`: `0`

The matching artifact and canonical oracle reference are necessary but not
sufficient production evidence. With no funded pool and no completed live game,
the paid start -> TEE deal -> operation log -> callback settlement -> readback ->
withdraw path is not published. The dormant client path preserves strict
identity/readback/pending/recovery checks for a future certified release.
