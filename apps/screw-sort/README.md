# Screw Sort

Screw Sort is a production-oriented Phaser 3 puzzle built for the Neo MiniApps platform. It is a complete local game: no wallet, GAS, contract, oracle, TEE, or chain write is required or advertised.

## Rules

1. Tap an exposed screw. Screws under a higher plank stay blocked until that plank is cleared.
2. A matching color case accepts the screw. Three screws fill the case and rotate that lane to its next color.
3. An unmatched screw moves into the overflow tray.
4. Five overflow sockets are safe. The **sixth unmatched screw** loses the run. This intentionally corrects the reference implementation's misleading “full 5 loses” label.
5. Clear every plank, empty the overflow tray, and complete every case queue to win.

## Controls and recovery

- Tap/click a screw: remove and sort it.
- `Ctrl/Cmd + Z`: undo, up to three times.
- `P` or `Space`: pause/resume.
- `R`: restart the current deterministic seed.
- New puzzle: create a fresh local seed after a finished run.

Progress, the compact move trace, and local best results are persisted under the app's namespaced storage. Restored in-progress sessions always reopen paused, so the game never continues behind the loading surface. Invalid or semantically impossible persisted state is rejected and replaced with a clean puzzle.

If device storage cannot be read or written, the puzzle stays playable in memory and reports that refresh recovery is unavailable instead of pretending progress was saved. Practice-leaderboard failure is also non-blocking and is reported separately from the local win.

The scene dispatches a selected screw immediately. It does not use a fixed-duration completion preview: screw flight, case completion feedback, terminal overlays, and input release start only after the pure engine publishes a newer authoritative revision and exact move outcome.

## Deterministic solvability

Each level is generated in three constructive phases. Four distinct active colors appear per phase; every case lane changes color between phases. Lower screws declare explicit upper-board blockers, while a replayable `solutionOrder` clears the phases safely. Unit tests replay 2,000 deterministic seeds on every run.

Persistence is validated by replaying the stored compact move trace from a clean generated level, then comparing removed screws, case queues, overflow order, move count, and terminal status. Shape-valid but impossible snapshots fail closed.

## GameFi boundary

Guest/local play is fully available. `supportsGameFi` is false, the published manifest has no contract, permissions, transaction capability, oracle, AA, or TEE claim, and runtime actions never call wallet or chain services. A reward lane must not be enabled until a deployed contract, funded pool, authoritative proof path, recovery behavior, and end-to-end testnet settlement are independently verified.

## Provenance

Gameplay was studied from `IcedSoul/minigame-everyday/day-01-screw` at commit `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`. Its README states MIT, but the audited checkout did not contain a root `LICENSE` file or per-asset provenance. No upstream binary asset or source file was copied. See [ATTRIBUTION.md](./ATTRIBUTION.md) and [REFERENCE_AUDIT.md](./REFERENCE_AUDIT.md).

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for the release checklist and [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the intentionally wallet-free runtime boundary.

## Build and verify

From `apps/screw-sort`:

```bash
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/eslint src test vite.config.ts vitest.config.ts
../../node_modules/.bin/vitest run --config vitest.config.ts
npm run build
```

Run the shared migration acceptance gate from the repository root:

```bash
cd apps/shared
npx vitest run test/minigame-everyday-migrations.production.test.ts
```

For manual testing:

```bash
npm run dev -- --port 5238
```

Verify at 390×844 and a short mobile viewport: visible four-case row, five-slot overflow tray, 48×52 logical screw hit targets, correct board occlusion, undo/pause/restart, loss on the sixth unmatched screw, win/new-puzzle flow, local refresh recovery, sound mute, reduced motion, and zero browser errors.
