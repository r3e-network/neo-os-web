# Breakup Contract

A two-party, stake-backed commitment pact on Neo N3.

## Product model

1. The creator prepays at least 1 GAS and creates a pact naming one partner and a duration.
2. The pact is pending. Only the named partner can match the exact stake and activate it.
3. Before expiry, either active participant may break the pact. Both stakes are credited to the other participant.
4. After expiry, anyone may settle the active pact. Each participant receives their own stake as contract credit.
5. Pending pacts may only be cancelled by the creator; that stake becomes creator credit.
6. Credits are pull payments. A separate witness-gated `withdraw` moves GAS from contract credit to the wallet.

There are no milestone rewards, amendments, mutual-break split, yield, oracle, or automatic wallet refund in the deployed contract.

## On-chain and device-local data

The chain is authoritative for pact ID, participants, stake, expiry, signatures, status, breaker, and withdrawable credit. The display title and notes are device-local metadata. They are scoped by network and contract; legacy mainnet metadata remains readable. The UI reports a partial outcome if the pact is confirmed but local metadata cannot be saved.

## Transaction recovery

- Existing `creditOf` balance is consumed before asking for another deposit; only a deficit is transferred.
- A broadcast txid is treated as pending, not success.
- Before wallet confirmation, recovery storage and the exact wallet-network/contract binding are verified.
- `onTransactionSent` persists the exact intent, network, contract, wallet, and txid immediately.
- Pending ends only for authoritative VM `FAULT`, or `HALT` plus the exact event and a fresh authoritative readback. Unknown results have no age-based deletion.
- Refresh only restores and reconciles; it never replays the original action.
- Unknown credit or `lastPactId` is unavailable, never zero.

## Deployment binding

| Network | Contract | Read-only verification (2026-07-12) |
|---|---|---|
| Neo N3 MainNet | `0xf6769c080395f15c28013108b7af7631e1665336` | `MiniAppBreakupPact`, NEF checksum `2044887039`, full pact/credit ABI and events, `lastPactId` HALT |
| Neo N3 TestNet | `0xf6769c080395f15c28013108b7af7631e1665336` | independently returned the same name, checksum, ABI/events, and HALT read |

The checked-in current build artifact also contains admin/update methods that are not present in the live deployments. The frontend intentionally uses only the lifecycle and credit ABI confirmed on both networks. No deployment or funded write was performed during the 2026-07-12 read-only verification.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md), [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md), and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for the evidence and release boundary.

## Development

```bash
npm --prefix apps/breakup-contract run dev
npm --prefix apps/breakup-contract run build
```

The host operation panel is intentionally empty: the embedded pact desk owns the complete multi-step flow and its recovery safeguards.

## License

MIT License - R3E Network
