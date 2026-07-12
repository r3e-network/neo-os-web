# Fruit Funnel

Fruit Funnel is a production-oriented Phaser 3 orchard puzzle. The player acts on illustrated fruit, not a parameter form: tap the front fruit on one of six hanging vines, watch it roll through the carved funnel, and keep the seven-compartment basket from overflowing.

## Rules

- A seeded deal contains exactly 48 fruit: eight fruit on each of six vines and four pairs of each fruit kind.
- Tapping a vine releases only its front fruit into the chute.
- This is an adjacent **pair** rule, not match-three: when the two newest neighboring fruit have the same kind, both clear immediately.
- The round is won after all 24 pairs clear. Reaching seven uncleared fruit loses the round. The clock starts at four minutes.
- Every fresh seed is built with a constructive zero-overflow completion witness. The Hint action runs a bounded memoized solver against the current board and highlights a move only when it can prove a non-overflow completion. If no completion is proven, the game honestly recommends Undo or a new orchard.

## Controls and recovery

- Touch/click: select the front illustrated fruit, or use the compact Undo, Hint, and Pause controls.
- Keyboard: `1`–`6` release the corresponding vine, `H` requests a hint, `U` undoes, `P` or Space pauses, and `R` opens a new orchard.
- Undo stores up to five board states. It never rewinds elapsed time.
- Leaving the page pauses an active round. A refresh restores an active round in the paused state, without charging hidden/background time.
- Malformed or unavailable local storage is rejected safely and replaced with a fresh certified deal.
- Motion uses the shared reduced-motion preference, and sound remains user-controlled through the Phaser host.

## Guest-only boundary

This version explicitly forces guest mode. It exposes no wallet, payment, reward, oracle, randomness permission, contract operation, transaction, or GameFi settlement state. Those lanes must remain closed until a real contract path is deployed and verified end to end.

## Artwork and reference boundary

All runtime artwork is original ImageGen output created for Fruit Funnel. The public reference was used only to study the six-column release geometry and adjacent-pair mechanism. No reference source, screenshot, Canvas architecture, or unknown-provenance artwork is copied. See [public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md).

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

Exercise a release, a certified pair, seven-slot overflow, Undo recovery, Pause/Resume, refresh recovery, sound, reduced motion, and both 390×844 and desktop layouts.
