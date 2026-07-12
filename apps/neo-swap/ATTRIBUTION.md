# Neo Swap asset attribution

The canonical per-file inventory and hashes are maintained in [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).

## `public/liquidity-route-v2.webp`

- Created for this project with OpenAI image generation on 2026-07-11.
- Art direction: a warm, bright, professional glass liquidity route with mint and amber flow, no text, no currency symbols, and no embedded token or brand marks.
- Converted locally to a 1200 × 600 WebP for the compact route-preview slot.
- No third-party source artwork was copied into this image.

## NEO and GAS marks

NEO/GAS imagery is not baked into the generated route artwork. Runtime token marks are rendered through `@shared/art` `CoinArt`, backed by the official Neo Press Kit files in `apps/shared/assets/tokens/`.

`public/logo.webp`, `public/logo.avif`, `public/banner.webp`, and `public/banner.avif` are raster compositions of the original route artwork and those same official transparent Neo Press Kit PNGs. They contain no generated or redrawn token marks.
