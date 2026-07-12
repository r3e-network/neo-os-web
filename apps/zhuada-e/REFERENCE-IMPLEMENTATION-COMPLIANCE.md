# Goose Basket Shuffle reference implementation compliance

Last reviewed: 2026-07-11

This file records how `zhuada-e` uses public "抓大鹅-like" references safely.
The product goal is a close, playable genre implementation, not a copy of the
commercial game or an unlicensed community repository.

## Current external reference status

| Reference | Current status | Safe use in this project |
|---|---|---|
| Juejin article: `https://juejin.cn/post/7375090667732680758` | Current fetch reached the Juejin wait/interstitial page, so no source text was imported into this repository. | Treat as a named public learning reference only. Do not copy article code or assets unless a separate license review records a usable license and attribution. |
| CSDN article: `https://blog.csdn.net/weixin_62328265/article/details/139375756` | Page is marked `CC 4.0 BY-SA`; it describes the general loop as Three.js + Cannon.js, 3D objects in a box, click extraction, three-of-kind clear, slot-full loss. | Use only uncopyrightable gameplay ideas and architecture comparison. Do not copy the Vue source, textures, screenshots, or prose into the shipped app. |
| Gitee `hanshuoggg/big-goose`: `https://gitee.com/hanshuoggg/big-goose` | Repository page currently says it does not specify a license. | Excluded from production reuse. Do not copy code, art, configs, generated binaries, or project structure from it. |
| Commercial WeChat "抓大鹅" game | Commercial proprietary game; no open-source release known in the reviewed materials. | Do not extract or reproduce art, sound, logo, name/brand presentation, package assets, or source code. Use original assets and original implementation. |

## What this project is allowed to reuse

- Genre mechanics: a pile of physically simulated 3D objects in an open
  container, item extraction, seven-slot collection, three-of-kind clearing,
  tray-full failure, refill/streaming for long levels, and shake/toss
  interaction.
- High-level technical architecture: Three.js rendering paired with Cannon-style
  rigid-body simulation and raycast picking.
- Publicly observable interaction timing goals, such as making pickup, match,
  clear, refill, and shake actions readable rather than instantaneous.

## What this project must not reuse

- Commercial game artwork, models, textures, sound effects, UI screenshots,
  names, logos, mascot identity, package files, or executable assets.
- Code from repositories or articles unless a license review explicitly permits
  the intended use and the required notices/attribution are added.
- Assets from community demos that lack per-file provenance.
- Confusing brand presentation that would make this app appear to be the
  original commercial game.

## Current implementation boundary

- Runtime art is generated from this repository's reviewed `art-src/` masters.
  `ASSET_PROVENANCE.md` and `art-src/SOURCE_MANIFEST.md` are the source of truth.
- Runtime audio is synthesized by `scripts/generate-audio.mjs`; no third-party
  samples or commercial recordings are included.
- Physics, tray rules, streaming, shake dynamics, motion choreography,
  persistence, and QA tooling are implemented in this repository and verified by
  `npm run verify:release`.
- Third-party library notices are limited to actual runtime dependencies in
  `THIRD_PARTY_NOTICES.md` and `public/THIRD_PARTY_NOTICES.txt`.

## Release rule

If a future iteration copies or ports code/assets from any public reference, it
must update this file, add the precise source URL and commit/date, add license
text and attribution where required, and rerun `npm run verify:release`.
