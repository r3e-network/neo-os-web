# Pet Potion production status

Updated: 2026-07-11

## Playable product

- Published mode: complete free local Phaser 3 pet-care and potion game.
- The nursery uses project-authored pet stages, care tools, route badges, and a
  full illustrated lab instead of a form-style control surface.
- Feed, play, pet, and rest change satiety, energy, happiness, evolution, and
  recipe essences. A win requires the target happiness, all four essences, an
  explicit brew, and settlement within the 40-action and route-time limits.
- Touch, semantic keyboard controls, audio, short-screen layout, and
  reduced-motion are supported.
- The current nursery, timer, difficulty, action history, stats, recipe, and
  brewed state auto-save on the device and recover after reload. Best happiness
  and recent results persist separately.
- A 40-action miss can be closed immediately; it no longer leaves the player
  trapped behind disabled care tools.

Asset provenance is recorded in `public/art/ATTRIBUTION.md`. The nursery and
care resources were generated for this project with OpenAI image generation.
No code or resources were copied from `IcedSoul/minigame-everyday` because that
repository has no clear root license.

## TestNet read-only evidence

Contract: `0xa611f038371f49b6e46c992e9aa95f53d6ac2b38`

| Check | Observed value |
| --- | --- |
| Contract name | `MiniAppPetPotion` |
| Live NEF checksum | `900775675` |
| Local reviewed NEF checksum | `900775675` |
| Manifest version | `3.0.0` |
| Update counter | `0` |
| Network magic | `894710606` |
| Paused | `false` |
| Daily start cap | `8` |
| Pool / reserved / free | `0 / 0 / 0 GAS` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |
| Oracle callback allowlist | `false` |
| Oracle fee credit | `0 GAS` |
| Oracle request fee | `0.01 GAS` |
| Oracle and Edge health | ready |

The live contract config matches the client entry/reward values, 3/5/10-minute
timers, 30/60/120-second minimum solve times, 50/70/100 happiness targets,
three-undo cap, 30% paid-lane undo penalty, and 10-minute settlement grace.

## GameFi release gate

`supportsGameFi` remains `false`; the public manifests expose no wallet
operation, transaction permission, Oracle, or TEE claim. A paid run cannot work
while the pool is empty, the callback contract is not allowlisted, and the app
has no Oracle fee credit. Re-enable only after those conditions are corrected
and a real wallet -> start -> TEE care log -> callback -> credit withdrawal run
succeeds against this exact checksum.

Historical paid-run recovery remains in the runtime. New paid starts have an
independent code-level kill switch, and unknown settlement is never rendered as
a win.

## Verification

- Game-scoped Vitest: 52 tests passed.
- Pet Potion contract suite: 17 tests passed.
- TypeScript and ESLint: passed.
- Production build: passed.
- Morpheus contract/Oracle/runtime liveness: passed.

The remaining visual checkpoint is a real mobile/desktop interaction pass in
the approved in-app browser; this run did not use Chrome or Playwright.
