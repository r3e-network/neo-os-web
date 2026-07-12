# Forever Album asset provenance

## Active visible assets

| Asset | Runtime role | Repository evidence | Provenance status |
|---|---|---|---|
| `public/forever-album-memory-stage.webp` | Dominant in-app album workspace and catalog banner | 1200×675 WebP, SHA-256 `df0141b30b0caa3c06b369007c0dd378f695ec9d7b5308902411cd7662ba7b39`; first present in repository commit `488fa04ec` (2026-07-06) | Repository-owned generated artwork. The repository contains a matching warm photo-album generation prompt, but the file has no embedded provider/model/license metadata, so the exact generation record remains unresolved. |
| `public/logo.webp` | Miniapp icon | 1024×1024 WebP, SHA-256 `666ff955a7ba3aa26b9001dbfcc19b5b5702919057e1b334c999d3797a8bdb14`; the logo family first entered in commit `ad52d3e2d` and the current raster in `488fa04ec` | Repository-owned generated brand asset; exact source-generation record is not embedded. |
| Lucide React icons | Interface controls and status marks | Imported from the repository's `lucide-react` dependency | Third-party icon library under its package license; no copied reference-game art. |
| User-selected photos | Album content | Chosen from the user's device at runtime and stored only in that wallet's local browser partition | User-provided content; never bundled, uploaded, or claimed by the app. |

## Shipped compatibility variants

`logo.avif`, `logo.svg`, `banner.avif`, `banner.svg`, and `banner.webp` are legacy brand/media variants retained for the repository's multi-format media pipeline. They are not used by the Forever Album play area. The public manifest now points the banner slot at the product-specific memory-stage raster rather than the legacy chart-style banner.

`album-scene-art.webp` is a legacy, unused scene image. It is not referenced by the current play area or manifest.

## Reuse boundary

No artwork or implementation from `IcedSoul/minigame-everyday` is used in Forever Album. No external photo, game sprite, or unverified reference-repository asset was copied during this pass.

## Follow-up

Before making an external legal-provenance claim, attach the original generation job/model/terms record for the active memory-stage and logo rasters, or regenerate them through the project's approved image-generation account and record that job here. Current repository history proves custody, not the original model/provider terms.

