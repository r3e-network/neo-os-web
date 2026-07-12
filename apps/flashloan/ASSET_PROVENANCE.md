# Flash Loan asset provenance

Last reviewed: 2026-07-12

| Runtime asset | Role | Dimensions | SHA-256 | Repository evidence |
| --- | --- | ---: | --- | --- |
| `public/flashloan-desk.webp` | Active in-app atomic capital-route workspace | 1672 x 941 | `ca27ad3a078a432a84cbf014e19e31a5fecba1123089c1a895ffacb18fd8a7e7` | Current WebP added in repository snapshot `488fa04ec`; the prior JPG family appears in `2035c19e2`. Original generator/provider metadata was not retained. |
| `public/banner.webp` | Active catalog/social cover | 1200 x 720 | `9c7e3d6dcb4599018c5c2cc2bc597c76f0d9802be0a0ced69991b7f2d9045ee1` | Existing designed asset family; history includes `bf940006b` and repository snapshot `488fa04ec`. |
| `public/banner.avif` | Catalog AVIF derivative | 1200 x 720 | `196dba22e8f326d68a9ba1fc080a804840c1e08bac7337e30bf24d1d59e50203` | Repository derivative of the catalog family. |
| `public/logo.webp` | Active favicon and catalog app identity | 512 x 512 | `d70c05dcd02d1d18b2a6d41d3d18c2987ca42fc2323491029c46f19f76041ca4` | Existing designed identity family; history includes `bf940006b` and repository snapshot `488fa04ec`. |
| `public/logo.avif` | Catalog AVIF identity derivative | 512 x 512 | `b7c5343d2a75b6e82e8de848be55caabbb87c9f39d659c760504b0b02930e43c` | Repository derivative of the identity family. |
| `public/flashloan-scene-art.webp` | Legacy compatibility artwork, not rendered by the active execution desk | 512 x 512 | `d75a9712f4eadb88413e5d50c3bbfc3f05c83b42cee61b46533f5ea649ed0d8f` | Current WebP added in repository snapshot `488fa04ec`; original generator/provider metadata was not retained. |

`public/banner.svg` and `public/logo.svg` remain repository compatibility assets,
but the active manifest, favicon and execution desk use the raster assets above.
No inline SVG, handcrafted SVG illustration, CSS/div artwork, emoji or
placeholder asset was added in this pass.

The product uses shared official NEO/GAS `CoinArt` for token identity and Lucide
for semantic interface icons. It does not redraw token logos per MiniApp.

No art or code from `IcedSoul/minigame-everyday` or another external game
repository is used by Flash Loan. The raster artwork is repository-local, but
its original generation and license metadata is incomplete. This file records
the evidence available in git and does not invent missing attribution; resolve
that upstream record before distributing these images outside this repository.
