# Neo Multisig testnet status

Verified on 2026-07-11 using read-only Neo N3 RPC calls.

## Confirmed

- Contract: `0xa361cdc792e97c4d8ddf42048cf48f3283ea7178`
- Contract name: `MiniAppMultisig`
- Live ABI includes the vault/request lifecycle methods and all events consumed by the app.
- `lastVaultId` returned `1`; `lastRequestId` returned `3` with VM state `HALT`.
- Vault `1` returned a 2-of-2 signer policy and a GAS balance of `10,000,000` base units.
- Requests `1`–`3` were readable: one cancelled request, one executed 2-approval request, and one cancelled 2-approval request.

## Not claimed

No funded testnet write was submitted during this implementation pass. The supplied funded account was not imported, used, logged, or modified. A release owner should still run the five wallet-backed flows—create vault, deposit, propose, approve-to-execution, and cancel—with disposable testnet funds and capture transaction IDs before treating funded end-to-end QA as complete.

Browser screenshot QA was also outside this pass. Automated component, business-logic, build, and static delivery checks are the evidence produced here.
