# Screw Sort attribution

## Gameplay reference

The gameplay study referenced [IcedSoul/minigame-everyday](https://github.com/IcedSoul/minigame-everyday), specifically `day-01-screw` at commit `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`.

The upstream README states that the repository is MIT licensed, but the audited checkout did not contain a root `LICENSE` file or per-asset provenance records. For that reason:

- no upstream image, font, bundled Phaser file, or other binary asset was copied;
- no upstream source file was copied verbatim;
- the rules engine, seeded generator, persistence, Phaser scene, React bridge, accessibility controls, and tests in this app are independent TypeScript implementations;
- the reference was used only to study the core interaction: layered boards, four three-slot color cases, a five-slot overflow tray, and failure on the sixth unmatched screw.

## Original visual assets

The following assets were generated specifically for this app with OpenAI image generation on 2026-07-10, then resized, alpha-cleaned, composited on both cream and wood surfaces, and encoded as WebP/AVIF during the implementation task:

- `public/art/workshop.webp`
- `public/art/plank.webp`
- `public/art/screw.webp`
- `public/art/toolbox.webp`
- `public/art/overflow-tray.webp`
- `public/logo.webp` and `public/logo.avif`
- `public/banner.webp` and `public/banner.avif`

To avoid adding roughly 13 MB of one-off high-resolution sources to a repository that will contain dozens of games, those source PNGs are not committed. The exact ImageGen batch is `019f4c90-55d6-7680-b69b-8a32d10ebb00`; the retained output identifiers are:

- final plank source: `exec-50ca06ec-0de3-4daa-9a70-4919b3ba2104.png`
- screw source: `exec-2997fef9-e9e9-49ef-9be9-ca73c8422595.png`
- toolbox source: `exec-bcfbae45-a62e-4d28-b540-eaea41534d4b.png`
- overflow tray source: `exec-766e5c14-ec29-46b3-9cf1-be1e1e1df202.png`
- workshop background source: `exec-ed713eea-212a-4fc2-9be0-62ff539bd46a.png`
- logo source: `exec-55a7c767-d340-466a-a455-da36680bca1f.png`
- banner source: `exec-ee7da263-53f5-40c5-9bfc-f0e816f3a598.png`

Only the optimized runtime assets under `public/` ship with the app.
