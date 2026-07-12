# Oracle NeoDID Console network status

Read-only verification date: **2026-07-11**

| Network | Current observation | Product consequence |
| --- | --- | --- |
| Neo N3 mainnet | Network magic `860833102`; canonical contract `0xb81f31ea81e279793b30411b82c2e82078b63105`; manifest name `NeoDIDRegistry` | The app can report a verified deployment observation, but the returned DID document is still not treated as identity or claim verification. |
| Neo N3 testnet | Network magic `894710606`; canonical Morpheus NeoDID registry contract is empty | The app reports `no-network-deployment` only after the RPC network is bound. An unexpected resolver anchor is a mismatch, not a deployment. |

The host exposes same-origin read endpoints at `/api/morpheus/neodid/resolve` and `/api/morpheus/neodid/providers`. The resolver currently accepts Morpheus service, Vault, and AA identifiers. A resolver response is not subject-to-wallet binding. A provider/claim catalog match is metadata only. `MorpheusOracleGateway` in a DID service list means an endpoint is declared; it does not prove an Oracle request ran.

Live non-browser HTTP on 2026-07-11 returned the service DID on both networks with version `unversioned`, zero verification methods, and services `DIDResolutionService`, `MorpheusNeoDIDRegistry`, `MorpheusOracleGateway`, and `MorpheusNeoDIDRuntime`. Mainnet returned the canonical anchor above; testnet returned an empty anchor. Both provider endpoints returned 10 records, starting with provider `web3auth` and claim type `Web3Auth_PrimaryIdentity`. The current provider response does not return explicit `network` or `source` fields, so the app accepts the launch-scoped endpoint response but never invents those upstream claims. Payload structure is still strictly decoded before it can become evidence.

No wallet, signature, transaction, deployment, funded account, or secret is used by this app.
