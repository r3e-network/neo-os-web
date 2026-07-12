# AA Relay Console Asset Provenance

Date reviewed: 2026-07-11

No asset from `IcedSoul/minigame-everyday` or another external game repository is used by AA Relay Console.

| Asset | Use | Repository evidence | SHA-256 |
| --- | --- | --- | --- |
| `public/aa-relay-station.webp` | Main in-product relay station scene | Existing project raster, present in repository snapshot commit `488fa04ec`; no third-party attribution found in the repository | `a76ae2be636e3578b01a549065eabe82a87cdaa41a311a26884d0e1bf64610ca` |
| `public/aa-relay-scene-art.webp` | Retained alternate project artwork; not rendered by the current PlayArea | Existing project raster, present in repository snapshot commit `488fa04ec`; no third-party attribution found in the repository | `37e7c758104f321e5505e60fde5f6328f4a3dbe982fcf2add527c61e22618faa` |
| `public/banner.svg` | Repository banner master | Existing project asset history includes `ad52d3e2d`, `0098cd946`, and `488fa04ec` | `c126142ebde6c80fdce6488de5d1ff4566da7d6084e15d2585215d675c801692` |
| `public/banner.webp` | Catalog banner raster | Repository-derived catalog variant | `7a6390fe56e3237fee1b58391a49750b02571d308b6243356961f5c56c19be9f` |
| `public/banner.avif` | Catalog banner AVIF | Repository-derived catalog variant | `6ffd62a07211696c1676f1cd11b8658805b3d8bcc353bc114dd03331cb41ab27` |
| `public/logo.svg` | Repository logo master | Existing project asset history includes `ad52d3e2d`, `0098cd946`, and `488fa04ec` | `af85b81d0373613dfaffc1b9c913a62bed499dcde13908d60d432bb8b41ae6fd` |
| `public/logo.webp` | Runtime favicon/catalog logo | Repository-derived catalog variant | `2c1773da3b6ef971563bd3938906c8d305656d589171c51255c8f4c35681d15b` |
| `public/logo.avif` | Catalog logo AVIF | Repository-derived catalog variant | `ab7ebbaeb9cc2cbca93e38cd0cb7ab95f82d2c17902aa0eb662c94d51a8225ca` |

The runtime renders the real raster station art, Lucide icons, and the shared official GAS `CoinArt`. It does not use emoji, ASCII artwork, CSS illustrations, inline SVG drawings, or placeholder boxes as visible product assets.

The git history is the available provenance record for the two scene rasters; it does not contain an embedded prompt/provider record. If the project later requires external redistribution proof beyond repository ownership, regenerate those scene rasters through the approved image pipeline and append the generation record here before replacing the files.
