# Soulbound Certificate network status

Last read-only check: 2026-07-12 (Asia/Shanghai) / 2026-07-11T19:46:16Z

## Canonical deployment binding

| Network | Contract | Contract name | Standard | Read result |
|---|---|---|---|---|
| Neo N3 MainNet | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` | `MiniAppSoulboundCertificate` | NEP-11 | `getcontractstate` returned the expected ABI; `getPlatformStats` HALT with 1 template and 1 certificate |
| Neo N3 TestNet | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` | `MiniAppSoulboundCertificate` | NEP-11 | `getcontractstate` returned the expected ABI; `getPlatformStats` HALT with 32 templates and 29 certificates |

Both live manifests expose the frontend's required write methods (`createTemplate`, `updateTemplate`, `setTemplateActive`, `issueCertificate`, `revokeCertificate`), read methods (`balanceOf`, `ownerOf`, `getTemplateDetails`, `getCertificateDetails`, `getIssuerTemplateCount`, `getIssuerTemplates`, `getPlatformStats`), and exact lifecycle events (`TemplateCreated`, `TemplateUpdated`, `CertificateIssued`, `CertificateRevoked`, `Transfer`).

The frontend accepts neither a generic `neo-n3` context nor a different contract address as authoritative. Public verification and every issuer write are bound to an explicit MainNet/TestNet lane and the canonical hash above. A failed balance/index read is surfaced as unavailable or partial, never as a trusted zero.

## Local/deployed drift

The repository's current local contract build contains base direct-asset-credit recovery methods that are not present in the live MainNet/TestNet manifests. Soulbound Certificate neither calls nor depends on those methods, so the credential lifecycle ABI used by this frontend remains aligned with both deployments.

## Remaining external proof

This pass made only read-only RPC calls. It did not deploy, sign, spend GAS, or use the funded TestNet account. Release evidence still needs one fresh funded TestNet run with transaction IDs and final readbacks for: create template → update template → change active state → issue → public verify → attempted transfer (must fail) → issuer revoke → public verify as revoked.

The older detailed verification notes remain in [TESTNET_STATUS.md](./TESTNET_STATUS.md).
