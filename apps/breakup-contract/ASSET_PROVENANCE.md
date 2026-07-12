# Breakup Contract asset provenance

No new image, audio, font, or copied third-party resource was added in this production pass.

| Asset | Role | Provenance | Status |
|---|---|---|---|
| `public/logo.svg` | editable app mark | Repository-authored SVG, tracked since commit `c1e62a04b`; the app-specific heart/BC motif is also declared by `scripts/generate-miniapp-logo-system.mjs`. | approved |
| `public/banner.svg` | editable store banner | Repository-authored SVG, tracked since commit `c1e62a04b` and built from the same app mark system. | approved |
| `public/logo.webp`, `public/logo.avif` | optimized logo delivery | Repository-generated raster derivatives maintained by the miniapp asset optimization pipeline. | approved |
| `public/banner.webp`, `public/banner.avif` | optimized banner delivery | Repository-generated raster derivatives maintained by the miniapp asset optimization pipeline. | approved |
| `public/pact-table.webp` | warm pact-desk foreground art | Existing repository artwork introduced in commit `488fa04ec`; it is retained unchanged by this pass. No external source or copied reference is recorded in the repository. | approved for this repository; exact generation metadata unavailable |

SHA-256 of the retained pact desk: `1b045d0fdfa12721f0aaad3d910685a1754b192026da062bfd334ef32fcbb26f`.

The provenance limitation above is explicit: the exact model/provider parameters for the already-tracked pact desk cannot be reconstructed from git history. This pass therefore neither republishes it as third-party work nor claims a more specific origin than the repository evidence supports.
