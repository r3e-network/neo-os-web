# Platform Contract Testnet Live Verification

Generated: 2026-07-30T11:18:12.517Z

## Summary

- Network: neo-n3-testnet (magic 894710606)
- Read-only: yes
- Chain writes performed: no
- RPC: https://testnet1.neo.coz.io:443
- Live contracts found: 5
- Active Registry artifacts: 1
- Current local artifact matches: 1/7
- Artifact drifts: 5
- No deployment record: 1
- Distinct contract-admin domains: 2
- Boundary: Read-only RPC evidence proves current testnet contract identity and NEF checksum only. It does not prove funded lifecycle behavior, mainnet parity, or operational health.

## Ledger

| Contract | Evidence kind | Testnet target | Admin | Local checksum | Testnet checksum | Update | ABI missing on-chain | Status |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| PlatformRegistry | contract | 0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b | 0x13ef519c362973f9a34648a9eac5b71250b2a80a | 1192239435 | 372915605 | 0 | 12 | live-artifact-drift |
| AppAccount | registry-artifact | 0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b | n/a | 2055764547 | 2055764547 | n/a | n/a | active-artifact-match |
| MiniAppFactory | contract | 0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49 | 0x6d0656f6dd91469db1c90cc1e574380613f43738 | 905792977 | 2240313340 | 0 | 1 | live-artifact-drift |
| PlatformAnchor | contract | 0xab079b4f9a0a2471d136392e25eb8e99898dcad0 | 0x6d0656f6dd91469db1c90cc1e574380613f43738 | 4069501170 | 1604090204 | 0 | 6 | live-artifact-drift |
| PlatformGame | contract | 0xc75b181b4561462903bb27d8d9e0b32b637bec12 | 0x13ef519c362973f9a34648a9eac5b71250b2a80a | 1709745112 | 2377918952 | 1 | 0 | live-artifact-drift |
| PlatformDeFi | contract | 0x39d4584ddb0731e48e611647931993ee033bf373 | 0x6d0656f6dd91469db1c90cc1e574380613f43738 | 1576392343 | 3687605410 | 0 | 47 | live-artifact-drift |
| PlatformSocial | undeployed | none | n/a | 849054580 | n/a | n/a | n/a | no-deployment-record |
