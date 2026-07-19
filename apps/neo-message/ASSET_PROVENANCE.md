# Neo Message asset provenance

Last reviewed: 2026-07-12

| Runtime asset | Role | Dimensions | Repository evidence |
| --- | --- | ---: | --- |
| `public/sealed-message-desk.webp` | Primary in-app desk and active launcher cover | 1672×941 | OpenAI GPT Image edit produced for this product pass from the prior project desk scene, removing the source's bottom-corner watermark-like mark while preserving the sealed-envelope composition. Lossless master: `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-03665089-a38b-4355-8b7b-ec9f69a94ae9.png`; runtime WebP SHA-256 `160b7b59b1c45c577532b961b5a7cbde57612d083ce19706af47f471ea94f5cd`. The active manifest and Open Graph metadata use this warm, product-specific scene. |
| `public/banner.webp` / `.avif` | Legacy launcher artwork, retained but inactive | 1440×640 | Existing project launcher family recorded in repository history; WebP SHA-256 `c15a76b9b5669ff441e3679fc4da534306b23326156aff42148a42d561a30a4c`. |
| `public/logo.webp` / `.avif` | MiniApp identity mark | 512×512 | Existing sealed-envelope identity family recorded in repository history; active WebP SHA-256 `9cb667071f48e586c704115618ad0067ee614458fe0b29b23e0ebf3eda53afaf`. |

The product pass reuses these repository assets as application objects: the
desk scene establishes the writing environment, while the envelope and seal
remain the interaction metaphor. It does not replace the application with a
promotional banner or generic form surface.

No visual or code resource was copied from `IcedSoul/minigame-everyday` or
another reference repository in this pass. Historical generation-provider
metadata is not asserted where it was not preserved. Interface glyphs come from
the existing Lucide dependency and are limited to controls and status meaning.
