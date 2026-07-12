# Garden Arrowworks

Garden Arrowworks is a guest-first Phaser 3 dependency puzzle. Every arrow owns
two to four grid cells and can escape only when its forward ray contains no
remaining arrow. The generated dependency graph is a DAG, and every published
seed carries a complete removal witness.

## Player loop

1. Tap an arrow with a clear route from its head to the board edge.
2. A free arrow slides out and may open new escape routes.
3. A blocked arrow bumps back and costs one of three shields.
4. Clear the board before the two-minute clock expires.

Pinch, pan, mouse-wheel, and the accessible zoom rail support dense boards.
Pause, same-seed replay, new-seed play, reduced motion, sound preference, and
validated refresh recovery are included.

## Determinism and recovery

- `SeededRandom` is the only generator randomness source.
- Each 9×12 level covers 100% of the grid with 36–42 arrows.
- Cyclic orientation assignments are rejected.
- `solveLevel` records a direct solution witness, and `verifyWitness` replays it.
- Saved runs contain the seed and legal removal history, not a trusted client
  claim. Restore regenerates the level and verifies each removal before use.
- Visibility changes and normal unmounts settle and pause the active foreground
  clock. Crash recovery preserves the last settled elapsed segment and resumes
  only after the player explicitly returns, so background wall time is never
  double-counted.

## GameFi boundary

The complete release is local and wallet-free. The manifest exposes no payment,
oracle, randomness, compute, transaction, or reward operation. GameFi, token
rewards, VRF, and TEE settlement remain fail-closed until a real deployed
contract/service path has production evidence.

## Development

```bash
npm run dev
npm run build
```

See [ATTRIBUTION.md](./ATTRIBUTION.md) for the algorithm reference and original
asset provenance.
