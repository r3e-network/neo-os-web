# Neo Convert asset provenance

Review date: 2026-07-11

No image, sprite, or implementation from `IcedSoul/minigame-everyday` is used
by Neo Convert. This is a tools MiniApp, so the reference game repository is
not an appropriate asset source.

| Asset | Runtime role | Dimensions | SHA-256 | Repository evidence |
| --- | --- | ---: | --- | --- |
| `public/key-workbench-stage.webp` | Main in-app workbench resource and catalog banner | 1672×941 | `14798e53047bf21b10991bb275eea815f8821f8a80c777a023aa447f7d2c6719` | Generated with OpenAI ImageGen on 2026-07-11 from the prior repository stage as a composition reference. The replacement removes the pseudo-token mark in favor of a neutral keyhole/circuit seal and makes the decorative code/QR surfaces non-scannable. Master: `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-36d33282-fc47-49e9-8eb1-9d9bd42205bb.png`. |
| `public/logo.webp` | Catalog/app icon | 1024×1024 | `8fb7d9662eb042006f55a9e0070c888921b756a02ae85cd0bddf043dfaf82646` | Existing repository identity asset with history through `ad52d3e2d`, `0098cd946`, and `488fa04ec`; original source metadata is not recorded. |
| `public/banner.webp` | Legacy catalog compatibility banner; not selected by this release | 1200×480 | `155380ad265ee9e318f1cae0b05237a5b883115c2869729a34e00e7e29a9306b` | Existing repository asset with the same history boundary as the logo. |
| `public/convert-scene-art.webp` | Legacy square scene; not loaded by the production PlayArea | 512×512 | `05623a9a85d6ca09a6d18ac34df0ff15380979dbb5b6bef98e55f6a1e169e8b7` | Existing repository asset present in `488fa04ec`; original source metadata is not recorded. |
| Shared `CoinArt` NEO/GAS resources | Optional connected-wallet balance snapshot only | Shared runtime assets | Enforced centrally | Official Neo Press Kit token images maintained under `apps/shared/assets/tokens` and rendered through `apps/shared/art/CoinArt.tsx`. |
| Lucide icons | Interface affordances | Package resource | Package-managed | `lucide-react`; icons do not imitate token logos or replace the workbench artwork. |

AVIF and SVG siblings remain as catalog compatibility variants. The production
PlayArea loads the WebP workbench resource, Lucide icons, and shared official
token art. It does not render emoji, CSS/div illustration, handcrafted or
inline SVG art, placeholder imagery, or a per-app NEO/GAS token drawing.

If the retained logo or legacy artwork is redistributed under a new license
claim, resolve its missing original generation/source terms first. Git history
proves project custody, not the original provider terms. The active workbench
stage has the generation record above.
