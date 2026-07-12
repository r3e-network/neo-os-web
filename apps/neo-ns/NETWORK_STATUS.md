# Neo Name Service network status

Read-only verification date: 2026-07-11 (Asia/Shanghai)

Contract on both networks:

`0x50ac1c37690cc2cfc594472833cf57505d5f46de`

| Evidence | Mainnet | Testnet |
| --- | ---: | ---: |
| Contract name | `NameService` | `NameService` |
| `symbol()` | `NNS` / HALT | `NNS` / HALT |
| `totalSupply()` | `3906` / HALT | `100` / HALT |
| `getPrice(5)` | `200000000` (2 GAS) / HALT | `200000000` (2 GAS) / HALT |
| Fresh unused-name availability probe | `true` / HALT | `true` / HALT |
| `properties(neo.neo)` | name + positive expiry / HALT | name + positive expiry / HALT |
| ABI events | `Transfer`, `SetAdmin`, `Renew` | `Transfer`, `SetAdmin`, `Renew` |
| Browser CORS preflight | `204`, `Access-Control-Allow-Origin: *`, POST allowed | `204`, `Access-Control-Allow-Origin: *`, POST allowed |

RPC source: canonical N3Index endpoints configured by `apps/shared/constants/generated-morpheus-registry.ts`.

The probe name was only read. No registration, renewal, record update, transfer, wallet signing, deployment, or funded transaction was performed.
