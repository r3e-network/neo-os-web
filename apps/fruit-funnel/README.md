# Fruit Funnel

Fruit Funnel is a production-oriented Phaser 3 physics fruit-merge game. The player acts on illustrated fruit, not a parameter form: move the next fruit along the top, drop it, watch real gravity stack it in the funnel, and merge two of the same kind into the next bigger fruit — all without letting the pile settle above the danger line.

## Rules

- Drop the current fruit by moving it horizontally at the top and releasing. Only the five smallest kinds are ever dropped.
- Physics is real Matter.js simulation: fruit fall under gravity, collide, and stack. When two fruit of the same kind touch, they merge into the next bigger fruit and award score along an eleven-tier evolution chain (cherry → watermelon).
- Chain merges for bigger scores. Two watermelons merge and clear for a bonus.
- The run ends when stacked fruit comes to rest above the top danger line past a short grace period. Your local best score is kept across runs.

## Controls and recovery

- Touch/click: drag to aim across the top, tap to drop. Compact Pause and New game controls stay reachable.
- Keyboard: Arrow keys or `A`/`D` move the aim, Space or Enter drops, `P` pauses, and `R` starts a new game.
- The board — not the physics scene — is the single source of truth and checkpoints locally, so a refresh restores the exact pile in a paused state without charging hidden/background time.
- Malformed or unavailable local storage is rejected safely and replaced with a fresh run.
- Motion uses the shared reduced-motion preference, and sound remains user-controlled through the Phaser host.

## Guest-only boundary

This game runs entirely local and explicitly forces guest mode. It exposes no wallet, payment, reward, oracle, randomness permission, contract operation, transaction, or GameFi settlement state. Those lanes must remain closed until a real contract path is deployed and verified end to end.

## Artwork and reference boundary

All runtime artwork is original ImageGen output created for Fruit Funnel: a real orchard backdrop and hand-generated fruit sprites. The public reference was used only to study the drop-and-merge physics mechanism. No reference source, screenshot, Canvas architecture, or unknown-provenance artwork is copied. The user-facing name is original and does not reuse any third-party product name. See [public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md).

## Verification

From the repository root:

```bash
npm --prefix apps/fruit-funnel run build
npx tsc -p apps/fruit-funnel/tsconfig.json --noEmit
npx eslint apps/fruit-funnel/src apps/shared/test/fruit-funnel*.test.ts
(cd apps/shared && npx vitest run test/fruit-funnel.engine.test.ts test/fruit-funnel.storage.test.ts test/fruit-funnel.browser-entry.test.ts test/fruit-funnel.production.test.ts test/fruit-funnel.phaser-playarea.test.tsx test/fruit-funnel.scene.test.ts test/fruit-funnel.scene-runtime.test.ts test/minigame-everyday-migrations.production.test.ts)
jq empty apps/fruit-funnel/neo-manifest.json
```

For visual QA:

```bash
npm --prefix apps/fruit-funnel run dev -- --port 5342
```

Exercise a drop, a merge, a chain merge, danger-line game over, Pause/Resume, refresh recovery, sound, reduced motion, and both 390×844 and desktop layouts.
