# `minigame-everyday` reference audit

Date: 2026-07-10  
Reference: <https://github.com/IcedSoul/minigame-everyday>  
Audited snapshot: `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`

## Scope and reuse boundary

The upstream README lists fifteen candidate games, but the audited snapshot has
only six implemented `day-*` directories. Candidate rows without a directory
are ideas, not migratable implementations.

The root README says `MIT` and says artwork is AI-generated or open source, but
the snapshot contains no standalone `LICENSE`, `NOTICE`, or per-asset provenance
manifest. Our safe reuse policy is therefore:

1. Adapt useful mechanics and algorithms with source, commit, and change
   attribution.
2. Do not copy art whose creator, model output ownership, or upstream license is
   not recorded per file. Regenerate or use already-attributed project art.
3. Preserve any future third-party notices verbatim when provenance becomes
   available.
4. Port two-dimensional games to the platform's Phaser 3 runtime instead of
   introducing a second renderer solely because the reference used Canvas.

The advertised browser entry is also not production-ready for Days 1-4:
`index.html` imports `js/main.js`, but that module only exports `Main`; the
`new Main()` call exists in the separate WeChat `game.js`. Direct browser loads
therefore render a blank page. Every migration must have an executable browser
entry test, not just a compilable scene module.

## Implementation map

| Reference | Actual implementation | Platform decision | Reason |
| --- | --- | --- | --- |
| `day-01-screw` | Phaser 3, generated Graphics, seeded board layout | Migrate as a new Phaser 3 game | Distinct storage/occlusion puzzle; no equivalent app exists |
| `day-02-fruit` | Phaser 3 + Matter, 48 suspended fruits, pair removal in a narrow channel | Queue as a new game after the first migration wave | Distinct physics/sequencing loop; not the same game as Sheep Solitaire |
| `day-03-arrow` | Phaser 3 grid-based arrow escape puzzle | Queue as a new `arrow-escape`-style game | Distinct from our archery-based `curve-arrow` |
| `day-04-sheep` | Phaser 3, 108-card overlap match-three | Use as a comparison only | Our Sheep Solitaire already has deterministic, constructively solvable deals and stronger attributed art |
| `day-05-goose` | Babylon.js 3D matching + custom physics/shake | Excluded from this stream | It overlaps the separately owned `zhuada-e` task |
| `day-06-beads` | Canvas 2D, 14x14 mask, connected-region sorting | Migrate as a new Phaser 3 game | Distinct pixel/region puzzle; no equivalent app exists |

## Candidate-list gap analysis

The upstream candidate table is useful as a genre backlog, but only rows backed
by a `day-*` directory are code migrations. The remaining rows need original
game design, production assets, balance work, and—in multiplayer cases—real
service architecture before they can be scheduled as applications.

| Candidate-list idea | Current platform coverage | Decision |
| --- | --- | --- |
| Screw storage puzzle | No equivalent before this audit | Build `screw-sort` from the audited Day 1 loop |
| Fruit slot puzzle | No equivalent | Build a deterministic pair-removal game; do not mislabel it as match-three |
| Physical arrow shooting | `aim-master` and `curve-arrow` cover adjacent shooting skills | Treat as a future mode/design study; there is no upstream implementation to migrate |
| Turning-arrow path puzzle | No equivalent; distinct from `curve-arrow` | Build `arrow-escape` from the audited dependency-order loop |
| Sheep layered match | `sheep-solitaire` | Keep our stronger constructively solvable implementation |
| Bead/pixel sorting | No equivalent | Build `bead-workshop` from the audited connected-region loop |
| Slingshot PvP | No equivalent production multiplayer game | Backlog only; requires authoritative networking, anti-cheat, matchmaking, and a balance spec |
| Goose 3D sorting | `zhuada-e` | Continue only in its separately owned task |
| Merge-idle painter | `merge-kingdom` covers merging, not the painter fantasy | Product-design backlog; no upstream code exists |
| Idle egg-laying duck | No direct equivalent | Product-design backlog; no upstream code exists |
| Water-world management | No direct equivalent | Product-design backlog; no upstream code exists |
| Daily-level collection | Better expressed as a platform/content system than one copied game | Architecture backlog; no upstream code exists |
| Zombie tower/survivor | `last-survivor` overlaps the survival theme, not the lane-defense loop | Product-design backlog; no upstream code exists |
| Garden management + merge | No published equivalent; a `garden-of-neo` mechanics draft is intentionally dormant pending the selected visual direction | Continue as an original product-design track, not an upstream code migration |
| Custom finale | Not a product specification | Do not schedule until a core loop and audience are defined |

## Logic audit findings

### Day 1: Screw

- The live generator creates 63 screws: seven colors, nine screws per color,
  twenty-one boards, and three screws per board.
- Four active color boxes each hold three screws. Five buffer positions are
  safe; the sixth unmatched screw loses. The visible copy currently says the
  buffer loses when five are full, which is one move earlier than the code.
- Occlusion is tested per screw against higher-z board rectangles.
- Color-box order is shuffled independently of screw accessibility. There is no
  solver or rejection pass proving a generated level can be completed within
  the five-position buffer.
- There is no deterministic replay identifier in the UI, pause/resume snapshot,
  reduced-motion path, or production recovery boundary.

