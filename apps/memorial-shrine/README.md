# Memorial Shrine

Memorial Shrine is a public Neo N3 remembrance garden. The garden, memorial
portrait, and fixed-price symbolic offerings are the primary surface; creation
details, history, and transaction recovery stay in a secondary drawer.

## Product flow

1. Open the live garden and select an existing memorial.
2. Choose one of six contract-defined symbolic offerings and leave an optional
   message.
3. Review the permanent, non-refundable on-chain action before wallet
   confirmation.
4. Create a memorial from the visual memorial-card studio. Only the name is
   required; relationship, dates, life story, obituary, and an HTTPS/IPFS image
   reference are optional drawer details.
5. Share a memorial with its `?id=` deep link.

The UI does not claim that GAS is sent to a family. A tribute records an
on-chain symbolic offering through the deployed contract's payment path.

## Transaction integrity

- Every write is bound to the exact network, contract, wallet, intent, amount,
  and transaction ID observed by `onTransactionSent`.
- The broadcast record is durably round-tripped in local storage before the UI
  can treat recovery as available. A failed storage preflight blocks the wallet
  request.
- Refreshing the MiniApp restores the pending record and checks it; it never
  replays the invocation.
- A write is complete only after `getapplicationlog` reports `HALT`, the exact
  contract event matches the saved intent, and authoritative contract getters
  match the same intent. `FAULT`, unavailable/unknown, event mismatch, and
  readback-pending are separate states.
- Failed integer reads are unavailable, not synthetic zero values.

## Runtime boundaries

- Reads come directly from `MiniAppMemorialShrine` getters. RPC failure is shown
  as a recoverable unavailable state and is never presented as an empty garden.
- TestNet tributes use the deployed `onNEP17Payment` payment-plus-invocation
  lane.
- MainNet memorial creation is ABI-compatible, but tribute is deliberately
  blocked before wallet interaction while the deployed `paymentHub` is
  unconfigured.
- The app stores only opened memorial IDs and an exact pending-write recovery
  record on this device.
- The photo field stores an HTTPS URL or IPFS CID reference. This MiniApp does
  not upload files, provide private memorials, manage collaborators, or issue a
  NEP-11 token.

## Contracts

| Network | Contract |
| --- | --- |
| Neo N3 MainNet | `0xee7a548b71c69364fcb0e45a63a40f141b938e42` |
| Neo N3 TestNet | `0x87f0fe2ba69cd973a3274471234d3cc13ef943c5` |

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the read-only deployment
snapshot, [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for visual-asset
clearance, and [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for remaining
release gates.
