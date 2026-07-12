# Neo Swap asset provenance

## Active product artwork

| Asset | Product role | Source and handling | SHA-256 |
| --- | --- | --- | --- |
| `public/liquidity-route-v2.webp` | In-product liquidity route stage | Created for Neo Swap with OpenAI image generation on 2026-07-11. Art direction requested a bright glass liquidity route with mint/amber flow, no text, currency symbols, token marks or third-party source art. Converted locally to a 1200 × 600 WebP. | `c14e4e863574a5c6523229521985639d24326d75270acffa6b51c224c0b7023c` |
| `public/logo.webp` | Active manifest/app logo | Local raster composition of the generated route artwork and shared official Neo Press Kit transparent marks. No generated or redrawn token mark. | `226074582a9523152f1bb9e1b0cac1ed70e430b8d3f66c1d09d063bec0626edc` |
| `public/logo.avif` | Alternate optimized app logo | AVIF encoding of the same local composition. | `e5df639e8c8cc62177e08e7f01524a273c3454482213ae86ecf1274ed2462241` |
| `public/banner.webp` | Active manifest banner | Local raster composition of the generated route artwork and the same shared official marks. | `983e5257cb769ec456c40b7bc9a0791ff80e32b0b2abef6da6e8ee059ef9e8a9` |
| `public/banner.avif` | Alternate optimized banner | AVIF encoding of the same local composition. | `1103c19491289399063a363a693d37b1e82a30ce02a976fe34abd87feacb359a` |

Runtime NEO/GAS identity is rendered by `@shared/art` `CoinArt`, backed by the official Neo Press Kit assets in `apps/shared/assets/tokens/`. The generated route artwork does not impersonate or replace those token marks.

## Retained compatibility files

- `public/logo.svg` and `public/banner.svg` are repository-existing compatibility files first visible in commit `c1e62a04b` (2026-05-18). They are not selected by the current manifest or PlayArea.
- `public/swap-liquidity-stage.webp` and `public/swap-scene-art.webp` are repository-existing compatibility files first visible in commit `488fa04ec` (2026-07-06). The production PlayArea uses `liquidity-route-v2.webp` instead.
- No asset from `IcedSoul/minigame-everyday` or another reference repository is included in Neo Swap.
