# GasBox

GasBox is a resource-led Neo N3 capsule game designed around `MiniAppGasBoxV2`. The production frontend is currently in browse-and-recovery mode: new pulls, machine publishing, pool top-ups and activation are disabled until the fixed-beacon contract is deployed.

The reason is a verified deployment mismatch. The local replacement source/build uses the fixed `commitIndex + 1` block hash, but both manifest bindings still point to an older live ABI with no `update` method. Its deployed manifest identifies settle-block `Runtime.GetRandom`; the matching repository version re-rolls on a later settle attempt. That is not the game logic this frontend advertises, so it is not allowed to accept new paid writes.

## Available now

1. Read the live machine catalog without connecting a wallet.
2. Review pull price, weighted odds, total pool, reserved pool and free pool.
3. Restore and reveal a pull that was already committed before the gate.
4. Return unused prepaid GAS credit with `withdraw(account)`.
5. Return creator revenue or unreserved bankroll. Reserved funds remain untouched.

## Enabled after a compatible deployment

1. Connect a Neo N3 wallet and commit the GAS wager. Existing prepaid credit is reused first.
2. Reveal after the fixed next-block beacon exists. Settlement is permissionless and pays exactly once.
3. If the page reloads, the network/contract/wallet-scoped pending journal restores Reveal without resubmitting the wager.

## Creator contract flow

- `createMachine` creates a GAS-priced machine with a NEO or GAS prize asset.
- `addItem` stores 1-based weighted prize rows.
- A memo-bound NEP-17 transfer funds the machine pool.
- `setActive` only succeeds when the free pool covers the largest prize.
- `withdrawRevenue` returns accumulated GAS revenue.
- `withdrawPool` returns only unreserved bankroll and may deactivate an underfunded machine.

All amount comparisons and writes use decimal-string base units. Display numbers are derived from those exact values.

## Live contract binding

| Network | Contract |
| --- | --- |
| Neo N3 MainNet | `0x30e9d4a4758827361c3b51a0e8460b067e58b1db` |
| Neo N3 TestNet | `0x30e9d4a4758827361c3b51a0e8460b067e58b1db` |

The frontend verifies network, configured hash, required V2 reads and deployment compatibility. This known older hash remains readable but fails the paid-write compatibility gate. Recovery condition: deploy the fixed-beacon artifact as a new contract, verify it read-only, then update the registry and manifest bindings. Current evidence is recorded in `NETWORK_STATUS.md`.

## Frontend

- React + TypeScript + the shared MiniApp framework
- Existing GasBox capsule-machine and capsule artwork
- Official NEO/GAS `CoinArt` from the shared Neo press-kit asset set
- Real transaction state drives motion; there is no fake pull timer or simulated prize

## Verification

From the repository root:

```bash
npx tsc --noEmit -p apps/gasbox/tsconfig.json
npx eslint apps/gasbox/src apps/shared/test/gasbox*.test.ts apps/shared/test/gasbox*.test.tsx
npm --prefix apps/gasbox run build
```

Run focused tests from `apps/shared` so its Vitest configuration and aliases apply:

```bash
cd apps/shared
npx vitest run test/gasbox.logic.test.ts test/gasbox.playarea.test.tsx test/gasbox.integration.test.tsx test/gasbox.launch.test.ts test/gasbox.e2e.test.ts --maxWorkers=1 --testTimeout=15000
```

## Scope

GasBox V2 pays fungible NEO or GAS prizes. It does not currently support NFTs, machine trading, VRF, keeper settlement or AA session keys.
