# MiniApp Factory testnet status

Observed: 2026-07-12  
Network: Neo N3 TestNet  
RPC: `https://api.n3index.dev/testnet`  
Factory: `0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49`

These checks were read-only JSON-RPC `invokefunction` calls. No wallet,
signature, funded account or transaction was used.

| Read | Result | Product meaning |
| --- | --- | --- |
| `getTemplate(tpl.miniapp.reward-vault.v1)` | `HALT`, `HasArtifact=false` | Template metadata exists; MiniApp registration may write a record but does not deploy an artifact. |
| `getTemplate(tpl.miniapp.ticket-pass.v1)` | `HALT`, `HasArtifact=false` | Template metadata exists; MiniApp registration may write a record but does not deploy an artifact. |
| `getTemplate(tpl.miniapp.certificate.v1)` | `HALT`, `HasArtifact=false` | Template metadata exists; MiniApp registration may write a record but does not deploy an artifact. |
| `getTemplate(tpl.miniapp.oracle-console.v1)` | `HALT`, `HasArtifact=false` | Template metadata exists; MiniApp registration may write a record but does not deploy an artifact. |
| `miniAppCount()` | `HALT`, `1` | The configured Factory exposes the registry enumeration ABI used by the history drawer. |
| `getMiniAppIdByIndex(0)` | `HALT`, non-empty package ID | At least one registry record is addressable through the configured read path. |

`HasArtifact=false` is expected for this record-only product lane. The app must
never translate it into “application deployed”; its confirmed terminal state is
only “Factory registry record confirmed.”
