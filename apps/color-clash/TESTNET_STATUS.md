# Color Clash production and testnet status

Checked: 2026-07-11 (Neo N3 testnet, read-only)

## Player-facing result

- The shipped lane is a complete local Phaser 3 Simon-style memory game.
- Touch/pointer players can use the authored console or the four tactile pad
  resources. Keyboard players can use the semantic controls, `1`-`4`, numpad
  `1`-`4`, or `R B G Y`.
- The sequence grows one cue per cleared round. The three modes use 8, 12, and
  16 cue targets with progressively faster playback and balanced 2, 3, and
  5 minute clocks.
- Guest sequences use `crypto.getRandomValues`; the game refuses to create a
  sequence when secure browser randomness is unavailable.
- Wrong, round-clear, and win states have distinct sound, light, camera, and
  scale feedback. Essential cue lighting remains visible with reduced motion.
- Game art is generated specifically for this app and recorded in
  `public/art/ATTRIBUTION.md`. No assets were copied from
  `IcedSoul/minigame-everyday`; its current game list has no corresponding
  Simon/color-memory implementation.

## Live read-only evidence

Contract: `0xb2d0f46da6981e4613ce8476eadcc1ea26f9858f`

- Contract name: `MiniAppColorClash`
- Update counter: `0`
- Live NEF checksum: `2935733434`
- Local reviewed NEF checksum: `2935733434`
- Manifest version: `3.0.0`
- Oracle: `0x4b882e94ed766807c4fd728768f972e13008ad52`
- Oracle and edge health endpoints: ready
- Contract paused: `false`
- Pool balance: `0` base units
- Reserved pool: `0` base units
- Free pool: `0` base units
- `getConfig` exactly matches the frontend entry, reward, time, target,
  max-undo, penalty, and settlement-grace rules.

No transaction, deployment, contract update, or token transfer was performed.

## Why GameFi remains closed

The public manifests, launcher, and runtime independently keep paid entry
disabled. Two concrete blockers remain:

1. The live reward pool is empty, so no paid run can be fully reserved.
2. The current Morpheus color wrapper returns `startView.sequence === ""`.
   The first press cannot be played fairly because the player has not received
   the first cue. The frontend intentionally requires one valid initial cue and
   fails closed when it is absent. The adjacent Oracle repository's focused
   test `color: empty start sequence; colours arrive per-round; finalize on seq`
   confirms this is the current protocol, not a transient frontend failure.

The production tests pin the exact local artifact checksum and ABI, while the
dormant recovery path pins the contract hash, Oracle, contract configuration,
TEE identity/configuration, wallet, game id, difficulty, start event/readback,
settlement event/readback, and withdrawal event/credit readback. The independent
paid-run gate remains false, so a checksum or ABI drift cannot expose a wallet
action. An uncertain transaction stays recoverable instead of being displayed
as a win or inviting another payment.

## Gates before enabling paid play

1. Change the Morpheus color protocol to reveal the first cue at session start,
   or add a verified non-scoring reveal operation. Update the reviewed engine
   hash if the wrapper changes.
2. Re-run the session-host first-cue, progressive-round, replay, wrong-press,
   timeout, and finalize tests.
3. Fund enough free pool for the maximum concurrent Master Circuit liability.
4. Complete a wallet-funded testnet matrix: start, reopen, correct/wrong input,
   reload replay, success settlement, zero-payout settlement, timeout release,
   wallet change, withdrawal, and indexer/RPC recovery.
5. Re-attest the live NEF checksum, manifest version, exact ABI signatures, and
   Oracle immediately before changing any wallet permission.
6. Only after those gates pass, change both manifest surfaces and
   `NEW_PAID_RUNS_ENABLED` together.

## Verification commands

```text
cd apps/shared
npx vitest --config vitest.config.ts run \
  test/color-clash.engine.test.ts \
  test/color-clash.guest-engine.test.ts \
  test/color-clash.phaser-playarea.test.tsx \
  test/color-clash.production-safety.test.ts

cd apps/color-clash
npx tsc -p tsconfig.json --noEmit
npx eslint src --max-warnings 0
npm run build

node deploy/scripts/live_validate_morpheus_game_liveness.mjs color-clash
```
