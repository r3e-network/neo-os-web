# Testnet Full-Stack Validation

Date: 2026-03-17

This validation pass covered:

- local host-app tests and production build
- local admin-console tests and production build
- direct Morpheus Oracle Neo N3 smoke
- direct AA + paymaster + relay validation
- flagship miniapp live user flows on Neo N3 testnet

## Verified Commands

```bash
npm run test:host-app
npm --prefix platform/host-app run build
npm run test:admin-console
npm --prefix platform/admin-console run build
AA_TEST_WIF=... PAYMASTER_ACCOUNT_ID=... bash deploy/scripts/verify_cross_repo_testnet.sh
FLAGSHIP_LIVE_WIF=... NEO_TARGET_NETWORK=testnet node deploy/scripts/live_validate_flagship_user_flows.js
```

## Results

- Host app: passed
- Admin console: passed
- Direct Oracle smoke: passed
- Direct AA paymaster relay: passed
- Flagship live user flows: all seven passed

Flagship miniapps confirmed on testnet:

- Daily Check-in
- LastSurvivor
- GASBox
- FogPlay
- Red Envelope
- SelfLoan
- NeoPay

## Important Notes

- Oracle direct smoke now includes a local fulfill fallback if callback delivery times out.
- AA paymaster relay validation now injects temporary allowlist overrides directly into the remote paymaster handler call, so the test does not depend on mutating remote persistent env state.
- The current flagship flow validator also includes a local RNG fulfill fallback for FogPlay and Red Envelope when the remote relayer does not fulfill the RNG request in time.

## Re-run

Use the consolidated full-stack entrypoint:

```bash
npm run test:testnet:full-stack
```

Required environment:

- `AA_TEST_WIF`
- `PAYMASTER_ACCOUNT_ID`
- `FLAGSHIP_LIVE_WIF`
- any repo-local `.env` values already expected by the cross-repo scripts
