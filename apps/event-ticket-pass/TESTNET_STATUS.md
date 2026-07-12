# Event Ticket Pass testnet status

Last checked: 2026-07-11

This file preserves the dated read-only evidence from the 2026-07-11 check. See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the 1.3.0 binding rules, recovery behavior, and remaining funded TestNet/browser acceptance boundaries. No live RPC or signed transaction was run during the 2026-07-12 product lane.

## Read-only deployment verification

| Network | RPC | Contract | Contract name | Contract ID | Update counter | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| Neo N3 Testnet | `https://api.n3index.dev/testnet` | `0x90bad472146aab97de71498e8d736c3124e7c82b` | `MiniAppEventTicketPass` | 6517 | 1 | Live |
| Neo N3 Mainnet | `https://api.n3index.dev/mainnet` | `0x90bad472146aab97de71498e8d736c3124e7c82b` | `MiniAppEventTicketPass` | 578 | 1 | Live |

Both nodes returned NEF checksum `2976433161`, the expected NEP-11 surface, and the exact application methods/events used by this frontend: `createEvent`, `setEventActive`, `issueTicket`, `checkIn`, `transfer`, `getEventDetails`, `getTicketDetails`, `getCreatorEvents`, `balanceOf`, `ownerOf`, `totalEvents`, `EventCreated`, `EventUpdated`, `TicketIssued`, `TicketCheckedIn`, and `Transfer`.

The canonical N3Index testnet RPC returned `HALT` for all three read probes below. The mainnet endpoint also returned `HALT` with `symbol=TICKET`, `decimals=0`, and `totalEvents=1`.

| Operation | Observed result |
| --- | --- |
| `totalEvents` | `28` |
| `totalTickets` | `28` |
| `getPlatformStats` | `totalEvents=28`, `totalTickets=28`, `maxSupply=100000`, `maxEventNameLength=60`, `maxVenueLength=60` |

## Write-path status

No signed transaction was submitted during the 2026-07-11 frontend pass. Create, issue, check-in, toggle, and transfer therefore remain **not freshly replayed** on testnet in this report. The UI treats a broadcast as pending unless its transaction-specific event is observed and the resulting contract state matches the request. The exact txid and request identity are persisted at the broadcast boundary; refresh recovery rechecks the same event and readback before clearing the journal. A canonical application log with VM `FAULT` is reported as failed and clears the terminal pending record rather than leaving the action in an endless confirming state.

## Product capability boundary

- Event discovery is read-only and scans at most 200 event records.
- Holder inventory reconstruction is bounded to 500 candidate token IDs and labels an incomplete result as partial.
- Wallet or network bridge changes invalidate in-flight organizer/ticket reads before the new account view is populated.
- An event-list read failure preserves the previous verified snapshot instead of silently replacing it with a partial list.
- The deployed contract has no paid purchase or attendee self-claim method. Public events are invitation-only: an organizer must issue the pass.
- Writes fail closed when the wallet reports only ambiguous `neo-n3`, the configured contract differs, checksum/ABI/NEP-11 attestation fails, host reads do not return `TICKET` and `0`, or durable refresh recovery is unavailable.

Before a release that changes contract arguments or event handling, replay the following with a funded testnet organizer and a separate attendee wallet:

1. Create one bounded event.
2. Issue one ticket to the attendee.
3. Read the attendee inventory and ticket details.
4. Look up and check in the ticket as the organizer.
5. Confirm a second check-in fails.
6. Issue a second ticket, transfer it as the holder, and verify `ownerOf` plus `getTicketDetails.owner` changed.
