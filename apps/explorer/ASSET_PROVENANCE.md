# Neo Explorer Asset Provenance

Neo Explorer reuses the production artwork already tracked in this repository. It does not copy assets from `IcedSoul/minigame-everyday` or draw substitute artwork with CSS, emoji, or inline SVG.

| Asset | Production use | Provenance | Integrity |
| --- | --- | --- | --- |
| `public/banner.webp` | Idle search-result surface | Existing first-party Neo Miniapps artwork, tracked in repository history since the consolidated 2026-07-06 snapshot. No third-party source is referenced in repository history. | SHA-256 `1f795d8298e311c38b2148d20e733ed8442ab543a79c71ac05c2df4543e29485`; 1200 × 720 WebP |
| `public/logo.webp` | Manifest/store icon | Existing first-party Neo Miniapps artwork tracked in repository history. | SHA-256 `a807786bf3e84b9cb914e008fc6fcca444e2b1d5f1134334ebd1e60a5a5f06eb`; 512 × 512 WebP |
| Lucide icons | Search, chain-object, telemetry, refresh, and source affordances | `lucide-react`, under its package license. Icons remain code-native interface affordances and do not replace the Explorer illustration. | Package-managed dependency |

The AVIF files are delivery alternatives generated from the same artwork. Legacy SVG derivatives remain for compatibility but are not rendered by the PlayArea or selected by the production manifest.
