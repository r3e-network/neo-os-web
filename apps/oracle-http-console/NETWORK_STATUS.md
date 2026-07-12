# Oracle HTTP Console network status

Last checked: 2026-07-11

This MiniApp does not execute an HTTP oracle request. Network checks below only confirm the canonical example endpoint and prevent the UI from implying that a local draft is a completed oracle job.

| Selected network | Canonical example | Read-only observation | Product behavior |
| --- | --- | --- | --- |
| Mainnet | `GET https://oracle.meshmini.app/mainnet/health` | HTTP 200 JSON; `status: ok`, `ready: true`, `network: mainnet`. | Seed the source field with this URL and label the draft `Morpheus Mainnet`. This is service-health evidence, not source-fetch or callback evidence. |
| Testnet | `GET https://oracle.meshmini.app/testnet/health` | HTTP 200 JSON, but the response reports `network: mainnet`. | Seed the testnet URL but do not claim testnet execution readiness. The draft remains local and is visibly labeled `Morpheus Testnet`. |

The selected launch network is resolved through the shared generated Morpheus registry. The draft digest includes that network and the canonical `/oracle/smart-fetch` route, so otherwise identical mainnet and testnet drafts cannot be mistaken for the same package.

## External execution boundary

- Public health responding does not prove that an arbitrary source URL, its extraction path, or a callback contract will succeed.
- The current worker executes a simple dot-separated `json_path`; it does not execute full JSONPath syntax. The MiniApp normalizes supported legacy notation before copying.
- The MiniApp has no runtime credential, callback contract, callback method, wallet action or transaction path. Those belong to the separate callback-binding workflow.
- Testnet service routing must be corrected upstream before an end-to-end testnet execution can be represented as ready.
