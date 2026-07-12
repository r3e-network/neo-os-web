# Oracle HTTP Console asset provenance

Last reviewed: 2026-07-11

## Generated launcher artwork

The active launcher banner and app mark were generated specifically for Oracle
HTTP Console with OpenAI ImageGen. The art direction asked for a warm,
sunlit mint-and-gold HTTP-oracle pipeline with a clear source → extraction →
receipt flow, clean foreground separation, and no embedded product or network
text.

| Production asset | Dimensions | Generated source | Source SHA-256 | Production SHA-256 |
| --- | ---: | --- | --- | --- |
| `public/banner.webp` | 1440×640 | `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-ad752387-5d93-469e-8f9d-81ac0dd626a2.png` | `c10ddf17badc9736ff7161c7081a53e8d65f183bb3c7c8c4b4a68091b7acb061` | `d49760b83a5c68cc263a0931c64d73006da5f30654e5d3283336aef898e34449` |
| `public/banner.avif` | 1440×640 | Same banner source | Same banner source | `9347da7c25c71c0d9e6233d578a91908c6a4c6a735edc852df29cc5cc12fa194` |
| `public/logo.webp` | 512×512 | `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-4da7bbce-fadd-4214-817a-b5d9e780357f.png` | `7e39294eb318a4a68352574d98d77af0ee4d5aed78327721e7cf26aa47123614` | `633192a0d9fbf4e4d213c12c47bd17d35c3bd5fc7fbfff4f1a02d0c471d13d8e` |
| `public/logo.avif` | 512×512 | Same logo source | Same logo source | `d4a683180032686a51785aebee135aad905d16b13fcd3a20a697add49c9efa5e` |

The PNG masters were preserved unchanged. WebP and AVIF outputs are
format-and-size conversions made with the workspace Sharp runtime; no
third-party artwork was added during conversion. The legacy SVG launcher files
remain packaged for compatibility, but the manifest and active launcher use the
generated raster assets.

The two generated masters were present and their hashes were rechecked on
2026-07-11. Local image inspection also confirmed that the active banner, logo
and in-app pipeline are warm, bright, free of embedded copy, and keep the mint
machinery visually separated from the pale background.

## In-app pipeline artwork

`public/http-oracle-pipeline.webp` is the existing repository-owned 1672×941
source → extractor → receipt scene used as the primary in-app workspace. Its
SHA-256 is
`51b0fc6953f7176a2752258e3196d64e177919ee7d91e2beef5129d8fd16be92`.
The file entered the repository snapshot in commit `488fa04ec`; this pass did
not replace it or invent undocumented historical generation metadata.

Interface glyphs come from the project's existing Lucide dependency and are
used only for controls and status semantics. No visible asset was copied from
`IcedSoul/minigame-everyday` or another reference repository.
