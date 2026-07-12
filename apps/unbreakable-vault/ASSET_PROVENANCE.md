# Unbreakable Vault asset provenance

Last reviewed: 2026-07-12

## Active vault artwork

`public/vault-challenge.webp` is the dominant in-app resource. The original
`vault-challenge.jpg` entered this repository in commit `e95b4485e` on
2026-06-20 and was converted to WebP in commit `488fa04ec`. The historical
generation job/model/license record is not embedded, so this repository proves
custody but not an external stock-license claim.

| Asset | Dimensions | Runtime use | SHA-256 |
|---|---:|---|---|
| `public/vault-challenge.webp` | 1847 × 852 | Primary challenge vault, lock, and escrow scene | `e108265ce8f46265a0f9d2dc9e440f5883f15178be5762e380614d5e3582d7ff` |
| `public/banner.webp` | 1440 × 640 | Catalog/social cover derived from the primary scene | `048c49380ec6643b126b3ecd0e5c4aaa2284542323143ea0e127dd015ff1e500` |
| `public/banner.avif` | 1440 × 640 | AVIF banner derivative | `337dd460048a602b5507a8091d61aa78d34959b5b6311324c560ed65604c7278` |
| `public/logo.webp` | 512 × 512 | Vault-lock catalog icon cropped from the primary scene | `028704a90906f831e6eac8920f5b28ed02c065dbd2812ed2ec10bb575be30907` |
| `public/logo.avif` | 512 × 512 | AVIF icon derivative | `fceb3aa70b74e11444f8d5df3921eceaf279f27e50c28e28a43cbde153c76707` |

The WebP/AVIF catalog derivatives were resized and encoded from the tracked
primary scene with the workspace Sharp runtime. This replaces the unrelated
generic letter-mark launcher art with the same vault resource the player
actually operates.

## Interface assets and reuse boundary

- GAS readouts use the shared `CoinArt` component and its centrally maintained
  official token source; this app does not redraw a token logo.
- Interface/status glyphs come from the repository's `lucide-react` dependency.
- No image, sprite, or implementation asset from
  `IcedSoul/minigame-everyday` is used.
- No emoji, CSS illustration, text-symbol art, placeholder image, or handcrafted
  inline SVG is used by the visible vault experience.

`public/logo.svg` and `public/banner.svg` are legacy compatibility outputs of
the repository media pipeline. The app entry point and manifest reference the
WebP assets, so these SVG files are not visible in the shipped experience.

Before making a broader legal-provenance statement, attach the original
generation record or regenerate the primary scene through the project's
approved image-generation account and record that job here.
