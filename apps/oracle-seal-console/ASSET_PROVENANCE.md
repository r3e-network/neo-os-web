# Oracle Seal Console asset provenance

Last reviewed: 2026-07-11.

No image, code, or game resource from `IcedSoul/minigame-everyday` or another external reference repository is used by Oracle Seal Console. No new image was generated in this pass because the app already contained a suitable product-specific, bright seal-chamber resource.

| Asset | Role | Dimensions | SHA-256 | Evidence / transformation |
| --- | --- | ---: | --- | --- |
| `public/seal-reference-stage.webp` | Primary in-app seal chamber | 1672×941 | `9b738126a1946c1f057d9fcd9a8288ecd7c71aa9f600ed4218d1c2a91de14bd4` | Existing repository asset added in commit `488fa04ec`. Original generation/provider metadata was not preserved, so no stronger authorship claim is made. |
| `public/banner.webp` | Active launcher banner | 1440×640 | `ecbbba2d4b7052dcd94e50b9968a9548ce16dacaeee8ffaffca39987c59689a6` | Centered cover resize of `seal-reference-stage.webp`; WebP quality 90. |
| `public/banner.avif` | AVIF launcher banner | 1440×640 | `11eabecd4f240fb224c934e1229185f223359bb9c1db2d59aec617837f27ebe2` | Same centered source crop; AVIF quality 72. |
| `public/logo.webp` | Active app icon | 512×512 | `84bf473a5ae56c6eaa7de17863078c2a4b2fed32356b5f36e9fce3ecb148932a` | 700×700 central envelope/chamber crop (`left 486`, `top 86`) resized to 512×512; WebP quality 92. |
| `public/logo.avif` | AVIF app icon | 512×512 | `8f3dec6b9dfec9bb65ed7ba3787fa87da161a666ba145220273ed92620d7a9e9` | Same central crop; AVIF quality 76. |
| `public/oracle-workspace-stage.webp` | Retained repository compatibility asset; not rendered by this release | 1672×941 | `982a5ff905b2808d92746e7224c70f9aad8dabd4fa7b60918c144437c9ad898c` | Existing repository asset from commit `488fa04ec`; original source metadata is not recorded. |

The active launcher formats were produced with the repository's installed Sharp runtime. The older handcrafted `banner.svg` and `logo.svg` files were removed so the build does not package a second, inconsistent visual identity.

Interface glyphs use the existing `lucide-react` dependency. The active source contains no emoji, CSS illustration, ASCII art, handcrafted or embedded inline-SVG asset, copied token logo, or placeholder image.
