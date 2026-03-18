# 2026-03-18 Cross-Repo Flagship Testnet Validation

This report records the latest successful joint validation across:

- `neo-miniapps-platform`
- `neo-morpheus-oracle`
- `neo-abstract-account`

## Summary

- direct Oracle testnet smoke passed
- direct AA paymaster + relay testnet flow passed
- flagship live testnet user flows passed for all 7 flagship MiniApps
- testnet flagship deployed ABI audit returned zero problems after updating `SelfLoan`

## Key Fix Applied

The default stable paymaster account in `deploy/scripts/verify_cross_repo_testnet.sh`
was updated to the currently allowlisted testnet AA account:

- `0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56`

This removed a real cross-repo failure:

- previous failure: `paymaster_denied`
- reason: `account_id is not allowlisted`

## Oracle + AA Cross-Repo Validation

Validation entrypoint:

```bash
AA_TEST_WIF=... ORACLE_TEST_WIF=... bash deploy/scripts/verify_cross_repo_testnet.sh
```

Observed successful results:

- Oracle request tx: `0x4ecf6ff3c6f8c9cef3a23d4affec33405ad811956f20e1ebe74034f137e6e132`
- Oracle callback success: `privacy_oracle`
- Oracle callback included signed result + TEE attestation
- AA relay tx: `0x49c567e3ee64e08fa6e0ba96f0757a24b268ee3205bd13574b5726443e181dad`
- Paymaster verdict: `approved: true`
- Final AA on-chain execution: `HALT`

## SelfLoan Testnet Contract Alignment

During testnet ABI verification, `SelfLoan` was the only flagship contract that
still drifted from the current source:

- deployed testnet ABI exposed `repayDebt/4`
- current source exposes `repayDebt/3`

The testnet flagship update script was used to align the deployed contract with
the current source:

- update tx: `0x03e3bb20d845a916faefe30c5326a491e3b485ecb50803660efb775dcda0356f`

After the update:

- `NEO_TARGET_NETWORK=testnet node deploy/scripts/audit_flagship_deployed_abi.js`
  returned zero problems
- `selfLoan` live flow still passed

## Flagship Live Testnet User Flows

Validation entrypoint:

```bash
FLAGSHIP_LIVE_WIF=... NEO_TARGET_NETWORK=testnet node deploy/scripts/live_validate_flagship_user_flows.js
```

Successful flagship flows:

- `dailyCheckin`
- `lastSurvivor`
- `gasBox`
- `fogPlay`
- `redEnvelope`
- `selfLoan`
- `neoPay`

Representative successful txs from this run:

- `dailyCheckin`: `0x096a3224c498fee867be1338761e81b37eaee746f336f28aaa11ef29bd8d89ce`
- `lastSurvivor buy`: `0x5633735a666fb0c5967d158807bdac5198e0ff469ce324e6f467310529d7ecd2`
- `gasBox settle`: `0xf5cbe8168870cb4ba4f1a9b2a476fca0bc9dfe3da8008b6c51662c5042d7195b`
- `fogPlay bet`: `0x652e6805260709774f9a75589ba794892e2be253a74e63f5ccd07b9246827cdd`
- `redEnvelope create`: `0x64008661ed5708551a79b978a1a2dc32bdea1413897562babac5dfda03dc491b`
- `selfLoan create`: `0x794a4b72f743694ff497963e6355c2d3fabfcc50b3afd75b2cac3c7e4acf87e6`
- `neoPay create`: `0x876019ca96b9c557511255b909f51c29992db8b5c54479e3232d1a258765b7aa`

## Current Assessment

As of 2026-03-18, the preferred testnet path is now jointly validated at three
levels:

- Oracle runtime and callback
- AA relay + paymaster authorization
- flagship MiniApp product flows

The remaining ABI drift previously observed is now a **mainnet-only**
consistency concern, not a current testnet blocker.
