# Neo Name Service

Neo Name Service is a production naming workspace for the official Neo N3 NameService contract. The primary journey is search → verify availability and exact GAS price → register. Owned-name routing, renewal, and transfer live in the secondary drawer.

## Product behavior

- Validates names against the contract's lowercase first-label rules before RPC calls.
- Keeps search and live pricing available without a wallet; a wallet is requested only when the user starts a write.
- Distinguishes available, registered, and committee-reserved names.
- Reads registered owner, expiry, TXT address target, and exact Fixed8 GAS pricing from the active network.
- Loads wallet-owned NEP-11 names through `getnep11balances`, then strictly hydrates every name from contract properties and resolution reads.
- Rejects duplicate, malformed, oversized, or property-name-less token rows instead of publishing an ambiguous partial ownership list.
- Preserves the last verified name list when RPC hydration fails; a failed read is never shown as zero names or expiry `0`.
- Rechecks availability and price immediately before registration.
- Binds each search response to its exact query so a slower old request cannot replace a newer result.
- Requires a reviewed live quote before renewal and a second confirmation before transfer.
- Shows expired names explicitly, preserves the complete owned-name list, and suppresses a target update when the address is already current.
- Requires positive wallet-network detection for every write. Launch-network fallback is read-only.
- Proves that a recovery receipt can be written, read, and deleted before the wallet receives a transaction request.
- Persists a transaction receipt as soon as the wallet broadcasts. Success is shown only after HALT, the exact NNS event when the ABI provides one, and matching contract readback.
- Keeps unconfirmed transactions recoverable across refreshes, exposes a copyable txid, and blocks accidental duplicate submissions.

## Supported operations

| Operation | Confirmation evidence |
| --- | --- |
| Register | `Transfer(null-or-expired-owner, owner, 1, name)` + owner/expiry readback |
| Renew | `Renew(name, oldExpiry, newExpiry)` + exact new-expiry readback |
| Set address target | HALT application log + owner/TXT target readback |
| Transfer | `Transfer(owner, receiver, 1, name)` + new-owner readback |

Record type `16` is the official NNS `TXT` record. This MiniApp stores a validated Neo N3 address in that record, matching the platform's existing contract-domain convention.

## Networks

The official NameService contract is deployed at the same script hash on both supported networks:

`0x50ac1c37690cc2cfc594472833cf57505d5f46de`

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for current read-only verification evidence. No wallet transaction or deployment is performed by the verification commands.

## Visual assets

- `public/neo-ns-registry-desk.webp` is the existing project-local naming-desk artwork used in the live workspace, catalog banner, and social preview; no reference-repository asset was copied in this pass.
- NEO and GAS marks are rendered by the shared `CoinArt` component from the official Neo Press Kit assets.
- The UI does not synthesize emoji, CSS illustration, or inline-SVG stand-ins for product art.

## Verification

```bash
npm test
npx tsc -p tsconfig.json --noEmit
npx eslint src --max-warnings=0
npm run build
```

The production pass intentionally uses static HTTP/RPC checks and does not submit transactions.
