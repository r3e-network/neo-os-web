# Event Ticket Pass network status

Release: `1.3.0`  
Status reviewed: 2026-07-12

## Configured bindings

| Network | RPC selected by the shared runtime | Contract | Expected NEF checksum | Manifest status |
| --- | --- | --- | ---: | --- |
| Neo N3 MainNet | `https://api.n3index.dev/mainnet` | `0x90bad472146aab97de71498e8d736c3124e7c82b` | `2976433161` | deployed |
| Neo N3 TestNet | `https://api.n3index.dev/testnet` | `0x90bad472146aab97de71498e8d736c3124e7c82b` | `2976433161` | deployed |

The frontend accepts only an explicit MainNet or TestNet wallet network. Before a write it verifies the configured script hash, contract name `MiniAppEventTicketPass`, checksum, NEP-11 declaration, exact method/event signatures, and the host-bound `symbol=TICKET` / `decimals=0` reads. A generic `neo-n3` result is not guessed into either network.

## Evidence boundary

The last recorded live evidence is the read-only check dated 2026-07-11 in [TESTNET_STATUS.md](./TESTNET_STATUS.md). That check reported the expected contract name, checksum and ABI on both configured networks, with TestNet totals of 28 events and 28 tickets at that time.

This 1.3.0 product lane did **not** access a live RPC, open a wallet prompt, sign a message, submit a transaction, deploy or update a contract, or spend test tokens. The 2026-07-11 totals are historical evidence and must not be read as current chain counts.

## Transaction recovery behavior

- Create, issue, event activation, check-in, and transfer share one write lock.
- Durable storage is probed with an operation-sized record before a wallet request is opened.
- The exact txid, network, contract, account and request identity are journaled at broadcast time.
- A second write is blocked while a journal is pending.
- Recovery accepts only the expected event from the configured contract and then performs an authoritative state readback.
- A missing application log remains pending. VM `FAULT` is terminal. A canonical `HALT` without the expected contract event is also terminal and does not leave the product in an endless recovery loop.
- Wallet, network, contract, selected event or scanned-token changes invalidate stale reads before they can populate the current view.

## Required funded TestNet release pass

Use a funded organizer wallet and a separate attendee wallet. This remains a manual release boundary:

1. Confirm the host launches with `neo-n3-testnet` and the attested checksum above.
2. Create a small future event and confirm the exact `EventCreated` notification plus every saved field, including notes.
3. Issue two passes to the attendee and confirm both appear in the organizer gate queue while the organizer's holder wallet stays unchanged.
4. Reconnect as the attendee and confirm `balanceOf`, `ownerOf`, the bounded wallet reconstruction and both QR token IDs.
5. Transfer one unused pass to a third address and confirm both `ownerOf` and `getTicketDetails.owner` change.
6. Reconnect as the organizer, look up the other pass, check it in once, and confirm a second check-in fails.
7. Exercise refresh recovery after broadcast for one action; verify the same txid is recovered and no duplicate wallet request is opened.
8. Inspect a forced or known VM `FAULT` receipt and a delayed application log to confirm the terminal and pending messages are distinct.

## Browser acceptance boundary

The current lane was explicitly prohibited from using Browser, Chrome, Playwright, or Computer Use. Responsive layout, focus order, QR scanning ergonomics, wallet-extension behavior, reduced-motion rendering, and the complete create → issue → attendee wallet → gate flow still require a chosen-browser pass against the built artifact.
