# FogPlay — Phaser Coin Flip on Neo N3

FogPlay is a tactile coin-flip game with a production local mode and a retained,
currently disabled GameFi implementation:

- **Local play** needs no wallet, GAS, oracle, or chain call. Pick a side, toss the authored coin, and build a win streak.
- **GameFi** uses the standalone `MiniAppCoinFlipV2` commit/reveal contract, but remains fail-closed because the public deployments do not match the currently reviewed artifact.

The playable surface is a Phaser 3 table, not a transaction form. Authored heads/tails artwork, an animated pedestal, launch/flip/land motion, sound cues, concise results, and an in-game recovery drawer carry the primary flow.

## Retained Paid-Flip Design

1. Choose heads or tails and one of the table chips.
2. `commit(player, choice, amount)` escrows prepaid GAS and reserves the house exposure.
3. Wait for the complete three-block beacon window. The outcome is not known at commit time.
4. Anyone may call `settle(betId)` after the window clears. The contract derives the fixed result from the three later block hashes and pays a winner 2x.
5. If indexing or settlement is interrupted, the exact transaction, player, contract, network, choice, and amount remain persisted for a safe retry.
6. Unused prepaid credit can be returned with `withdraw(account)`.

The multi-block beacon closes the old same-transaction abort-on-loss exploit and increases grinding cost over a single-block source. It is intentionally a low-stakes mechanism, not VRF-grade randomness.

This architecture is retained for the next compatible deployment. It is not an
active wallet-funded product claim.

## Production Safety Boundary

- `supportsGameFi`, payment/randomness permissions, host operations, and the runtime paid-lane flag are disabled.
- A wrong network, stale host, or old contract cannot open a wallet prompt for a new wager.
- `Committed` may recover the exact bet id, but a `Settled` event or transaction broadcast never confirms a result.
- Win/loss is applied only after exact `getPendingBet` readback validates id, player, choice, wager, terminal state, outcome, win predicate, and payout.
- A settlement must match the pending bet id, player, choice, outcome, win flag, and exact 0x/2x payout.
- Existing pending bets and prepaid credit keep their reveal/withdraw recovery paths.
- The published manifest exposes no generic operation form.

## Contract

| Item | Value |
| --- | --- |
| Contract | `MiniAppCoinFlipV2` |
| Published binding | Neo N3 testnet (read-only compatibility reference) |
| Script hash | `0x611c3d97dd98792a3c31a0e695704c657f143cda` |
| Bet range | 0.05–100 GAS, additionally capped by `freeBankroll / 2` |
| Randomness | Fixed three-block native beacon after commit |
| Mutations | `commit`, `settle`, `withdraw` |
| Reads | `bankroll`, `reservedBankroll`, `freeBankroll`, `creditOf`, `getStats`, `getPendingBet`, `playerBetCount`, `getPlayerBets` |

The July 10 harness validated the artifact deployed at that time. Current
read-only verification shows that both public deployments report checksum
`2385475183`, while the currently reviewed local artifact reports `4009970425`
and exposes a different ABI. The historical write report therefore does not
prove the current build is deployed. See `TESTNET_STATUS.md` and
`docs/reports/fogplay-v2-testnet-live-2026-07-10.md`.

No transaction, key use, deployment, or update is part of this frontend pass.

## Development

```bash
cd apps/fogplay
npm install
npm run dev
npm test -- --run
npx tsc --noEmit
npx eslint src
npm run build
```

Contract tests:

```bash
cd contracts/__tests__
dotnet test NeoContracts.Tests.csproj \
  --filter FullyQualifiedName~MiniAppCoinFlipV2Tests
```

## Stack

- React + TypeScript miniapp shell
- Phaser 3 playable scene
- Neo N3 C# smart contract
- N3Index/RPC reads
- Browser Web Crypto for local-play randomness

## License

MIT License — R3E Network
