# AA Permissions network status

Checked: 2026-07-11

## Canonical deployments

| Network | AA Core | Contract | Update counter | Domain |
| --- | --- | --- | ---: | --- |
| Neo N3 Mainnet | `0x0268a387913b250166ddec032b03332690a1ef78` | `UnifiedSmartWalletV3` | 4 | `core.smartwallet.neo` |
| Neo N3 Testnet | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` | `UnifiedSmartWalletV3` | 4 | Not published in the canonical registry |

Direct `getcontractstate` calls to the configured N3Index Mainnet and Testnet
JSON-RPC endpoints returned both deployed contracts. Their live ABIs include
the exact read/write/event surface consumed by the app:

- reads: `getVerifier`, `getHook`, `getBackupOwner`,
  `hasPendingVerifierUpdate`, `hasPendingHookUpdate`,
  `getPendingVerifierUpdateTime`, and `getPendingHookUpdateTime`;
- writes: `updateVerifier`, `updateHook`, `confirmVerifierUpdate`,
  `confirmHookUpdate`, `cancelVerifierUpdate`, and `cancelHookUpdate`;
- lifecycle events: verifier/hook `UpdateInitiated`, `UpdateConfirmed`, and
  `UpdateCancelled`.

## Read-only account probes

The following existing account IDs were read without signing or mutation:

| Network | Account ID | Result |
| --- | --- | --- |
| Mainnet | `0x1175e7213458915ee558cdf88619ca4f48dda342` | Seven reads HALT; verifier/hook are zero; owner is `0x6d0656f6dd91469db1c90cc1e574380613f43738`; no pending update; both unlock times are zero. |
| Testnet | `0xa38c1d64dba73b013e3cf878eea61551384bd473` | Seven reads HALT; verifier/hook are zero; owner is `0x6d0656f6dd91469db1c90cc1e574380613f43738`; no pending update; both unlock times are zero. |

These probes verify the complete empty-lane/first-install read shape on both
networks. They do not prove a wallet write or funded transaction.

## Source-confirmed lifecycle

The adjacent canonical `neo-abstract-account` source defines
`ConfigUpdateTimelockMs = 24 * 60 * 60 * 1000` and uses Neo `Runtime.Time` in
milliseconds. `UpdateVerifier` and `UpdateHook` install immediately only when
the existing lane is zero; replacing a non-zero lane creates a pending record.
Every update, confirm, and cancel path asserts the account's backup owner.

Network state can drift after this dated check. The application therefore
re-reads the account and wallet binding at operation time instead of treating
this document as runtime state.

