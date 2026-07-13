Sheep Solitaire Art Assets
==========================

## Sheep-Themed Tile Set (P1 Art — v2)
**Generated**: 2026-07-13
**Tool**: `scripts/generate-sheep-tiles.mjs` → SVG authoring + sharp rasterization to webp

15 unified sheep-meadow themed card tiles (256×256 px, webp quality 90).
Each tile shares a consistent card-frame template:
- Warm cream rounded-rectangle background (#FFF8F0)
- Gold/tan border with subtle inner shadow (#D4A853 / #C4943E)
- 4 green diamond corner gems (#16C784 Neo Green)

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

**Pipeline**: SVG (hand-authored in script) → sharp resize(200,200) → webp({quality:90}).

---

## Legacy Assets (Pre-P1)

The following assets were generated during the July 2026 miniapp visual refresh
and are retained as non-tile environment art:

- **mascot-sheep.webp** — Game mascot (regenerated from original project sprite)
- **meadow-table.webp** — Background table surface
- **slot-tray.webp** — Card tray/slot background
- **Difficulty badges** — Easy/Medium/Hard tier badges

### Original Source (Legacy Tiles — Now Replaced)
The original generic fruit/object tile set (wool-flower, apple, orange, lemon,
grape, strawberry, peach, cherry, star, bell, target, ribbon, crystal, tent,
carousel) has been fully replaced by the sheep-themed set above.
