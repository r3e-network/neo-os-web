# Bead Workshop

Bead Workshop is a production Phaser 3 puzzle miniapp built around a tactile 14×14 craft board with 140 active sockets. Players select a connected mismatched patch, place it into a matching empty region, or park the complete patch in a 14-slot tray. Correctly placed beads lock in place.

## Production loop

- Deterministic seeded generation with a constructive solution certificate.
- Full-patch, fail-closed board and tray moves; no silent partial removal.
- Color-filtered FIFO tray placement, five-step undo, pause, timeout, deadlock detection, restart confirmation, and safe reload recovery.
- Phaser-native touch, mouse, and keyboard input with animated batch movement, reduced-motion handling, concise live-region announcements, and shared procedural sound.
- Bright original workshop artwork and resin-bead assets with high-contrast foreground panels.
- Entirely local play. The app has no wallet prompt, contract, transaction, token, oracle call, or paid mode.

## Reference audit

The interaction model was behaviorally audited against [`day-06-beads`](https://github.com/IcedSoul/minigame-everyday/tree/73bb72fa6b144148fc7c7e93c83ffd47f3d9f173/day-06-beads) at commit `73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`.

The reference repository root README describes the project as MIT, but the audited commit does not contain a `LICENSE` file. For that reason, this implementation uses the reference only to study its public gameplay behavior. It does not copy the reference Canvas architecture, source code, screenshots, or unknown-provenance imagery. All TypeScript, Phaser rendering, puzzle generation, recovery behavior, copy, and shipped visual assets in this app are original work for this repository.

This repository itself is distributed under the root [MIT License](../../LICENSE).

## Controls

- Tap/click a mismatched bead patch to select it.
- Tap/click a matching empty socket region to place the whole patch.
- Use **Move to tray** or tap the tray after selecting a board patch to park it.
- Select a tray bead color, then choose a matching empty socket region.
- Keyboard: arrows move focus, Enter/Space activates, Tab switches board/tray, T moves to tray, U undoes, P pauses, and R opens restart confirmation.

## Development

```bash
npm --prefix apps/bead-workshop run dev -- --port 5341
npx tsc -p apps/bead-workshop/tsconfig.json --noEmit
npx vitest run apps/shared/test/bead-workshop.engine.test.ts apps/shared/test/bead-workshop.production.test.ts
npm --prefix apps/bead-workshop run build
```

See [`public/art/ATTRIBUTION.md`](public/art/ATTRIBUTION.md) for asset provenance.
