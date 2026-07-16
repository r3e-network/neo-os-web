# Last Survivor asset provenance

## Runtime assets

| Asset | Role | Repository evidence | Status |
| --- | --- | --- | --- |
| `public/last-survivor-arena.webp` | Primary Phaser arena background | First appears in repository snapshot commit `488fa04ec` (2026-07-06) | Repository-generated visual; exact generation provider/run metadata was not preserved |
| `public/logo.webp` / `logo.avif` / `logo.svg` | App mark and local player token | WebP/AVIF lineage appears in `488fa04ec`; SVG/logo-system lineage includes `0098cd946` and `ad52d3e2d` | Repository asset family |
| `public/banner.webp` / `banner.avif` / `banner.svg` | Catalog artwork | Same repository logo/banner system lineage | Repository asset family |
| official GAS icon from `@shared/art/token-assets` | GameFi HUD token mark | Shared official-token asset registry and its regression test | Official shared token asset |

`public/survivor-scene-art.webp` was removed along with the unmounted React
`PlayArea.tsx` that was its only referencer — the app's play surface is the
Phaser arena, which uses `last-survivor-arena.webp`.

No asset was copied from `IcedSoul/minigame-everyday` in this iteration. That repository has no sufficiently clear per-asset license record for direct reuse.

The project contains `scripts/generate-scene-art.mjs`, which supports GPT Image and a fallback provider, but the historical assets above do not carry enough run metadata to prove which provider produced a particular file. Keep this limitation visible: if distribution requires provider-level provenance, regenerate the affected raster art through the approved image pipeline and record the model, prompt, date, and output hashes here.
