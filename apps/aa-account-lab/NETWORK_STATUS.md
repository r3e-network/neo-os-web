# AA Account Lab network status

Read-only verification date: 2026-07-11

| Network | AA Core | Canonical Web3Auth verifier | Live result |
| --- | --- | --- | --- |
| Neo N3 Mainnet | `0x0268a387913b250166ddec032b03332690a1ef78` | `0xf5c452cd4ba29dcdc47026383568c0d8b38d9272` | Both contracts resolve; verifier `authorizedCore()` returns the listed AA Core. |
| Neo N3 Testnet | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` | `0x7147f9a508594a7656a25f45d0a7a7dede7c227f` | Both contracts resolve; verifier `authorizedCore()` returns the listed AA Core. |

On both networks, the live AA Core is `UnifiedSmartWalletV3`; its manifest
contains:

- `registerAccount(accountId, verifier, verifierParams, hookId, backupOwner, escapeTimelock)`;
- `AccountRegistered(accountId, backupOwner, verifier, hookId)`;
- the five safe reads used by confirmation: `getVerifier`, `getHook`,
  `getBackupOwner`, `getEscapeTimelock`, and `isEscapeActive`.

The shared registration derivation vector was invoked read-only against both
cores. RPC `ByteArray` input used base64 for the bytes `0x11223344`; each core
returned the display-order hash
`0x27c01243fca45e1b821dc3bb45267a579762d530`, matching the frontend helper.

This evidence proves contract availability, ABI alignment, verifier-to-core
binding, and deterministic derivation. It does not claim that a funded wallet
registration was executed in this pass.
