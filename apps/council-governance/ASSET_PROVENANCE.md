# Asset Provenance

The production UI uses repository-owned artwork already tracked in this
project's Git history:

| Asset | Role | Dimensions | Provenance |
| --- | --- | ---: | --- |
| `public/council-chamber.webp` | Primary council-floor scene | 1280×720 | Project artwork, refined in repository history; no external source dependency. |
| `public/council-scene-art.webp` | Retained legacy scene art; not rendered by the production PlayArea | 512×512 | Project artwork tracked in this repository. |
| `public/banner.webp` / `.avif` | Catalog preview | 1440×640 | Project catalog artwork tracked in this repository. |
| `public/logo.webp` / `.avif` | MiniApp identity | 1024×1024 | Project identity artwork tracked in this repository. |

The active `1280×720` chamber resource was inspected at source resolution and
is placed with `object-fit: cover`; the foreground identity, rule plaques, and
proposal controls remain high-contrast at the measured scene slot. The center
identity is overlaid with the repository's canonical shared `CoinArt` NEO
asset, and the wallet summary uses the canonical shared NEO/GAS `CoinArt`
assets. Token identity is not redrawn inside this MiniApp.

No asset from `IcedSoul/minigame-everyday` or another third-party repository is
used by Council Governance. Visible interface icons come from the existing
Lucide dependency. This pass generated no new artwork and made no new external
license claim.
