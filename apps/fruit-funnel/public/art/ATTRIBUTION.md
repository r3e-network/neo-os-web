# Fruit Funnel asset provenance

## Gameplay reference only

- Reference: <https://github.com/IcedSoul/minigame-everyday/tree/73bb72fa6b144148fc7c7e93c83ffd47f3d9f173/day-02-fruit>
- Audited commit: `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`
- The reference repository root README describes the project as MIT, but no `LICENSE` file is present at the audited commit.
- The reference was used only to study public gameplay behavior and six-column/funnel geometry. No reference source file, screenshot, Canvas architecture, or unknown-provenance artwork is copied into Fruit Funnel.

## Original generated artwork

The following images were generated specifically for Fruit Funnel with OpenAI image generation, then alpha-cleaned, resized, and encoded for the named runtime slots:

| Shipped file | Generated source |
| --- | --- |
| `../banner.webp` | `exec-1e877f18-0d1d-4d45-baf0-6ed0c8509785.png` |
| `../banner.avif` | AVIF derivative of `../banner.webp` |
| `../logo.webp` | `exec-f73b3437-9762-45c9-9284-b51edefc460a.png` |
| `../logo.avif` | AVIF derivative of `../logo.webp` |
| `orchard-stage.webp` | `exec-7aa1aa19-a077-4d48-a06d-60dcdaddc329.png` |
| `funnel-basket.webp` | `exec-07abf6fb-2112-4215-a0c0-55fe523ede6a.png` |
| `vine-rack.webp` | `exec-4323eed5-7b39-493d-86ae-64bb6186183c.png` |
| `fruit-apple.webp` | `exec-a5a63363-3633-4305-add1-10e116dc8756.png` |
| `fruit-orange.webp` | `exec-7bfbb51d-387a-46b7-b74c-f97c8326bbdb.png` |
| `fruit-lemon.webp` | `exec-18107239-db06-476a-9954-ffa7dc964dcf.png` |
| `fruit-grape.webp` | `exec-23783de8-fd1f-4301-9bea-424e6548107b.png` |
| `fruit-berry.webp` | `exec-b7000d41-61db-4595-b58b-0529731e08fa.png` |
| `fruit-peach.webp` | `exec-e1c7ecb7-a8b0-4151-9f59-82b1fe45131c.png` |

The design exploration image `exec-f74094b5-943d-45cd-85de-9c25a2ba4879.png` was used only as internal art direction and is not shipped as a runtime asset. Runtime derivatives are reproducible from their generated sources with `scripts/build-art-assets.mjs` and `FRUIT_FUNNEL_GENERATED_DIR`.

All shipped visual assets are original to this application. The implementation is covered by the repository root MIT License.
