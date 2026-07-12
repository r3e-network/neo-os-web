# Asset provenance

| Asset | Product role | Repository history | Provenance note |
| --- | --- | --- | --- |
| `public/passport-desk.webp` | Main identity workspace and active launcher/catalog artwork | Added in repository commit `488fa04ec` (2026-07-06) | Repository-owned application artwork. Original generation/source metadata is not present beside the file, so no external attribution is claimed. |
| `public/logo.webp` | NeoDID card and app mark | Added in `1b100aed7`; refreshed in `0098cd946` (2026-05-21) | Repository-owned app mark; it is not presented as the official NEO or GAS token logo. |
| `public/banner.webp` | Legacy launcher artwork, retained for compatibility but not selected by the manifest | Added in `1b100aed7`; refreshed in `0098cd946` (2026-05-21) | Repository-owned launcher asset. Its TESTNET tag is too narrow for the app's mainnet-capable runtime, so the active launcher now uses the real identity desk instead. |

The active workspace uses the real raster identity scene and Lucide icons. It
does not render emoji, CSS/div art, inline SVG, stock imagery, or assets from
`IcedSoul/minigame-everyday`. The older `did-scene-art.webp` and SVG/AVIF
compatibility variants remain packaged but are not rendered by the passport
workspace.
