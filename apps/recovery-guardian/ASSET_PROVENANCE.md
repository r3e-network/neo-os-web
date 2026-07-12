# Recovery Guardian asset provenance

Last reviewed: 2026-07-11

## Active recovery artwork

`public/recovery-command-center.webp` is the existing repository-tracked 1672×941 guardian-vault scene used as the primary in-app resource. It was already tracked at the start of this pass; this change does not invent third-party attribution for its undocumented historical generation metadata.

SHA-256: `a4ddb992b87c049b010e7a1c388e8181bea7953ae8a4c98e68ecb78f4a693c3c`

The active launcher artwork is derived from that same source so the catalog and the application show one coherent product rather than a generic letter mark:

| Production asset | Dimensions | Transformation | SHA-256 |
| --- | ---: | --- | --- |
| `public/banner.webp` | 1440×640 | centered cover crop, WebP quality 90 | `3a59f867c375c98f5142de579cd70324f70f79e6ef47b3a44707a18ab2644662` |
| `public/banner.avif` | 1440×640 | same centered crop, AVIF quality 72 | `45d10c07bb757377bda54bdae097ee919d3286abfe65d0cadd3ffdf39152b52f` |
| `public/logo.webp` | 512×512 | 820×820 vault-and-guardian crop resized to 512×512, WebP quality 92 | `d1510c845e66ab2264b01fe2b75c155da18ddb0e474c69fbba7c107e22e8d38f` |
| `public/logo.avif` | 512×512 | same vault crop, AVIF quality 76 | `98d6d5113e9f69e2315a93c42749ae25307cc57a7550b3eae40a64f3d744b426` |

The conversions used the workspace Sharp runtime. No new external image, reference-repository resource, synthetic CSS art, emoji, or handcrafted SVG was introduced.

## Compatibility assets

The legacy SVG banner/logo and the dark `guardian-scene-art.webp` remain packaged for compatibility but are not referenced by the active manifest or primary recovery scene. Interface glyphs use the project's existing Lucide dependency and serve control/status semantics only.
