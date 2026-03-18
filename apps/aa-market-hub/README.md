# AA Market Hub

Interactive trustless escrow market for deterministic Neo Abstract Account addresses.

## What It Does

- reads `getListingCount` and `getListing(id)` from an `AAAddressMarket` contract
- creates new listings by locking the AA shell into market escrow
- lets sellers update price or cancel an active listing
- lets buyers settle a listing with a batched `GAS.transfer + settleListing`
- lets payers refund a stranded pending payment if settlement did not complete

## Important Semantics

- the market transfers only the AA shell
- verifier, hook, and backup-owner configuration are intentionally cleared on sale
- the buyer must reconfigure fresh permissions and plugins after purchase
- sellers must provide the 20-byte `accountId` hash for the deterministic AA address they are listing

## Operational Notes

- this miniapp depends on a browser wallet that supports standard contract invokes
- buying a listing requires wallet support for `invokeMultiple`
- the market hash is operator-configurable and persisted locally in the browser
