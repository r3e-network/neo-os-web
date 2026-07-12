# Bead Workshop asset provenance

## Gameplay reference only

- Reference: <https://github.com/IcedSoul/minigame-everyday/tree/73bb72fa6b144148fc7c7e93c83ffd47f3d9f173/day-06-beads>
- Audited commit: `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`
- The reference repository root README describes the project as MIT, but no `LICENSE` file is present at the audited commit.
- The reference was used only to study public gameplay behavior. No reference screenshot, image, Canvas architecture, source file, or unknown-provenance artwork is copied into Bead Workshop.

## Original generated artwork

The following images were generated specifically for Bead Workshop with OpenAI image generation, then resized and encoded for the named runtime slots:

| Shipped file         | Generated source                                |
| -------------------- | ----------------------------------------------- |
| `../banner.webp`     | `exec-ece6dbb2-d9f1-4605-a668-d03945663590.png` |
| `../banner.avif`     | AVIF derivative of `../banner.webp`             |
| `../logo.webp`       | `exec-a7701ae8-fa35-4664-b405-eb274996f637.png` |
| `../logo.avif`       | AVIF derivative of `../logo.webp`               |
| `workshop-bg.webp`   | `exec-7efff129-4783-454d-9067-1999b869f001.png` |
| `bead-highlight.png` | `exec-4ecc8c3f-4e7c-4342-b8cb-dd99c5b042f7.png` |

The seven files under `beads/` are color and alpha derivatives of the generated neutral resin-bead source. They are reproducible with `scripts/build-bead-assets.mjs` and are not derived from third-party game imagery.

The design exploration image `exec-d1ac0088-f004-4c38-9159-6560d76c7e37.png` was used as an internal visual direction only and is not shipped as a runtime asset.

All shipped visual assets are original to this application. The implementation is covered by the repository root MIT License.
