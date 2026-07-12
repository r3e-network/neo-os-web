# Screw Sort production status

- Version: `1.1.0`
- Runtime: Phaser 3 + React bridge
- Product mode: complete local/offline puzzle
- GameFi mode: intentionally unavailable

## Player experience

- The layered workshop board is the dominant surface; wallet and network controls are absent because the game does not use them.
- Four color cases accept exactly three screws each, five overflow sockets are safe, and the sixth unmatched screw loses the run.
- Board occlusion, buffer flushing, win/loss, three bounded undos, pause, deterministic restart, new puzzles, keyboard controls, sound, and reduced motion are implemented.
- A selected screw is committed immediately. Visual motion starts from the next authoritative `core.revision` and exact `MoveEvent`; no fixed-duration preview can claim success.
- Local snapshots are rebuilt by replaying the compact move trace. Impossible snapshots are reset with a visible recovery message.
- Every snapshot write is read back before recovery is promised. Throwing and silent no-op storage failures do not break local play and are reported as unavailable; practice-leaderboard failures likewise never replace the authoritative local win.

## Art and layout

- The workshop, planks, screws, cases, overflow tray, banner, and logo are original optimized raster assets with recorded provenance.
- The 400×680 logical scene scales through the shared Phaser host, rebuilds every board container after resize, and keeps the main puzzle above the secondary control rail.
- Text sits on light high-contrast surfaces; the warm workshop background remains quiet behind the foreground pieces.
- Lucide icons are used for DOM controls. No emoji, CSS-drawn game pieces, inline SVG, or copied upstream art is shipped.

## Verification gates

Run from `apps/screw-sort`:

```bash
npx vitest run --config vitest.config.ts
npx tsc --noEmit -p tsconfig.json
npx eslint src test vite.config.ts vitest.config.ts
npm run build
```

Run from the repository root:

```bash
node --test deploy/scripts/lib/screw_sort_frontend_structure.test.mjs
cd apps/shared
npx vitest run test/minigame-everyday-migrations.production.test.ts test/game-scene-polish-adoption.test.ts
```

The production build must also serve `index.html`, the JavaScript entry, and every `/art/*.webp` request over static HTTP without missing resources.

## Release boundary

Do not enable `supportsGameFi`, wallet permissions, transaction capability, oracle/TEE claims, GAS copy, or contract operations until a deployed and funded design has its own authoritative settlement, durable pending journal, exact event/readback verification, testnet recovery evidence, and independent product review.
