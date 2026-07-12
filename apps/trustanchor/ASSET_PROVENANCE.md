# TrustAnchor Asset Provenance

| Asset | Purpose | Dimensions | SHA-256 | Provenance |
| --- | --- | --- | --- | --- |
| `public/trustanchor-stage.webp` | Primary governance scene | 1440×810 | `7db1ad3c9c3b711d3c34aa9b7e1f634cf41abef8f07d5c8b4a42e87da4c206e1` | Existing project-owned repository asset, first present in commit `488fa04ec`; no external source URL is recorded. |
| `public/banner.webp` / `banner.avif` | Catalog banner | 1200×720 | repository source | Existing project-owned catalog assets. |
| `public/logo.webp` / `logo.avif` | Catalog identity | 512×512 | repository source | Existing project-owned catalog assets. |

The frontend also uses the shared official NEO/GAS token artwork documented in
`apps/shared/art/CoinArt.tsx` as sourced from the Neo Press Kit. No asset from
`IcedSoul/minigame-everyday` was copied into this app.

The stage asset has no recorded third-party URL or separate license notice. It
is therefore treated as an in-repository project asset, not as permission to
redistribute it outside this project.
