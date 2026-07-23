# PlatformSocial Framework Interface

Generated: 2026-07-23T03:08:47.888Z

- Interface audit: **PASS**
- User-facing contract ABI: 36 methods
- Framework operations: 36 methods
- Native credit transfer operations: 1
- Missing methods: none
- Extra methods: none
- Configured production consumers: 0
- Live deployment status: `no-deployment-record`
- Chain writes performed: no

## Wiring

- options_config: PASS
- framework_surface: PASS
- composition_root: PASS
- manifest_binding: PASS
- timestamp_proof_dual_path: PASS
- tenant_credit_prepayment: PASS

## Boundary

The framework covers the complete user-facing local PlatformSocial ABI, including tenant-scoped Notary and (appId,payer)-scoped GAS/NEO credits with native prepayment, tenant/global liability reads, and pause-immune exits. Timestamp Proof contains a guarded dual path that uses Notary only when an explicit shared PlatformSocial engine binding exists and otherwise preserves its current zero-GAS self-transfer receipt flow. PlatformSocial has no retained deployment record and configured production consumers remain zero; no app should add the shared binding until deployment, registration, compatibility, and lifecycle gates pass.
