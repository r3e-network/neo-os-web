# FogPlay V2 testnet live validation — 2026-07-10

## Scope

- Network: Neo N3 testnet
- Contract: `0x611c3d97dd98792a3c31a0e695704c657f143cda`
- Harness: `node deploy/scripts/live_validate_coinflip.mjs`
- Credential source: configured `NEO_TESTNET_WIF` (never printed)

## Result

PASS. The harness funded the house, deposited reusable player credit, and
completed two real `commit -> three-block beacon -> settle` rounds.

- Round 1: choice heads, outcome tails, loss, payout `0 GAS`
- Round 2: choice tails, outcome tails, win, payout `2.00 GAS`
- Exact Committed/Settled bet id, player, choice, and amount identities matched.
- House exposure was reserved after commit and fully released after settlement.
- Win/loss stat deltas matched the two authoritative Settled events.
- Player credit was withdrawn and returned to zero.
- No pending bets or reserved exposure remained.

## Ending testnet state

- `bankroll()`: `700000000` base units (`7 GAS`)
- `freeBankroll()`: `700000000` base units (`7 GAS`)
- `creditOf(test account)`: `0`
- `pendingBetCount()`: `0`
- `reservedBankroll()`: `0`

## Harness corrections found by live execution

1. Neo application logs encode Hash160 event values as Base64 little-endian
   bytes. The harness now normalizes them before identity comparison.
2. A confirming RPC and a subsequent read RPC can briefly observe different
   heights. State assertions now poll for the exact expected value instead of
   assuming immediate cross-node consistency.
3. The first run stopped after commit on the failed identity assertion. That
   exact `betId=1` was recovered, allowed to clear its beacon window, and settled
   successfully before the corrected full run continued.
