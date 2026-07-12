# Oracle Price Console asset provenance

Last reviewed: 2026-07-11

No image or implementation asset from `IcedSoul/minigame-everyday` is used by Oracle Price Console.

## Active product resources

| Asset | Dimensions | Product use | SHA-256 | Provenance state |
| --- | ---: | --- | --- | --- |
| `public/oracle-market-stage.webp` | 1440 × 810 | Bright market environment in the live price station, catalog banner, and social image | `7a8837a66683ad9ca4601d80a2f23c250c098e2e73a4a0510713fc499fe2eea8` | Generated with OpenAI ImageGen on 2026-07-11. The centered price prism and candlestick surface remain useful in both the in-app crop and wide catalog treatment without introducing fake token marks. |
| `public/logo.webp` / `public/logo.avif` | 512 × 512 | Catalog and app identity | `15dd644f2da06c17972e6879ddfbe828e14438831c807fbb84b7468e2d25f304` / `7fe0d2b8081d2a67a75fc9c643196867b9e568073fa8ddcc72d6f3c56a52830b` | Generated with OpenAI ImageGen on 2026-07-11 from the active market stage and retired logo as visual references. The mark is a text-free Oracle price prism with an inspectable chart; it contains no fake token identity. |

The live market-stage frame keeps the generated price prism and candlestick surface centered in its measured visual slot. NEO and GAS identity is rendered separately with the shared `CoinArt` component, whose centrally maintained artwork is sourced from the Neo press-kit pipeline. The raster contains no token marks and is not used as token identity.

Interface/status glyphs come from the repository's `lucide-react` dependency. The visible experience introduces no emoji, ASCII art, CSS/div illustration, handcrafted inline SVG, placeholder box, or copied upstream game art.

ImageGen masters: logo = `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-e5c71428-794c-4597-b50c-b33155263170.png`; market stage = `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-d71d0e04-8e2a-46d4-9201-c78100f52ec8.png`.

## Retained compatibility resources

- `public/oracle-price-scene-art.webp` (`a05dd3206be4a314faab0803693398bf97406a7d91bda1fec21ef6cf051b36f4`) is the older dark market image and is not referenced by the production PlayArea.
- `public/banner.webp`, `public/banner.avif`, and `public/banner.svg` are retired launcher outputs containing stale OneGate / NEP-21 / Testnet labels. The active manifest and Open Graph metadata use `oracle-market-stage.webp` instead.
- `public/logo.svg` is a retained launcher-pipeline output. The active manifest uses the generated WebP mark, so the stale SVG is not rendered by the MiniApp.

If external redistribution requires provider-level provenance, regenerate the active rasters through the approved image pipeline and append the model, prompt, date and output record before replacement.
