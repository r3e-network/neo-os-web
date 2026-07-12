# Graveyard / Memory Garden

A warm, privacy-first ritual for anchoring a memory commitment on Neo N3 and optionally marking it forgotten later.

## Product flow

1. Choose a private note, a local file, or an existing SHA-256 digest.
2. Notes and files are hashed locally with Web Crypto. Raw text and file bytes are never uploaded or passed to the contract.
3. Choose one of the five on-chain memory types and review the connected wallet, live contract fee, digest, and permanent-record warning.
4. Confirm in the wallet. The app deposits the burial fee, invokes `buryMemory`, and reports success only after `MemoryBuried` settles.
5. Records can later receive an epitaph or be marked forgotten through an explicit, separately priced confirmation.

## Contract semantics

| Operation | Route | Result |
|---|---|---|
| Bury | GAS deposit with memo `miniapp-graveyard:memory`, then `buryMemory(owner, contentHash, memoryType)` | Emits `MemoryBuried` |
| Epitaph | Signed `addEpitaph(memoryId, epitaph)` invocation; no Graveyard deposit | Emits `EpitaphAdded`; a normal Neo network fee may still apply |
| Forget | GAS deposit with the same memo, then `forgetMemory(owner, memoryId)` | Emits `MemoryForgotten` |

Forgetting does **not** erase the event log or content hash. It records a permanent forgotten state in the existing audit trail. The current deployed fees are read from `getPlatformStats`; paid actions stay disabled until both live fees are verified, so the 0.1/1 GAS display seeds can never authorize a stale-fee transfer.

## Privacy and recovery boundaries

- Only a 64-character SHA-256 digest is accepted for a paid burial.
- Local files are limited to 25 MB and are read only long enough to compute the digest.
- Prepared input is cleared only after a verified `MemoryBuried` event. Wallet rejection and pre-broadcast failures can be retried; if a transaction was broadcast but the event is still unverified, refresh records before submitting again.
- Burial cannot be invoked without the explicit review sheet, and changes to the digest, memory type, or fee invalidate the previous confirmation.
- Burial and forgetting UI state updates require their matching verified contract event. Epitaph success additionally requires an exact `getMemoryDetails` readback; a relayed transaction ID or event alone is never shown as success.
- Matching is identity-bound: memory id, owner, digest, memory type, and epitaph text must agree with the reviewed action before local state changes.
- If live fee reads fail, the review action remains disabled and offers an explicit retry; no fallback fee is sent to the wallet.
- The live `isPaused` flag is checked with the fee read. A paused or unreadable contract blocks payment before any GAS transfer.
- If a GAS deposit is broadcast but the consuming contract call does not finish, a device-local recovery journal restores the digest/type and reuses that prepaid credit through a direct retry instead of charging another deposit. A target transaction waiting on its event is reconciled from wallet-scoped records and blocks duplicate payment. The journal never stores note text or file bytes.
- A broadcast epitaph is journaled with its memory ID, exact text, wallet and transaction ID. The record becomes a read-only “check status” task until contract readback matches; the app never opens a second signature while that intent is unresolved.
- The recovery journal must complete a local-storage round trip before any wallet write is opened. If storage is unavailable, writing stays disabled while read-only records continue to work.
- Switching wallets clears the previous owner's records before the replacement read starts, so an RPC failure cannot leave another wallet's history visible.
- The app does not encrypt, store, upload, delete, or destroy the original note/file, and it does not provide TEE key destruction.

The public manifest intentionally exposes no generic parameter operation panel. Burial, epitaph, and forgetting are completed only inside the designed Memory Garden workspace, where the source, live fee, confirmation, and recovery state stay together.

## Network

| Property | Value |
|---|---|
| App ID | `miniapp-graveyard` |
| Supported network | Neo N3 TestNet |
| Contract | `0xb55aa635b10a5abb5cbac169db26a38df739778e` |
| Network magic | `894710606` |

The committed manifest currently advertises TestNet only. No MainNet deployment is claimed here.

## Development

```bash
npm run dev
npm run build
npx tsc -p tsconfig.json --noEmit
```

The runtime art provenance is documented in [ATTRIBUTION.md](./ATTRIBUTION.md).
Current product and verification evidence is documented in [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md).
