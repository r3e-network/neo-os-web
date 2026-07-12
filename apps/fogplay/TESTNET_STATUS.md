# FogPlay deployment status

Last read-only verification: 2026-07-11 (Neo N3 mainnet and testnet).

## Public bindings

- Mainnet and testnet manifests point to
  `0x611c3d97dd98792a3c31a0e695704c657f143cda`.
- Both RPCs report contract name `MiniAppCoinFlipV2`, NEF checksum
  `2385475183`, and the expected `commit`, `settle`, `withdraw`, bankroll,
  credit, stats, history, and `getPendingBet` methods.
- Testnet reads halted successfully with bankroll/free bankroll `7 GAS`,
  reserved bankroll `0`, pending bet count `0`, and last bet id `3`.
- Mainnet reads halted successfully with bankroll/free bankroll `2 GAS`,
  reserved bankroll `0`, pending bet count `0`, and last bet id `0`.
- Testnet bet `3` read back as settled with an exact `1 GAS` wager and `2 GAS`
  payout. This confirms the deployed snapshot is internally readable; it does
  not establish compatibility with the current source artifact.

## Why wallet GameFi remains disabled

The current `contracts/build/MiniAppCoinFlipV2.nef` checksum is `4009970425`.
Its ABI contains `update` and `getOwner`, which are absent from both public
deployments. A prior signed testnet flow validated the older deployed snapshot,
not the byte-for-byte artifact currently under review.

FogPlay therefore publishes guest mode only. Payment and randomness permissions,
generic host operations, transaction capability, and the runtime paid-lane flag
all remain disabled. Local animation and browser randomness are practice play;
they never produce or confirm a GameFi result.

## Activation gate

Before re-enabling GameFi:

1. Deploy or update the reviewed `MiniAppCoinFlipV2` artifact on the intended
   network.
2. Match the deployed NEF checksum and ABI to the reviewed build output.
3. Re-run bankroll, reserved exposure, pending count, history, and exact-bet
   readback checks.
4. Run one explicitly authorised testnet `credit/deposit -> commit -> fixed
   three-block beacon -> settle -> getPendingBet -> withdraw` flow.
5. Confirm exact contract, network, transaction, player, choice, Fixed8 wager,
   terminal state, outcome, win predicate, payout arithmetic, and zeroed credit.
6. Re-enable source, published, and host permissions together.

No transaction, key use, deployment, or contract update was performed during
the 2026-07-11 verification.
