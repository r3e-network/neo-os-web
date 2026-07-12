# Arrow Escape design QA

## Result

PASSED — inspected in the real browser at `390 × 844` and compared in one
contact sheet against the audited Day 03 reference and the generated visual
direction.

## Evidence

- Reference: `/tmp/minigame-day03-arrow-reference-390x844.png`
- Design direction: `/Users/jinghuiliao/.codex/generated_images/019f4b9f-157a-73d0-942d-e96920706a8d/exec-25d1729d-25a8-4f63-98f6-0ee208eb5c40.png`
- Final mobile implementation: `/tmp/arrow-escape-qa/01-final-mobile-390x844.png`
- Combined comparison: `/tmp/arrow-escape-qa/04-reference-concept-implementation.png`
- Zoom state: `/tmp/arrow-escape-qa/02-zoom-110-mobile-390x844.png`
- Pause/refresh recovery: `/tmp/arrow-escape-qa/03-pause-refresh-recovery-390x844.png`
- Blocked strike: `/tmp/arrow-escape-qa/05-blocked-strike-390x844.png`
- Successful escape: `/tmp/arrow-escape-qa/06-successful-escape-390x844.png`

## Comparison findings

1. The implementation preserves the reference's immediately readable arrow-
   release puzzle, three-strike state, remaining count, two-minute clock, and
   bottom zoom control without copying its line artwork.
2. The primary play area owns most of the viewport. Remaining, timer, shields,
   score, and pause are compact support controls rather than competing cards.
3. The final non-gridded parchment plate cleanly separates the jade/coral
   mechanical arrows from the warm garden surround. Decorative foliage stays
   outside the puzzle foreground and does not interfere with hit targets.
4. Jade/coral enamel, brass joints, and directional heads keep every actionable
   arrow legible against the pale board. Dark green text and iconography retain
   strong contrast on the cream HUD and controls.
5. Controls remain reachable and readable at the exact reference viewport.
   Buttons use clear labels or accessible names, the zoom control has both
   direct buttons and a slider, and the pause recovery dialog preserves one
   dominant continue action.
6. The implementation intentionally replaces the reference's black line
   graphics and emoji hearts with original production assets and Lucide shield
   icons, while keeping spatial density and escape-ray scanning recognizable.

## Fix history

- P2 foreground conflict: the first generated board included decorative grout
  lines that competed with the logical arrow layout. Replaced it with the
  non-gridded foreground source
  `exec-e9a2b5d7-8adf-4e54-8506-4ce6763e5a68.png` and repeated the browser
  comparison.
- P3 intentional reference divergence: no upstream artwork was reused because
  the audited snapshot has no per-image provenance manifest. The richer
  original mechanical-arrow treatment is documented in `ATTRIBUTION.md`.
- Replay consistency: browser QA found that a same-seed reset rewound state but
  did not recreate an already-destroyed Phaser arrow container because the
  level checksum was unchanged. The scene now rebuilds whenever legal removal
  history rewinds; a second escape of the same first arrow after replay verified
  the repaired path.

## Interaction evidence

- Successful escape: remaining count `38 → 37`, score `0 → 108`, and the live
  status announced that a new path may have opened.
- Blocked strike: shields `3 → 2` and the live status announced that the arrow
  returned to its track.
- Same-seed replay: remaining reset to `38`; tapping the restored first arrow
  again produced remaining `37` and score `111`.
- Pause/resume: the visible timer remained `01:33` across a 1.1-second paused
  observation and continued only after the explicit Continue action.
- Zoom: the accessible slider moved from `1` to `1.1`, and the visual board
  scaled while the HUD and bottom rail remained fixed.
- Refresh recovery: refreshing a playing run reopened it paused with remaining
  `37`, score `111`, and the validated-local-run recovery notice.
