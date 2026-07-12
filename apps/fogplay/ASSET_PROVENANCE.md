# FogPlay asset provenance

The playable Phaser scene uses the following project-authored raster resources:

| Runtime asset | Source asset | Purpose |
| --- | --- | --- |
| `src/static/coin_heads.webp` | `src/static/coin_heads.png` | Heads face and heads choice control |
| `src/static/coin_tails.webp` | `src/static/coin_tails.png` | Tails face and tails choice control |
| `src/static/holo_pedestal-512.webp` | `src/static/holo_pedestal.webp` | Coin landing pedestal |
| `public/banner.webp` / `public/banner.avif` | Existing FogPlay cover artwork | Launcher cover |
| `public/logo.webp` / `public/logo.avif` | Existing FogPlay cover artwork | Launcher icon |

The source coin art and pedestal are longstanding FogPlay repository assets. Git
history records the coin assets in commits `dbdc4735f`, `29d1e49c0`,
`0b45ffdcc`, and `488fa04ec`; the pedestal is recorded in `488fa04ec`. The WebP
runtime variants are optimized derivatives and do not introduce third-party
artwork.

The Phaser wager marker and any GameFi reward token use the shared official GAS
asset through `officialGasTokenPhaserUrl`; FogPlay does not ship a locally drawn
NEO or GAS logo.

No resource was copied from `IcedSoul/minigame-everyday`: its current six-game
snapshot has no coin-flip implementation and no clear root license file. Its
code and assets therefore remain reference-only.
