# Neo X Bridge network status

Checked: 2026-07-12

## Live route boundaries

| Boundary | Result | Product use |
| --- | --- | --- |
| Neo N3 MainNet RPC | Ready | `https://api.n3index.dev/mainnet` returned network magic `860833102` |
| Neo N3 TestNet T5 RPC | Ready | `https://api.n3index.dev/testnet` returned network magic `894710606` |
| Neo X MainNet RPC | Ready | `https://mainnet-1.rpc.banelabs.org` returned chain ID `0xba93` (`47763`) |
| Neo X TestNet T4 RPC | Ready | `https://neoxt4seed1.ngd.network` returned chain ID `0xba9304` (`12227332`) |
| Official MainNet bridge | Reachable | `https://xbridge.neo.org/` returned HTTP 200 |
| Official TestNet bridge | Reachable | `https://testnet.bridge.banelabs.org/` returned HTTP 200 |
| Bridge operator dashboard | Reachable | `https://indexer.xbridge.neo.org/` returned HTTP 200; linked as an operator view, not treated as request-bound delivery proof |
| Public quote/limit API | Not configured | Live bridge fee, network fee, min/max, quota, approval, and quote expiry are rechecked on the official bridge |
| Authenticated destination readback | Not configured | Destination event and destination state remain unverified |

## Supported assets and precision

- The current official MainNet bridge surface states that GAS and NEO are available bidirectionally.
- GAS review input is limited to 8 decimals. The handoff still records the real source/destination token precision: 8 decimals on Neo N3 and 18 decimals for native GAS on Neo X.
- NEO is accepted only as a positive whole number and records 0 decimals in both directions.
- Exact Neo N3 NEO/GAS balances are read as bigint units after NEP-21 account/network attestation.
- Exact Neo X native GAS balance is read as wei after pre/post `eth_chainId` checks and account revalidation.
- Neo X NEO is a registered token. This miniapp does not ship an authoritative registry-to-token-address binding, so it leaves that balance unavailable and requires the official bridge to recheck it.

## Wallet and transaction boundary

- The launch network selects the workspace environment only; it is never displayed as verified wallet state.
- A local review ticket cannot be prepared until the source wallet account and network are re-attested.
- If a destination wallet is connected, its address must match the destination address in the ticket.
- Amount checks use bigint base units. A verified balance can reject an over-balance draft, but users must still reserve live bridge and network fees shown by the official bridge.
- This miniapp never signs, approves, submits, or deploys. It opens the official bridge for those steps.
- A source receipt is checked on its direction-bound source chain. Source confirmation never implies a bridge event or destination delivery.

## Contract and manifest boundary

- `neo-manifest.json` intentionally declares `contracts: {}`. The miniapp owns no bridge contract and has nothing to deploy.
- The official bridge contracts and registered token set are operated outside this repository. Hard-coding an unreviewed address here would create a false execution surface, so the app keeps them outside its manifest.
- Supported networks are declared explicitly as Neo N3 MainNet/TestNet and Neo X MainNet/TestNet.

## Official references

- Current bridge: <https://xbridge.neo.org/>
- Asset bridge guide: <https://xdocs.ngd.network/bridge/quick-start-bridging-assets>
- TokenBridge architecture: <https://xdocs.ngd.network/bridge/token-bridge>

