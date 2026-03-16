# 2026-03-16 Flagship Testnet Validation Round 2

## Scope

This round re-validated the seven flagship Neo N3 miniapps against their current
testnet deployments and current host-side integration state.

Validated apps:

1. LastSurvivor
2. GASBOX
3. Red Envelope
4. Daily Check-in
5. FogPlay
6. SelfLoan
7. NeoPay

## What Was Added

- Added `deploy/scripts/verify_flagship_testnet_state.js`
- Added npm script `test:flagship-testnet-state`
- Extended `test:flagship-deployed-abi` coverage to include NeoPay
- Updated `update_flagship_testnet_contracts.go` target list to include NeoPay
- Fixed `MiniAppStreamVault.getStreamDetails(streamId)` so missing ids no longer FAULT

## NeoPay Fix

An actual testnet bug was found during read-only validation:

- `MiniAppStreamVault.getStreamDetails(0)` returned `FAULT`
- RPC exception: `division by zero`

Root cause:

- `GetStreamDetails` computed payout math before rejecting an uninitialized
  stream record

Fix:

- guard missing / invalid streams before payout math
- rebuild and redeploy NeoPay on testnet

New NeoPay testnet deployment:

- contract hash: `0x89d2499928e3035247186f412934d6b0e0b665ef`
- deployment tx: `0xc557b52e4ad99c9761bcaf29278b1be004d50cd547e5e2b81c45c43818983156`

## Verification Performed

### 1. Flagship testnet state smoke

Command:

```bash
npm run -s test:flagship-testnet-state
```

Checks:

- manifest active network address exists
- host definition hash matches manifest hash
- remote contract name matches expected contract
- key read-only methods HALT with expected stack types

Result:

- all 7 flagship apps passed

### 2. Flagship deployed ABI check

Command:

```bash
npm run -s test:flagship-deployed-abi
```

Result:

- all 7 flagship apps passed

### 3. Repository tests

Command:

```bash
npm test -- --runInBand
```

Result:

- passed

### 4. Flagship frontend production builds

Commands:

```bash
cd apps/doomsday-clock && npm run -s build
cd apps/neo-gacha && npm run -s build
cd apps/red-envelope && npm run -s build
cd apps/daily-checkin && npm run -s build
cd apps/coin-flip && npm run -s build
cd apps/self-loan && npm run -s build
cd apps/stream-vault && npm run -s build
```

Result:

- all 7 flagship frontend builds passed

Note:

- `apps/coin-flip` still emits a Sass deprecation warning for `random()`
- build still succeeds

### 5. Cross-repo direct Oracle / direct AA validation

Command:

```bash
AA_TEST_WIF=<testnet-wif> npm run -s test:testnet:direct
```

Result:

- direct Oracle path passed
- direct AA + paymaster relay path did not pass in this environment

Observed Oracle success:

- txid: `0x34b6fd07123b022ffba06c1276aeb8df3c7017926550d79eff0413ffd02dc680`

Observed AA failure:

- relay returned `paymaster_authorization_failed`
- when allowlist update was enabled manually, the worker update path failed at
  `phala cp` / `scp` with `Permission denied (publickey)`

Interpretation:

- direct Oracle integration is currently validated live
- direct AA paymaster validation is blocked by Morpheus worker-side operational
  access, not by a local compile or manifest mismatch

## Current Verified Testnet Contracts

| Brand | Contract |
| --- | --- |
| LastSurvivor | `0xf0914d411877c8393c029f48ec0c4c64d44f1b49` |
| GASBOX | `0x523c112560a2e196fa0fcfa215d93c08e117d9c1` |
| Red Envelope | `0xa28379b2e0a608053458d435acd7041fc4a0fded` |
| Daily Check-in | `0x297bfabe68535ab1abfadb843d5a5c00db7aca75` |
| FogPlay | `0x01d0e1f78ea5a76b6bb0bce26649d5bf449999e0` |
| SelfLoan | `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` |
| NeoPay | `0x89d2499928e3035247186f412934d6b0e0b665ef` |

## Conclusion

The flagship seven now have:

- verified active testnet addresses
- matching remote ABI deployments
- matching host definition hashes
- passing read-only testnet smoke checks
- passing local test and frontend build baselines

What is still not validated end-to-end:

- live AA paymaster relay execution from the platform validation script, because
  the current environment cannot update or confirm the Morpheus worker allowlist
  path successfully
