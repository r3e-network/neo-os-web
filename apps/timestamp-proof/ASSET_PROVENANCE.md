# Timestamp Proof asset provenance

Last reviewed: 2026-07-12

No asset from `IcedSoul/minigame-everyday` or another external mini-game repository is used by Timestamp Proof.

| Runtime asset | Product use | Repository evidence | SHA-256 |
| --- | --- | --- | --- |
| `public/proof-desk.webp` | Primary in-app proof press and current catalog/social cover, 1672 × 941 | Existing repository asset first present in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | `34db486cca9790ff11e2e958065e1f928f96134b20f1c21fac718cba6a662f92` |
| `public/logo.webp` / `public/logo.avif` | Catalog and app icon raster variants, 512 × 512 | Repository logo-system lineage; WebP first present in commit `0098cd946f09b0f874cf63fe3b24128e939c65f4` | `6c147b05898a528372088609802b2bcdcb223684371b02c183c51f506ae5522c` / `8dc09035d14191c391de37bd9a68419dd7ce2fadc3b67e5e4704c724b6a67786` |
| `public/banner.webp` / `public/banner.avif` | Retained legacy promotional variants; no longer the catalog/social cover because the artwork says TestNet while the app supports both networks | Repository banner-system lineage; WebP first present in commit `0098cd946f09b0f874cf63fe3b24128e939c65f4` | `93dab37c640f4ad1bc06685c4a2d2241a842e44bbcf1fecee1bb1964379b8cc4` / `05d2f8de978c709c888eb83277ded2dc0bca0766e36883b3b31c54bef2a759b1` |
| `public/proof-scene-art.webp` | Retained legacy clock artwork; not rendered by the production proof workspace | Existing repository asset first present in commit `488fa04ece1840bf76c84a934d4bc571988a10cc` | `f28130196cdbef0347834607de8b682f5f2ceaea5efa2f5cef1d553afb731c4e` |

The active experience uses the real warm daylight proof-desk raster and Lucide interface icons. It does not present emoji, ASCII art, placeholder boxes, CSS/div illustrations, handcrafted inline SVG, or copied upstream game art as the product resource.

Git history does not preserve the original image-generation provider, prompt, or an explicit per-file license for the retained repository rasters. This document therefore does not claim third-party clearance that the repository cannot prove. If public distribution requires provider-level provenance, regenerate the active raster through the approved image pipeline and append the model, prompt, date, and output hash before replacement.

