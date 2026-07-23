# Joint Platform Abstract Account Interface

Generated: 2026-07-23T01:33:25.431Z

Status: **PASS**

| Check | Result |
| --- | --- |
| registry_abi_exact | PASS |
| aa_abi_exact | PASS |
| registry_least_privilege_calls | PASS |
| registry_binding_domain_separated | PASS |
| registry_automatic_onboarding | PASS |
| registry_core_disable_timelocked | PASS |
| aa_registrar_calling_contract_gate | PASS |
| aa_registrar_timelocked | PASS |
| aa_owner_control_preserved | PASS |

## Verified Boundary

- PlatformRegistry and UnifiedSmartWalletV3 local artifacts agree on the registrar/account ABI.
- New registrations auto-create a shared AA only after an AA core is configured; existing rows use `materializeAbstractAccount`.
- The platform registrar creates a zero-plugin account owned by appAdmin; appAdmin can later install verifier/hook modules.
- Registry core activation and disable both use the same 24-hour timelock; disabling preserves existing app identities.
- This report is local artifact evidence only. It does not prove either upgraded contract is deployed or configured on testnet.
