# Asset Factory network status

Read-only verification: 2026-07-11 15:31 UTC. No deployment, wallet signature, funded transaction, secret, contract update, or state-changing RPC call was used.

## Configured target

| Item | Verified value |
| --- | --- |
| Network | Neo N3 TestNet only |
| RPC | `https://api.n3index.dev/testnet` |
| Factory | `0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49` |
| Contract ID | `7310` |
| Contract name | `MiniAppFactory` |
| Update counter | `0` |
| Registered templates | `6` |
| Deployment records | `1` |

## Live ABI boundary

`getcontractstate` returned these relevant methods:

- `getTemplate/1` — safe
- `templateCount/0` — safe
- `getDeployment/1` — safe
- `deploymentCount/0` — safe
- `getDeploymentIdByIndex/1` — safe
- `deployFromTemplate/4` — write
- `createMiniAppFromTemplate/4` — write

`deployArtifactFromTemplate/6` is **not present** at the configured TestNet hash.

The repository build manifest contains `deployArtifactFromTemplate/6`, but source/build availability is not evidence of TestNet deployment.

## NEP-17 template evidence

Read-only `getTemplate("tpl.nep17.asset.v1")` returned `HALT` with:

- standard: `NEP-17`
- version: `1.0.0`
- template record present
- `HasArtifact = false`

This is a metadata-only template. The live legacy `deployFromTemplate/4` path does not have the creator-unique NEF/manifest inputs required for real token creation.

## Existing record evidence

`getDeploymentIdByIndex(0)` returned `dep-test-1780463223002`. Its `getDeployment` record contains:

- template: `tpl.nep17.asset.v1`
- digest text: `0xcdcd…cdcd`
- init params: `{"name":"TestTok","symbol":"TTK"}`
- a creator UInt160
- deployed hash: twenty zero bytes

The frontend parser normalizes the zero hash to an empty value and displays this as **record only**, never as a deployed token.

## Product consequence

- Blueprint validation, deterministic digest/package generation, export, captured Owner-wallet signature, refresh recovery, and exact Factory-record comparison are available.
- Contract deployment, token minting, token hash claims, supply/decimals/owner readback, deployment price, and transaction recovery are unavailable.
- An RPC/ABI failure is classified as `unavailable`, not as an authoritative missing record and never as a zero result.
