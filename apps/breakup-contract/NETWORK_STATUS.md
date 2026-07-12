# Breakup Contract network status

Last read-only verification: **2026-07-12**

No wallet signature, transaction, deployment, upgrade, or funded write was performed for this verification. Both networks were queried through their N3Index JSON-RPC endpoints with `getcontractstate` and `invokefunction` only.

## Canonical binding

| Network | RPC | Contract | Contract ID | Update counter |
|---|---|---|---:|---:|
| Neo N3 MainNet | `https://api.n3index.dev/mainnet` | `0xf6769c080395f15c28013108b7af7631e1665336` | 600 | 0 |
| Neo N3 TestNet | `https://api.n3index.dev/testnet` | `0xf6769c080395f15c28013108b7af7631e1665336` | 7325 | 0 |

Both endpoints returned:

- manifest name `MiniAppBreakupPact`;
- deployed NEF checksum `2044887039`;
- the same lifecycle and credit ABI;
- `lastPactId` with VM state `HALT` and authoritative integer value `0`.

## Verified frontend ABI

| Method | Parameters | Return | Safe |
|---|---|---|---|
| `createPact` | `party1: Hash160`, `party2: Hash160`, `stake: Integer`, `durationSeconds: Integer` | `Integer` | no |
| `signPact` | `pactId: Integer`, `party2: Hash160` | `Void` | no |
| `breakPact` | `pactId: Integer`, `breaker: Hash160` | `Void` | no |
| `settlePact` | `pactId: Integer` | `Void` | no |
| `withdraw` | `account: Hash160` | `Integer` | no |
| `lastPactId` | none | `Integer` | yes |
| `creditOf` | `who: Hash160` | `Integer` | yes |
| `getPact` | `pactId: Integer` | `Map` | yes |
| `partyPactCount` | `who: Hash160` | `Integer` | yes |
| `getPartyPacts` | `who: Hash160`, `offset: Integer`, `limit: Integer` | `Array` | yes |

Verified events are `Credited`, `PactCreated`, `PactSigned`, `PactBroken`, `PactSettled`, `PactCancelled`, and `CreditWithdrawn`, with the parameter order consumed by `breakupSafety.ts`.

## Boundary

The checked-in `contracts/build/MiniAppBreakupPact.manifest.json` includes owner/update methods that are not present in either live deployment. The frontend deliberately binds only to the common deployed business ABI above. Funded end-to-end write QA remains outside this read-only pass.
