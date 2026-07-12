# Network Status

Live read-only verification performed against `https://api.n3index.dev/{network}` on 2026-07-11.

| Network | Contract | Script hash | Live manifest | Required ABI evidence |
| --- | --- | --- | --- | --- |
| Mainnet | AA Core | `0x0268a387913b250166ddec032b03332690a1ef78` | `UnifiedSmartWalletV3` | `callVerifier/3`, `getVerifier/1`, `getBackupOwner/1`, `canConfigureVerifier/2` |
| Mainnet | Session verifier | `0x3ba8333406e59f9fd83cf378b33706a33d9f3755` | `SessionKeyVerifier` | `setSessionKey/7`, `clearSessionKey/1`, `getSessionKey/1`, `getSessionKeyMetadata/1`, `getSpentAmount/1`, `authorizedCore/0` |
| Testnet | AA Core | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` | `UnifiedSmartWalletV3` | `callVerifier/3`, `getVerifier/1`, `getBackupOwner/1`, `canConfigureVerifier/2` |
| Testnet | Session verifier | `0xed44c88535650b4dd6b8d59776e6ed045462cab6` | `SessionKeyVerifier-1773393653613-session` | `setSessionKey/5`, `clearSessionKey/1`, `getSessionKey/1` |

The mainnet verifier's live `authorizedCore()` read decoded to the canonical mainnet AA Core hash. The testnet verifier predates that getter, so its contract identity is pinned by the canonical generated Morpheus registry and each account must still report this exact verifier through AA Core `getVerifier(accountId)`.

## Runtime binding rules

- Read-only inspection uses the explicit launch network and rejects an explicitly detected wallet-network mismatch.
- Writes require an explicit wallet network (`neo-n3-mainnet` or `neo-n3-testnet`); an ambiguous network is not accepted.
- The registry AA Core and SessionKeyVerifier hashes must equal the pinned canonical pair.
- The miniapp's configured contract, when present, must equal the pinned verifier.
- The AA account must exist, `getVerifier(accountId)` must equal the pinned verifier, and the connected wallet must equal `getBackupOwner(accountId)`.
- Mainnet also validates the verifier's `authorizedCore()` binding.
- Configure confirmation requires exact public key, target, method, expiry, and — on mainnet — allowance readback.
- Revoke confirmation requires authoritative absence from `getSessionKey`.

## Testnet limitation

The frozen testnet verifier has no `getSpentAmount`, `getSessionKeyMetadata`, or spending-limit fields. The frontend does not pass, display, or claim an allowance on testnet.
