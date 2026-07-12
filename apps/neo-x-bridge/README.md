# Neo X Bridge

Neo X Bridge is a route-first wallet-readiness, handoff, and source-verification surface for moving GAS or NEO between Neo N3 and Neo X.

## What this miniapp does

- Supports the official bridge's current bidirectional GAS and NEO routes. GAS accepts at most 8 input decimals; NEO is whole-unit only.
- Connects the route's source wallet, rechecks its network/account, and reads exact bigint balances where the platform has an authoritative reader (NEO/GAS on Neo N3 and native GAS on Neo X).
- Binds environment, direction, source/destination chain IDs, asset precision, source account, amount, destination wallet, local expiry, and a local ticket reference into one review snapshot.
- Sends the user to the network-correct official bridge to obtain the authoritative quote, fee, and wallet signature.
- Recovers a canonical local ticket and a structured source-check request after a storage write/read/delete check only when environment, direction, account, asset, hash, request ID, and digest still match; expired tickets stay visible and can be renewed.
- Reads a supplied source transaction from the correct source chain.
- Keeps source transaction, source event, destination event, and destination readback as separate evidence boundaries.

## What it deliberately does not do

- It does not move funds or sign transactions.
- It cannot prefill or submit the official bridge. Users reconnect both wallets and re-check the route, amount, destination wallet, live limits, quote, fee, and any required approval there.
- It does not invent a bridge quote. Output amount, bridge fee, network fee, and official quote expiry remain unavailable until the official bridge provides them.
- The official bridge documents a typical 1–2 minute transfer window, but congestion can change this. The miniapp never turns that estimate into a completion claim.
- Neo X NEO is a registered bridged token. Its exact EVM token balance remains unavailable here until an authoritative token-registry binding is shipped, so the official bridge rechecks it.
- A confirmed source receipt never marks the destination as delivered.
- A receipt or log from a known bridge address is not treated as exact event proof without an authoritative ABI/topic and decoded direction, token, amount, recipient, request, and digest match.
- It does not expose the former generic MessageBridge payload form. The production MessageBridge flow requires ABI encoding, fees, nonce tracking, relay, destination execution, and optional result return; the MiniApp links the official developer documentation instead.

## User flow

1. Choose GAS or NEO and the route.
2. Connect the source wallet. The miniapp re-attests the account/network and shows an exact source balance when available.
3. Connect the destination wallet to bind it automatically, or enter a valid destination-chain address.
4. Prepare the 10-minute local handoff snapshot.
5. Continue to the official bridge, reconnect both wallets, and verify the same route, amount, destination wallet, live limits, quote, fee, and approval before signing.
6. Paste the source transaction hash into **Check source receipt**. Rechecks are idempotent and safe.
7. Treat delivery as unverified until an authenticated destination event and state readback become available.

Changing the route or transaction hash clears old evidence immediately. A Neo X hash that is absent from both the receipt and transaction lookups is shown as unknown, while a transaction that exists without a receipt is shown as pending.

## Validation

```bash
cd apps/neo-x-bridge
npx vitest run test --environment node
npx tsc -p tsconfig.json --noEmit
npx eslint src test
npm run build

cd ../shared
npx vitest run test/neo-x-bridge.playarea.test.tsx
npx vitest run test/neo-x-bridge.integration.test.tsx
```

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the current service boundary and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for shipped resource origins.

## Source grounding

- Current official bridge surface: <https://xbridge.neo.org/>
- Official asset-bridge guide: <https://xdocs.ngd.network/bridge/quick-start-bridging-assets>
- Official token-bridge architecture: <https://xdocs.ngd.network/bridge/token-bridge>
