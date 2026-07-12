# NeoPay asset provenance

Last reviewed: 2026-07-11

## Runtime artwork

| Asset | Dimensions | SHA-256 | Runtime use | Provenance evidence |
| --- | ---: | --- | --- | --- |
| `public/payment-stream-desk.webp` | 960 × 960 | `724211d6e04c044981e195bb59cae9961eef6716cbfaea378dd9f7fb17d5b040` | Primary payment-vault and recipient-terminal scene | Repository-tracked first-party visual master introduced in commit `488fa04ec`; no external source URL or third-party attribution is recorded |
| `public/banner.webp` | 1200 × 720 | `3efa6a8601eec4ad2f06fc5c175eb64716d47769e475a4e10303c7fde6fdd395` | Catalog banner referenced by `neo-manifest.json` | Repository-maintained artwork with history through commits `ad52d3e2d`, `0098cd946`, and `488fa04ec`; no external source URL is recorded |
| `public/logo.webp` | 512 × 512 | `c1971fe557ca398ac39bab692f3bafd237a002023ae10e846ee5c085aa0bb212` | Catalog and app icon referenced by `neo-manifest.json` | Repository-maintained artwork with history through commits `ad52d3e2d`, `0098cd946`, and `488fa04ec`; no external source URL is recorded |

`banner.avif` and `logo.avif` are repository-maintained encoded variants of
the same catalog artwork. The manifest and application use the WebP files
listed above. Legacy `banner.svg` and `logo.svg` files remain as non-runtime
compatibility artifacts; this release does not reference them as visible
artwork.

## Interface resources and usage boundary

- The payment desk reuses only artwork already tracked in this repository.
- No image, sprite, logo, or game resource was copied from
  `IcedSoul/minigame-everyday` or another reference repository.
- The original generation prompt, model, and source project for these
  pre-existing raster files are not preserved in repository history. This
  document therefore does not attribute them to a specific image model.
- GAS and NEO marks are rendered through the shared official `CoinArt`
  component. Product controls use `lucide-react` icons.
- No emoji, inline SVG illustration, CSS-drawn asset, placeholder image, or
  fabricated token logo is used as a NeoPay product resource.

If artwork is regenerated, record the tool or model, art brief or prompt, date,
reviewer, and updated checksum here before replacing the files.
