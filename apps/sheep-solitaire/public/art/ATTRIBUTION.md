Sheep Solitaire Art Assets
==========================

## P2 Full-Screen Rebuild (2026-07-14 — §9.4 v2 sticker tokens, ALL ORIGINAL)

**Tool**: `scripts/generate-sheep-tiles.mjs` (SVG authoring → sharp → webp).
No third-party sources; every asset below is hand-authored in the script.
Style language (calibrated against the user's screenshots of the original,
drawn from scratch): flat fills, near-black outlines (#26221E), HARD offset
black shadows (no blur), zero gradients — sticker/papercraft.

- **Tile template v3 (sticker)** — all 15 `tile-NN-*.webp` regenerated at
  200×232 (portrait): cream face (#F8F6E8), near-black outline, gray-green
  bottom "thickness" strip (#97A886), baked hard offset shadow; icons scaled
  1.16× and saturation-bumped 1.2× at rasterization.
- **field-meadow.webp** (780×1688) — FLAT light lime field (#B7E389) with 26
  sparse two-stroke hand-drawn grass squiggles (seeded PRNG, byte-stable).
- **tray-wood.webp** (760×240) — brown wooden trough, black outline, plain
  interior (no slot dividers), fence-post row along the front edge.
- **btn-sticker.webp** (560×170, alpha) — white sticker CTA with a wobbly
  hand-drawn black border + hard shadow (text drawn in-scene).
- **prop-undo/prop-remove/prop-shuffle.webp** (140×150, alpha) — sky-blue
  sticker prop buttons with yellow black-outlined glyphs, baked shadow.
- ~~sheep-grazing.webp~~ — retired 2026-07-14 with the circle-composite home
  flock (see Mascot section below); the home now shows one hero medallion.
- `meadow-table.webp`, `slot-tray.webp`, `badge-*.webp` are no longer used by
  the Phaser scene (kept on disk for the legacy DOM PlayArea).

---

## Sheep-Themed Tile Set (P1 Art — v2)
**Generated**: 2026-07-13 (wool-ball contrast redesign 2026-07-14)
**Tool**: `scripts/generate-sheep-tiles.mjs` → SVG authoring + sharp rasterization to webp

15 unified sheep-meadow themed card tiles (200×200 px, webp quality 92).
Each tile shares a consistent card-frame template:
- Warm cream rounded-rectangle background (#F5EDD9)
- Tan border (#D4B88E)
- (The green corner gems of the first version were removed in the polish
  pass so occlusion dimming alone signals exposed vs covered tiles.)

**v2.1 fix (2026-07-14)**: `tile-02-wool-ball` redesigned for contrast — the
original cream-on-cream ball with hairline wraps read as a BLANK card at board
size. Now a warm-gray ball (#E5D7C1) with bold saturated rose (#D94F70) and
amber (#E8942A) yarn strands, thicker ink outline, and a soft ground shadow so
it stays readable at 40px.

**v2.2 fix (2026-07-14)**: `tile-00-sheep-face` and `tile-01-lamb` redrawn as
flat sticker derivatives of the in-house logo character (`public/logo.webp`,
July 2026 refresh) — the old pink-dominant faces (pink teardrop ears, dot
eyes, pink oval snout) read as PIG faces at board size (user verdict). New
design, judged at 40px: cream scalloped wool crown (#FFFDF6) framing a warm
cream face (#FBEEDC), big green eyes (#4CA86A) with white highlights, droopy
ears with pink inners only, tiny pink nose + smile, soft blush. The lamb is a
smaller-head variant with a green hair bow (a bow, not a bell, to avoid
clashing with tile-03-bell-collar).

**Symbol roster** (`tile-NN-name.webp`):
| ID | Name | Theme |
|----|------|-------|
| 00 | sheep-face | Brand mascot face |
| 01 | lamb | Baby lamb |
| 02 | wool-ball | Wool puff |
| 03 | bell-collar | Collar bell |
| 04 | hoof-print | Hoof track |
| 05 | carrot | Farm snack |
| 06 | clover | Meadow plant |
| 07 | flower | Wildflower |
| 08 | milk-bottle | Dairy product |
| 09 | fence | Wooden fence |
| 10 | sun | Sunny sky |
| 11 | cloud | Fluffy cloud |
| 12 | star | Night sparkle |
| 13 | heart | Love/health |
| 14 | butterfly | Meadow visitor |

**Palette**: Neo Green #16C784 (brand), warm cream #FFF8F0, gold #D4A853,
soft browns #8B6914/#5C4A0F, sky blue #7EC8E3, warm reds/oranges/greens.
Stroke weight: 2px; corner radius: 20px on frame, 12px on icons.

**Pipeline**: SVG (hand-authored in script) → sharp resize(200,200) → webp({quality:92}).

---

## Mascot (re-sourced 2026-07-14 — die-cut sticker from the in-house logo)

**mascot-sheep.webp** (560×560, webp quality 92, TRUE transparency) — derived
by `scripts/generate-sheep-tiles.mjs` from **`public/logo.webp`**, the app's
own painted sheep character produced in the July 2026 platform visual refresh
(in-house asset; NOT taken from any third-party game). The logo's sticker
card is reframed as a §9.4 die-cut sticker via sharp: rounded-corner mask
(dest-in), near-black ink outline, hard offset shadow, alpha preserved.

History: the previous mascot (and the grazing companion pose) were
circle-composite SVG sheep hand-drawn in the generator script; the 2026-07-14
user verdict retired them ("羊太吓人了…丑的一匹，居然是一堆圆圈拼的"). An
extraction of the full-body pose from `public/banner.webp` (same character,
same in-house refresh) was attempted twice and rejected: grass blades in the
painterly meadow occlude the hooves, and the wool/scarf share hue ranges with
the path/grass, so no clean alpha matte exists. The logo reframe carries the
character with zero matting risk. `src-svg/mascot-sheep.svg` (the old
circle-composite source) and `sheep-grazing.webp` were deleted.

---

## Legacy Assets (Pre-P1)

The following assets were generated during the July 2026 miniapp visual refresh
and are retained as non-tile environment art:

- **meadow-table.webp** — Background table surface
- **slot-tray.webp** — Card tray/slot background
- **Difficulty badges** — Easy/Medium/Hard tier badges

### Original Source (Legacy Tiles — Now Replaced)
The original generic fruit/object tile set (wool-flower, apple, orange, lemon,
grape, strawberry, peach, cherry, star, bell, target, ribbon, crystal, tent,
carousel) has been fully replaced by the sheep-themed set above.
