# `day-01-screw` reference audit

Reference: `IcedSoul/minigame-everyday/day-01-screw` at `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`.

## Useful rules retained

- Four visible color cases.
- Three screws complete a case.
- Five unmatched screws can wait in overflow; the sixth unmatched screw loses.
- Higher boards block screws on lower boards.
- Completing a case rotates it to a later color and pulls matching overflow screws into the case.

## Defects not migrated

1. The advertised web entry was blank: `index.html` loaded `js/main.js`, but only `game.js` instantiated `Main`.
2. The label said that a full five-slot tray loses, while the implementation actually allowed five and failed on the sixth click.
3. The case sequence was shuffled independently from accessible screw colors. There was no solver, rejection pass, or constructive proof that a generated seed could be completed.
4. Screw reservations happened only after the flight tween completed. Rapid taps could target the same case socket and overfill a case.
5. All screws rendered in one layer above all boards. A disabled lower screw could visibly float over the board that was supposed to cover it.
6. The 720×1280 logical surface produced tiny touch targets and horizontal/vertical overflow at a 390×844 viewport.
7. Progress was not recovered, pause/undo were absent, blocked taps had no useful feedback, and motion did not honor reduced-motion preferences.

## Replacement guarantees

- Every seed is constructed in three solvable phases and carries a replayable solution order. The test suite verifies 2,000 deterministic seeds per run.
- Each screw is routed through its intended case lane first, eliminating ambiguous duplicate-color races during case rotation.
- State changes are synchronous and immutable before presentation tweens, preventing double-tap overfill.
- The Phaser scene dispatches immediately and presents motion only after a newer authoritative engine revision; there is no timer-based success preview.
- Each board owns its screws in the same Phaser display container and depth order, so upper board art naturally covers lower screws.
- Touch hit areas are at least 48×52 logical pixels. Guest state persists locally with validation, bounded undo, pause, restart, and corrupt-state recovery.
- No wallet or chain action exists. GameFi is explicitly disabled until a real contract and verified settlement path exist.
