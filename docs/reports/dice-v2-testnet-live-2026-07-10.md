# Dice V2 testnet live validation — 2026-07-10

## Scope

- Network: Neo N3 testnet
- Contract: `0xef1fac0247ccbad5810e3fcfa1a0885d44efde39`
- Harness: `node deploy/scripts/live_validate_dicegame_v2.mjs`
- Credential source: configured `NEO_TESTNET_WIF` (never printed)

## Result

PASS. The harness funded the house, deposited reusable stake credit, and
completed two real `commit -> three-block beacon -> settle` rounds.

- Round 1: selected face 1, rolled 5, loss, payout `0 GAS`
- Round 2: selected face 2, rolled 1, loss, payout `0 GAS`
- Exact Committed/Settled bet id, player, face, and amount identities matched.
- Every rolled result was in the valid 1..6 range.
- The 5.70x win rule was enforced by the live harness even though this sample
  produced no win; deterministic contract tests cover the winning branch.
- House exposure was reserved after each commit and released after settlement.
- Win/loss stat deltas matched the authoritative Settled events.
- Player credit was withdrawn and returned to zero.
- No pending bets or reserved exposure remained.

## Ending testnet state

- `bankroll()`: `970000000` base units (`9.7 GAS`)
- `freeBankroll()`: `970000000` base units (`9.7 GAS`)
- `creditOf(test account)`: `0`
- `pendingBetCount()`: `0`
- `reservedBankroll()`: `0`

## Harness correction

The previous live script waited for only one later block, while the deployed V2
contract mixes a fixed three-block beacon and requires settlement strictly after
that complete window. The harness now waits from the authoritative Committed
`commitIndex`, normalizes Hash160 event values, and polls exact expected state to
handle RPC nodes at adjacent heights.
