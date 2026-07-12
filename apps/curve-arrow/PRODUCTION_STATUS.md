# Curve Arrow production status

Version: `1.0.0`  
Verification date: 2026-07-11

## Product result

- Curve Arrow is a real Phaser 3 archery game: choose one of three ranges,
  press and hold to curve the illustrated arrow around stone walls, release to
  level its flight, and replay for a better local score.
- The scene uses attributed bow, arrow, target, wall, range, difficulty, and
  reward artwork. Input cleanup, reduced-motion handling, responsive scene
  reconstruction, animated launch/impact states, and accessible control and
  result announcements are part of the runtime.
- Complete guest play is available without a wallet. New paid runs, rewards,
  Oracle, and TEE claims are disabled because no production Curve Arrow
  contract and settlement path is configured. Historical identity-bound
  recovery remains fail-closed and does not turn an unknown settlement state
  into a reward.

## Verification evidence

- Engine, guest, Phaser wrapper, PlayArea, and production-safety suite: 47/47
  tests passed.
- TypeScript and scoped ESLint passed.
- Production build passed with 1,858 modules. Phaser and the scene are lazy
  chunks; importing `PlayStage` directly removed the unrelated 136.83 kB UI
  CSS vendor payload from the game build.
- Runtime art provenance is recorded in
  [public/art/ATTRIBUTION.md](./public/art/ATTRIBUTION.md).

No wallet connection, transaction, deployment, browser automation, host copy,
git staging, or `zhuada-e` file was used in this verification pass.
