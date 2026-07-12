# Sheep Solitaire testnet status

Checked read-only against Neo N3 testnet and the Morpheus runtime source on
2026-07-11. No transaction was sent and no contract or runtime was deployed or
updated.

## Live deployment

- Script hash: `0x7541e13629eb35ec54181be2772bff34e39d3c35`
- Manifest: `MiniAppSheepSolitaire` v2.0.0, update counter 0
- Live and local NEF checksum: `3040306411`
- Local NEF SHA-256: `2c96ccccb0e268e4498ce095b36b2e642c951fe2f1e9920610c6028d08f444be`
- Network magic: `894710606`
- TEE signer: `02911ea28aee939ef686f42e1137954135998b71e7e997794bde8c0a40f4b95cb4`
- `getConfig`, `freePool`, `reservedPool`, `isPaused`, `teeSigner`, and
  `networkMagic` all returned HALT.
- The live config matches the frontend contract mirror: entries 0.02 / 0.10 /
  0.20 GAS, rewards 0.10 / 0.50 / 1.00 GAS, limits 5 / 8 / 12 minutes,
  minimum solve times 1 / 2 / 3 minutes, 8 / 12 / 15 tile types, three layers,
  three undos, 30% undo penalty, and a 10-minute settlement grace window.
- Oracle and edge health endpoints returned HTTP 200 and ready state.

## Why new paid boards remain closed

- `freePool` is `0`, so the contract cannot reserve any advertised reward.
- The current Morpheus Sheep engine still distributes one copy of every symbol
  to each layer. That is not the constructively solvable triple-per-layer
  layout used by the production guest game and can force the seven-slot tray to
  fill before a match.
- The current session start response does not return the `bind_signature`
  required by `bindPuzzle`.
- Current move views do not return an authoritative tray. Shuffle, remove-three,
  and undo also omit result flags that the client would have to guess.
- Worker shuffle/remove-three semantics do not match the visible game: shuffle
  only consumes a use, and remove-three does not return the cards to the board.
- Worker minimum solve windows are 30 / 60 / 90 seconds while the deployed
  contract requires 60 / 120 / 180 seconds.

The released manifest therefore advertises only the local Phaser game,
publishes no paid operations or permissions, and the runtime guard rejects a
forced new paid start before wallet or transaction work. Historical chain
recovery remains implemented, but it fails closed whenever the enclave omits
the exact tray, result flags, tool counts, commitment, or settlement fields.

## Published playable path

- Phaser 3 layered tile board with 15 project-owned tile resources, a seven-slot
  tray, real mascot/table/tray assets, deal/pick/match/loss/restart motion, sound,
  and reduced-motion fallback.
- Three constructively solvable routes with complete triples assigned within a
  layer; the shuffle tool preserves that invariant.
- Exact device-local board recovery across refresh, including pile, tray,
  difficulty, deadline, tool use, local best, and completed-board count.
- Corrupt saved state is rejected and returns to a clean lobby.
- Pointer, touch, keyboard, and screen-reader mirror controls.
- Web Crypto board generation and unbiased shuffle selection with no
  `Math.random` downgrade.
- No wallet, payment, oracle, TEE, or chain write in the published guest mode.

## Paid activation checklist

- [x] Live contract generation and configured TEE signer verified read-only.
- [x] Contract config matches the frontend economic and timing mirror.
- [x] Guest game is production-playable and refresh-recoverable without a wallet.
- [ ] Port the triple-per-layer layout and coordinate/exposure rules to Morpheus.
- [ ] Return bind signature, authoritative tray, result flags, and remaining tool
  counts for every start/resume/move response.
- [ ] Align shuffle, remove-three, undo, and minimum-solve semantics.
- [ ] Fund a reward pool that covers every advertised tier.
- [ ] Run paid start, bind readback, op-log replay, restart recovery, finalize,
  exact `getGame` readback, timeout release/refund, and withdrawal on testnet.
- [ ] Enable GameFi manifests only after the full wallet/error matrix passes.
