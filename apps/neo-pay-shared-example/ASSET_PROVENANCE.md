# NeoPay Stream Studio Asset Provenance

The production surface reuses the existing NeoPay product-family assets already maintained in this repository. No third-party or reference-repository artwork was copied for this app.

| App-owned file | Repository source | SHA-256 | Use |
| --- | --- | --- | --- |
| `public/payment-stream-desk.webp` | `apps/neo-pay/public/payment-stream-desk.webp` | `724211d6e04c044981e195bb59cae9961eef6716cbfaea378dd9f7fb17d5b040` | Primary payment vault and stream workstation scene |
| `public/banner.webp` | Derived from `apps/neo-pay/public/banner.webp` by `scripts/generate-example-media.mjs` | `bd8937e4efd05d15094b3874c3ed188291f941245392f6392d98f604f8877ec8` | Catalog banner |
| `public/logo.webp` | Derived from `apps/neo-pay/public/logo.webp` by `scripts/generate-example-media.mjs` | `404696c0ff88f0e11b208b26df96bfa4d0170b6b84cad5f2a8a0fb509ceb3f91` | App icon and favicon |

The catalog banner and icon are no longer byte-for-byte copies of the NeoPay files: `audit:miniapps:media` requires each app's store media content to be unique. `scripts/generate-example-media.mjs` (sharp) derives both files from the repository-owned NeoPay family renders with a distinct developer-example treatment — the family accent is re-graded from teal-green to indigo, the banner carries a solid indigo "DEVELOPER EXAMPLE / NEOPAY SHARED RUNTIME" label strip, and the icon carries an indigo code badge. The AVIF siblings (`banner.avif` = `e04e873a629f017f1cca551c357ed05e6fa4e82e8280a8524bb3d47b622528cd`, `logo.avif` = `47fea2da8d732fbe689e7553b6289229ee3ab20252ad1cdf912215a771a33c1b`) are re-encoded from the derived WEBP files by the same script. The UI also uses the shared official NEO and GAS marks through `CoinArt`; it does not draw substitute token logos.

Legacy `neopay-shared-scene-art.webp` and SVG files remain in the source directory for backward compatibility but are not referenced by the version 1.1.0 manifest or primary product surface.
