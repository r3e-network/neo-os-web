# NeoPay Stream Studio Asset Provenance

The production surface reuses the existing NeoPay product-family assets already maintained in this repository. No third-party or reference-repository artwork was copied for this app.

| App-owned file | Repository source | SHA-256 | Use |
| --- | --- | --- | --- |
| `public/payment-stream-desk.webp` | `apps/neo-pay/public/payment-stream-desk.webp` | `724211d6e04c044981e195bb59cae9961eef6716cbfaea378dd9f7fb17d5b040` | Primary payment vault and stream workstation scene |
| `public/banner.webp` | `apps/neo-pay/public/banner.webp` | `3efa6a8601eec4ad2f06fc5c175eb64716d47769e475a4e10303c7fde6fdd395` | Catalog banner |
| `public/logo.webp` | `apps/neo-pay/public/logo.webp` | `c1971fe557ca398ac39bab692f3bafd237a002023ae10e846ee5c085aa0bb212` | App icon and favicon |

The files were copied byte-for-byte so the app build owns stable public paths while retaining the NeoPay family visual identity. The UI also uses the shared official NEO and GAS marks through `CoinArt`; it does not draw substitute token logos.

Legacy `neopay-shared-scene-art.webp`, SVG, and AVIF files remain in the source directory for backward compatibility but are not referenced by the version 1.1.0 manifest or primary product surface.

