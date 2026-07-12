# Jump Rush production status

Last verified: 2026-07-11

## Public experience

The published lane is the free local Phaser 3 game. `supportsGameFi` is false,
the public operation list is empty, and the runtime forces stale non-guest
launches back to guest mode before any wallet or chain operation can start.

- One play surface: `PlayArea.tsx` is only a compatibility alias to
  `PhaserPlayArea.tsx`; the retired DOM/CSS prototype is not a second game.
- Gameplay assets (bunny poses, carrot, clouds, and grass platforms) come from
  [Kenney's Jumper Pack](https://kenney.nl/assets/jumper-pack), published under
  Creative Commons CC0. Local file provenance is recorded in
  `public/art/ATTRIBUTION.md`.
- No artwork was copied from `IcedSoul/minigame-everyday`; its repository does
  not provide the per-resource license evidence required for production reuse.
- Local play uses Web Crypto with rejection sampling to build the route and
  does not fall back to `Math.random` or repeat a 32-byte seed pattern.
- An unfinished run is saved in namespaced framework storage and restored only
  after its route, counters, timing, and undo state pass validation. Expired or
  malformed recovery data is discarded.
- Best distance, run count, and recent local-run history persist without a
  wallet. Storage and off-chain leaderboard failures do not block gameplay.
- Pointer, touch, Space-key, keyboard-only controls, short-screen layouts,
  focus trapping, sound, and reduced-motion behavior have scoped tests.

## Wallet reward lane: intentionally unavailable

The manifest still records the existing testnet contract hash
`0xd98c65af1500cb17417db0ffd1d724f1ccd494cb` for maintenance and recovery, but
the app does not advertise or start paid games. The current contract and
Morpheus wrapper do not yet describe the same game:

1. Contract targets are 10 / 20 / 30 jumps; the wrapper targets 15 / 25 / 35.
2. Contract limits are 60 / 90 / 120 seconds; the wrapper advertises
   180 / 300 / 480 seconds.
3. Contract minimum solve times are 15 / 30 / 45 seconds; the wrapper uses
   20 / 40 / 60 seconds.
4. The contract supports three penalized undos; the wrapper declares zero and
   rejects undo operations.
5. The deployed `Solved` event has seven fields and does not publish jumps or
   perfects. The frontend now reads only those seven fields and leaves the
   unavailable perfect count unknown.
6. No current evidence proves a complete testnet sequence of payment, bind,
   every jump, undo, final signature, contract settlement, balance readback,
   reload recovery, and withdrawal against this exact schema set.
7. The current enclave route generator wraps its 32-byte stream after 16
   width/gap pairs, so its longer routes repeat an earlier pattern. Local play
   no longer has this repetition, but the paid engine must be upgraded before
   it can claim production-quality route variety.

## Activation gate

Do not enable GameFi by changing the manifest alone. First align the wrapper,
contract, and UI rules; prove the bind and settlement digest byte layouts;
decide whether undo remains part of the paid game; expose any desired history
fields explicitly; then run the full wallet/testnet recovery matrix and verify
the resulting state through contract reads and events. Only after those checks
pass should operations, payments, TEE permissions, and `supportsGameFi` be
enabled together.
