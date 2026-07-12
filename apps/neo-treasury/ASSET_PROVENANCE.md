# Neo Treasury Asset Provenance

This inventory covers assets rendered by the production miniapp. Neo Treasury does not copy assets from the reference minigame repository.

| Asset | Production use | Provenance | Integrity |
| --- | --- | --- | --- |
| `public/treasury-vault-desk.webp` | Main public-watchlist scene | Existing first-party Neo Miniapps artwork, tracked in this repository since the consolidated 2026-07-06 snapshot. No third-party source is referenced in repository history. | SHA-256 `4d93e92ec8f102a548b65d0f03fd5d75c4489f998b694736d725c17188ef41c2`; 960 × 960 WebP |
| `public/logo.webp` | Manifest/store icon | Existing first-party Neo Miniapps artwork. The WebP derivative is tracked in repository history; it is not used as a substitute for the official NEO/GAS token marks. | SHA-256 `b57070ae89a0eb9c8d0583c5f9602b9b2ac0f98c79e9295b8670158623b74012`; 512 × 512 WebP |
| `public/banner.webp` | Manifest/store banner | Existing first-party Neo Miniapps artwork. The WebP derivative is tracked in repository history. | SHA-256 `20a7d1a79b2c48afb640d853fe8a69587e7353028f2968ab90c3b05acb878ce3`; 1200 × 720 WebP |
| Shared `CoinArt` NEO/GAS images | Every native-token mark in the PlayArea | Official Neo Press Kit NEO and GAS icons, maintained centrally in `apps/shared/assets/tokens` and rendered through `apps/shared/art/CoinArt.tsx`. | Enforced by `apps/shared/test/official-token-assets.test.tsx` |
| Lucide icons | Interface affordances only | `lucide-react`, under its package license. Icons do not replace branded token or treasury artwork. | Package-managed dependency |

The PlayArea does not render emoji, CSS-drawn treasury art, inline SVG art, or locally invented NEO/GAS logos. The legacy SVG logo/banner derivatives remain in `public/` for compatibility, but the production manifest selects the WebP files and the application scene uses the WebP vault artwork.
