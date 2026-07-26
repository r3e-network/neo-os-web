# Asset provenance

Last reviewed: 2026-07-25

## Visual sources

All masters under `art-src/` were generated specifically for this project with
OpenAI ImageGen, then visually reviewed and resized locally. They use original
chibi goose characters, baskets, backgrounds, and object catalogs. No images,
models, textures, logos, or UI were copied or extracted from the commercial
game that inspired the general find-and-match mechanic.

`art-src/SOURCE_MANIFEST.md` records the reviewed source-set SHA-256 values and
the available generation/review context. The workspace did not receive ImageGen
job identifiers or verbatim prompts, and the manifest says so explicitly rather
than inventing provenance that cannot be verified.

The approved source set contains:

- three portrait theme backdrops;
- three 4×3 reviewed object atlases (36 unique source illustrations total);
- three theme mascot illustrations;
- three seamless basket/crate material textures;
- one logo master and one three-theme banner master.

`scripts/generate-art.mjs` deterministically produces the public WebP/AVIF/PNG
variants and transparent per-object runtime textures. The three reviewed
atlases were refined on 2026-07-25 so their thumbnails use the same clean
silhouette/material language as the physical models: no arbitrary stripes,
badges, floral stamps, cords, dots, or diagonal identity marks. The script also
owns 18 original SVG recipes for the six catalog extensions in each theme
(strawberry basket to juice carton, rolling pin to yarn, and teapot to mahjong).
Those recipes are code-native project assets rather than extracted media.
Generated runtime files remain checked in for reviewability and are regenerated
by `prebuild`.

The physical models use a separate, code-native skin pass in
`src/scenes/model-kit.ts`: each `surface()` finish (produce, glaze, ceramic,
metal, wood, fabric, paper, and matte) receives a shared 64×64 procedural
neutral albedo, normal and roughness maps. These maps provide broad,
low-frequency pigment, grain, weave, glaze and paper response under the
scene's PMREM lighting without
adding painted identity symbols or per-instance texture downloads. The
`model-cache` regression gate checks that every visible production surface
keeps all three maps, a finish-specific normal response, visible channel
contrast, and its `goose-skin-v1` provenance tag.

The runtime gameplay catalog exposes 54 match identities per theme. The first
18 use the original model/icon recipes directly. The remaining 36 are
deliberate same-silhouette, different-colour identities that reuse one of those
authored bases with a separate material colour, localized name, physics/match
identity and deterministic hue treatment for the tray icon. Each near-match
also receives a full-body hue/material treatment on both the 3D model and its
transparent tray icon, plus a compact/standard/substantial size tier, so
colourways remain distinguishable without painting symbols onto the object.
The thumbnail generator segments the dominant body material before recolouring,
so wooden skewers, fruit stems, brass rims, ceramic faces, cream labels, dark
outlines and other structural accents remain intact. Its quality gate rejects
duplicate sprites, subtle colourways, missing alpha/detail, and known
multi-material icons whose fixed accents were recoloured away.
They do not add unreviewed source files, and
documentation distinguishes the 162 gameplay identities from the 54 authored
model/icon bases.

All nine collection-goose portraits are optimized from reviewed PNG masters.
Chapter-2 portraits 7–9 were generated specifically for this project and
locally refined to true transparent alpha; they replace the former flat
procedural placeholders while keeping the volcano, cloud, and abyss accessory
specifications. The production bundle gate requires all nine portraits,
preventing a clean checkout from silently depending on stale checked-in outputs.

`scripts/verify-assets.mjs` is a release gate for the complete runtime set: it
checks the expected dimensions for 186 public images, requires alpha on all 162
per-object textures, validates every PCM WAV header and duration, and rejects a
package/manifest version mismatch.

## Audio sources

`scripts/generate-audio.mjs` synthesizes the twelve interaction cues and three
ambient loops as original PCM WAV files. No third-party or commercial game
recording is included.

## Review boundary

Gameplay rules may resemble a known three-match extraction genre. Brand marks,
commercial character designs, commercial source code, and commercial media are
outside this project's source set.