Migration requirement: generate a witness solution (or reject the seed), store
the seed and compact run state, and test a large seed sample before a level is
published.

### Day 2: Fruit

- The game balances six colors into four pairs per color and uses separate
  Matter bodies and image sprites, which is a useful way to avoid texture/body
  radius drift.
- Although the candidate table calls it a match-three variant, the runtime
  removes two touching same-color fruits. The migration must name and explain
  the pair rule instead of presenting it as a triple-match game.
- Spawn positions and color order use `Math.random`; there is no replay seed.
- Rules run through a native `setInterval`, and the 800 ms overflow grace can
  race settling/cooldown animation on slow devices.
- Art files are visually usable but have no per-file provenance record.

Migration requirement: retain the decoupled body/render technique, but use a
seeded deal, Phaser lifecycle timers, deterministic rule-state tests, explicit
pause/recovery, and newly attributed art.

### Day 3: Arrow Escape

- This is not our existing Curve Arrow. It is a dependency-order puzzle: an
  arrow can leave only when no other arrow occupies its escape ray.
- The best reusable idea is the dependency graph. An edge `A -> B` means `A`
  waits for `B`; rejecting cycles guarantees at least one removable arrow until
  the graph is empty.
- A deterministic audit of 2,000 generated samples found zero deadlocks. Grid
  coverage stayed at or above `98.148%`, with 33-44 arrows per board.
- The reference still uses unseeded `Math.random`, emoji lives, procedural line
  art, and has no persistence or replay proof.

Migration requirement: keep the DAG invariant, add a seed and solution witness,
replace emoji/procedural visible assets with licensed game art, and verify
tap/pinch/pan behavior at mobile sizes.

### Day 4: Sheep

- The reference improves geometric accuracy by computing the union area of all
  higher cards and unlocking a card below a 5% covered-area threshold.
- Card positions/types use unseeded `Math.random`, and layout generation does
  not prove that a player can avoid filling the seven-card tray.
- Our current guest engine is deterministic and constructively verified across
  easy/medium/hard seeds; paid play remains fail-closed until the worker emits a
  structurally compatible solvable deal.
- Our current attributed meadow, tile, mascot, and tray assets are more coherent
  with the platform theme than the upstream files, so upstream art will not
  replace them.

Decision: retain our generator and assets. Revisit union-area occlusion only if
we move from the current grid layout to free-position cards and can re-prove
solvability under the new exposure model.

### Day 6: Beads

- The implementation contradicts its planning documents. Runtime constants are
  a 14x14 mask, 140 active cells, fourteen holding positions, and a three-minute
  timer—not the documented 4x6/6x8 variants.
- The holding array is called FIFO, but the player may select any color and the
  placement code removes the first matching color from anywhere in the array.
- The README advertises batch placement; no batch action exists in the runtime.
- The runtime also permits direct board-to-board movement, which materially
  changes the originally documented holding-loop puzzle.
- The color-count invariant is sound under the runtime's permissive rules. A
  headless solver completed 1,000 seeded distributions with zero deadlocks, but
  required as many as 140 actions. That does not validate the contradictory
  intended FIFO/batch rules or the three-minute difficulty.

Migration requirement: choose one explicit rule set, publish it in the UI,
generate a deterministic witness, tune the move/time budget from measured solve
data, and implement the missing batch action only if it remains part of that
rule set.

## Production gates for every migrated game

- Phaser 3 scene plus the platform PlayArea wrapper; no standalone engine fork.
- Full guest play without a wallet. GameFi entry, settlement, reward, VRF, and
  TEE paths remain disabled until their contracts/services are verified.
- Seeded level plus reproducible solution or verifier; large-sample generator
  tests and malformed-state tests.
- Pause, restart, storage failure, refresh recovery, short-screen, touch,
  reduced-motion, and audio controls.
- Designed primary play surface with real attributed assets; no form-first
  fallback, emoji UI, CSS art, or fake reward state.
- TypeScript, ESLint, production build, unit/integration tests, manifest safety,
  and same-viewport browser comparison before handoff.

## Migration status

| Platform game | Reference | Status | Production proof |
| --- | --- | --- | --- |
| `bead-workshop` | Day 6 Beads | Implemented and browser-verified | 14x14/140-cell certified boards, connected selection, 14-slot tray, undo, pause, refresh recovery, reduced-motion path, original attributed artwork, and a complete 390x844 core-flow run |
| `screw-sort` | Day 1 Screw | Implemented and browser-verified | 2,000-seed constructive sweep, corrected five-safe/sixth-loss rule, original tactile workshop assets, exposed/blocked selection, box routing, undo, pause, refresh recovery, resize reconstruction, and 390x844 visual comparison |
| `arrow-escape` | Day 3 Arrow Escape | Implemented and browser-verified | 2,000-seed DAG/witness sweep, original warm garden assets, successful and blocked taps, shield loss, pause/resume, zoom, same-seed replay, and refresh-to-paused recovery at 390x844 |
| `fruit-funnel` | Day 2 Fruit | Implemented and browser-verified | Deterministic 48-fruit pair schedule, certified safe hint, seven-slot loss, non-rewinding undo, pause/resume, refresh-to-paused recovery, lifecycle-safe ready state, original orchard assets, and a complete cold-start browser run |

Future candidate-list entries are not scheduled as code migrations because the
reference snapshot contains no implementation for them.
