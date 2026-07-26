# MiniApp Game Asset Credits

This file records the source material used to rebuild the game miniapp banner
and logo assets. The generated assets are flattened into each miniapp's
`public/` directory and mirrored into `platform/host-app/public/miniapp-assets/`
so the same visual identity is used by the standalone MiniApp Platform catalog
and OneGate-hosted dApp launches.

## Source Packs

- Flappy Dash: `flappy-bird-assets` by Samuel Custodio, MIT License.
  Source: https://github.com/samuelcust/flappy-bird-assets
- 2048 Rush: `2048` by Gabriele Cirulli, MIT License.
  Source: https://github.com/gabrielecirulli/2048
- Sudoku: `sudoku-python` by Alexandre Cirilo, MIT License.
  Source: https://github.com/alxdrcirilo/sudoku-python
- Platformer, board game, puzzle, and animal source material: Kenney asset
  packs, CC0.
  Source: https://kenney.nl/assets
- Snake Bounty snake board sprites: `Snake game assets` by Clear_code, CC0.
  Source: https://opengameart.org/content/snake-game-assets
- Curve Arrow sprites, logo, and banner: original in-repo vector art (layered
  SVG compositions rasterized to webp with sharp); no external asset packs.
  See `apps/curve-arrow/public/art/ATTRIBUTION.md`.
- Gomoku board, stones, markers, and difficulty crests: original in-repo vector
  art (layered SVG compositions rasterized to webp with sharp); no external
  asset packs. See `apps/gomoku/public/art/ATTRIBUTION.md`.

## App Mapping

- `aim-master`: project-authored target board, reticle, badges, and range
  backdrop generated for this app with OpenAI image generation. See
  `apps/aim-master/public/art/ATTRIBUTION.md`.
- `color-clash`: project-authored Simon-style memory console, four tactile pad
  controls, difficulty badges, and warm arcade table generated for this app;
  no third-party game art is used by the Phaser scene. See
  `apps/color-clash/public/art/ATTRIBUTION.md`.
- `curve-arrow`: dawn archery-range scene (curving golden arrow trail, stone
  pillars, recurve bow, and FITA target board) built from original in-repo
  vector art.
- `flappy-dash`: native flappy clone scene using bird, pipe, sky, and ground
  sprites from `flappy-bird-assets`.
- `game-2048`: native 2048 board styling based on the original MIT 2048 tile
  palette and board layout.
- `gomoku`: project-authored lacquered board panel, woven table backdrop,
  polished black and white stones, last-move ring, winning-line glow, victory
  seal, and difficulty crests, all generated in-repo by
  `scripts/generate-gomoku-art.mjs`. Every draw site falls back to the scene's
  vector primitives when a texture is unavailable. See
  `apps/gomoku/public/art/ATTRIBUTION.md`.
- `jump-rush`: platformer level scene using Kenney Platformer Art assets.
- `merge-kingdom`: project-authored 12-stage building set generated for this
  app with OpenAI image generation. See
  `apps/merge-kingdom/public/art/ATTRIBUTION.md`.
- `pet-potion`: project-authored nursery, pet stages, care tools, and route
  badges generated for this app with OpenAI image generation. See
  `apps/pet-potion/public/art/ATTRIBUTION.md`.
- `sheep-solitaire`: project-authored layered tiles, mascot, tray, badges, and
  meadow table generated for this app with OpenAI image generation. See
  `apps/sheep-solitaire/public/art/ATTRIBUTION.md`.
- `snake-bounty`: snake-grid scene using snake sprites and apple pickups.
- `sudoku`: Sudoku board scene using the MIT Sudoku sample and a rendered
  board panel.
- `dice-game`: dice-table scene using OpenGameArt `Simple Dice 2` and `Poker
  Chips Only 2D` (CC0), with the attributed `Fantasy Dices Pack` hero die
  (CC BY 4.0) and an app-specific generated banner. See
  `apps/dice-game/public/art/ATTRIBUTION.md`.
- `fogplay`: project-authored Heads/Tails coin faces, landing pedestal, and
  launcher media; runtime WebP files are optimized derivatives. Official GAS
  artwork comes from the shared token component. See
  `apps/fogplay/ASSET_PROVENANCE.md`.
- `gas-lucky-pool`: project-authored warm mint-and-gold vault stage and OneGate
  launcher media. GameFi token marks resolve through the shared official GAS
  token asset; the local points lane uses the existing OneGate mark. No art or
  implementation was copied from `IcedSoul/minigame-everyday`. See
  `apps/gas-lucky-pool/ASSET_PROVENANCE.md`.
- `burn-league`: repository-owned warm gold-and-mint arena, league cauldron,
  trophy, and launcher media; runtime fuel marks use the shared official GAS
  token asset. No code or art was copied from `IcedSoul/minigame-everyday`.
  See `apps/burn-league/ASSET_PROVENANCE.md`.
