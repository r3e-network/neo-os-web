# Dice Game deployment status

Last read-only verification: 2026-07-11 (Neo N3 mainnet and testnet).

## Current public bindings

- Mainnet and testnet manifests both point to `0xef1fac0247ccbad5810e3fcfa1a0885d44efde39`.
- Both RPCs report contract name `MiniAppDiceGameV2` and the expected `commit`,
  `settle`, `withdraw`, `bankroll`, `freeBankroll`, `reservedBankroll`,
  `creditOf`, `pendingBetCount`, and `getPendingBet` methods.
- Testnet readback halted successfully with bankroll/free bankroll `9.7 GAS`,
  reserved bankroll `0`, and pending bet count `0`.
- Mainnet readback halted successfully with bankroll/free bankroll `5 GAS`,
  reserved bankroll `0`, and pending bet count `0`.
- Neo X mainnet RPC reported chain id `0xba93` and 6,284 bytes of deployed code
  at `0xFA795F814d38F218153d21838360096f3F5cb774`. This proves code presence only;
  it does not prove ABI, VRF callback, request binding, or settlement semantics.

## Why wallet GameFi remains disabled

The deployed contract NEF checksum on both networks is `1347753558`. The
currently built `contracts/build/MiniAppDiceGameV2.nef` checksum is
`4151519179`, and its manifest includes an `update` method that is absent from
the deployed ABI. The public contract can answer compatible reads, but it is not
the byte-for-byte artifact currently under review. A previous signed testnet
flow therefore does not prove that the present audited artifact is deployed.

The MiniApp remains guest-only and exposes no payment permission or wallet-funded
operation until this compatibility gap is closed. Local animation and local
randomness are practice play only; they never produce a chain-verified result.

## Activation gate

Before re-enabling GameFi:

1. Deploy or update the reviewed V2 artifact on the intended network.
2. Match deployed NEF checksum and ABI to the reviewed build output.
3. Re-run read-only bankroll, reserved exposure, pending-count, and exact-bet
   state checks.
4. Run one explicitly authorized testnet `deposit -> commit -> fixed three-block
   beacon -> settle -> getPendingBet readback -> withdraw` flow.
5. Verify exact contract, network, player, face, fixed8 wager, roll, win predicate,
   payout arithmetic, and terminal state before enabling payment permissions.
6. Update both source and host manifests together.

No transaction, key use, deployment, or contract update was performed during
the 2026-07-11 verification.
