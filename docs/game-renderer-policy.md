# Game renderer policy

The platform standardizes the **game contract**, not every game onto one renderer.

## Default choice

- Use **Phaser 3** for 2D and 2.5D games: sprites, cards, boards, tile maps,
  arcade motion, tweens, particles, audio, touch input, pause/resume, and compact
  mobile scenes.
- Use **Three.js** only when spatial depth is part of the core mechanic: a 3D
  camera, ray-picked objects, real depth occlusion, skeletal/mesh animation, or
  a physics world that cannot be represented honestly as a 2D scene.
- Do not migrate an existing production Phaser game to Three.js merely to make
  engine names uniform. That would add bundle cost and force each game to
  rebuild 2D scene, input, audio, layout, and accessibility behavior without
  improving its core loop.

`zhuada-e` remains the current Three.js exception because picking objects from a
real 3D pile is the game. The other current mini-games stay on Phaser 3.
The current 17-game Phaser roster is enforced by
`deploy/scripts/lib/phaser_game_suite_frontend_structure.test.mjs`, including
the lazy scene boundary and a guard against pulling Three.js into a 2D bundle.

## What is unified

Every renderer must use the same platform boundary:

- `GameBridge` state snapshots and dispatch actions;
- deterministic game rules and replay/recovery data outside the renderer;
- wallet, contract, oracle, VRF/TEE, and reward services outside the scene;
- lifecycle states for loading, ready, paused, failed, unknown settlement, and
  retry;
- keyboard/touch semantic controls and an accessible DOM fallback;
- shared official NEO/GAS assets, localization, reduced motion, sound controls,
  telemetry, and production error reporting.

The scene visualizes and collects input. It must never be the source of truth
for balances, rewards, settlement success, or oracle verification.

## Production gate

A renderer choice is accepted only when the game proves:

1. a playable mobile and desktop core loop, not a form wrapped around a canvas;
2. deterministic or server-verifiable rules and refresh recovery;
3. lazy loading of the renderer chunk and no eager 3D dependency in 2D apps;
4. stable resize, pause, background/foreground, reduced-motion, and audio paths;
5. attributed production assets with clear foreground/background contrast;
6. fail-closed GameFi behavior until contract and oracle paths are verified.
