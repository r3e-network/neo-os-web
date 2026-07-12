# Asset Factory asset provenance

Audit date: 2026-07-11

No code or artwork from `IcedSoul/minigame-everyday` is used by Asset Factory. No new image was generated for this refinement because the app already contains a product-specific token-minting studio resource.

| Asset | Dimensions | SHA-256 | Evidence and runtime role |
| --- | ---: | --- | --- |
| `public/token-mint-studio.webp` | 1672×941 | `0cb6d67734665db9acaa81a0011da23a1d994da3f365f76acd0c26d4f646c1a8` | Added in repository commit `488fa04ec`; primary Token Studio and token-object visual. Original upstream creation/license metadata is not recorded, so no stronger authorship claim is made. |
| `public/logo.webp` | 512×512 | `66f7e87e3a5775b94a7983151b564c85808a6e59b26638518830d0f43e5034cf` | Repository app icon; history includes `c1e62a04b` and `488fa04ec`. Original upstream metadata is not recorded. |
| `public/banner.webp` | 1200×720 | `44269fc95558efd4cfb9c438f8dae9006ff14e2e2c159cb875d425589c5606d5` | Repository catalog/banner raster. Original upstream metadata is not recorded. |

AVIF and SVG compatibility/source siblings remain in `public/`, while runtime product surfaces use WebP. Interface icons come from the existing `lucide-react` dependency. The visible interface uses no emoji, ASCII art, CSS illustration, inline/handmade SVG, or placeholder art.

NEO and GAS CoinArt are not visible in this release, so the app does not invent substitute token logos. If those assets are added later, they must use the platform's official shared CoinArt resources.

This document records evidence available in git and does not invent provenance. Missing upstream licensing/source records should be resolved before distributing these rasters outside the project.
