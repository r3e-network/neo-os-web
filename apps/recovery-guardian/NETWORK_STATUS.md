# Recovery Guardian network status

Read-only verification: 2026-07-11 23:11 CST

No wallet, signature, transaction, or deployment was used. Contract-state and safe-method probes were sent directly to the configured N3Index RPC endpoints.

## Mainnet

- RPC: `https://api.n3index.dev/mainnet`
- Social Recovery Verifier: `0x198b3a9cec9bccc2110d19bd929b10374a9d034d` — `SocialRecoveryVerifier`
- AA Core: `0x0268a387913b250166ddec032b03332690a1ef78` — `UnifiedSmartWalletV3`
- Morpheus Oracle: `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` — `MorpheusOracle`
- `version()` returned `HALT` with `1.0.0`.
- `getOwner(ByteArray)` returned `HALT` for an unused zero account ID and preserved the zero owner as an explicit unconfigured value.

## Testnet

- RPC: `https://api.n3index.dev/testnet`
- Social Recovery Verifier: `0x198b3a9cec9bccc2110d19bd929b10374a9d034d` — `SocialRecoveryVerifier`
- AA Core: `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` — `UnifiedSmartWalletV3`
- Morpheus Oracle: `0x4b882e94ed766807c4fd728768f972e13008ad52` — `MorpheusOracle`
- `version()` returned `HALT` with `1.0.0`.
- `getOwner(ByteArray)` returned `HALT` for an unused zero account ID and preserved the zero owner as an explicit unconfigured value.

The miniapp manifest is the deployed Social Recovery Verifier source for both networks. The generated external registry currently leaves the optional testnet `aaSocialRecoveryVerifier` field empty, so runtime resolution intentionally uses the per-miniapp contract registry first. AA Core and Morpheus Oracle remain network-specific.

These probes establish deployment and safe-read availability only. They do not prove a particular user's guardian configuration or execute setup, cancellation, ticket approval, or finalization.
