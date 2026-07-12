# 2048 Rush production status

Updated: 2026-07-11

## Playable product

- Published mode: free local Phaser 3 game.
- Three routes target 512, 1024, and 2048 with distinct timers.
- Keyboard, swipe/pointer, semantic move controls, sound, reduced-motion, and
  responsive camera scaling are implemented.
- Illustrated building tiles replace a form-style surface. Slide, merge, spawn,
  win, dead-board, and restart feedback run inside the game scene.
- Each local board has three undos. The active board, timer, undo count, best
  tile, and recent run history persist on the device and recover after reload.
- Local spawns use rejection-sampled Web Crypto randomness and refuse to start
  when secure randomness is unavailable.

The tile motion model follows the MIT-licensed original 2048 mechanics. Asset
provenance is recorded in `public/art/ATTRIBUTION.md` and
`docs/MINIAPP_GAME_ASSET_CREDITS.md`. No code or art was copied from
`IcedSoul/minigame-everyday` because that repository has no clear root license.

## TestNet read-only evidence

Contract: `0x7511eefa066820a440db5f94d9cbc1d711a598f9`

| Check | Observed value |
| --- | --- |
| Contract name | `MiniAppGame2048` |
| Live NEF checksum | `1503512825` |
| Local reviewed NEF checksum | `1503512825` |
| Manifest version | `3.0.0` |
| Update counter | `0` |
| Network magic | `894710606` |
| Paused | `false` |
| Daily start cap | `8` |
| Pool / reserved / free | `0 / 0 / 0 GAS` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |
| Oracle and Edge health | ready |

The live config matches the three entry amounts, rewards, timers, target
exponents, three-undo cap, 30% paid-lane undo penalty, and 10-minute settlement
grace mirrored by the client.

## GameFi release gate

`supportsGameFi` remains `false`; the public manifests expose no wallet
operation, transaction permission, Oracle, or TEE claim. The deployed pool is
empty, so a paid start cannot be honored. Re-enable only after funding and a
real wallet -> start -> TEE moves -> finalization callback -> credit withdrawal
run succeeds against this exact checksum.

Existing recovery code remains in place for prior sessions. Expiry and
withdrawal never treat a wallet broadcast as final: the client keeps the exact
game id until a terminal contract readback, and withdrawal requires either the
matching `CreditWithdrawn` event or a zero-credit readback.

## Verification

- Game-scoped Vitest: 38 tests passed.
- Game 2048 contract and integration suite: 23 tests passed.
- TypeScript and ESLint: passed.
- Production build: passed.
- Morpheus contract/Oracle/runtime liveness: passed.
- Scoped `git diff --check`: passed.

The remaining visual checkpoint is a real rendered mobile/desktop interaction
pass in the approved in-app browser; this run did not use Chrome or Playwright.
