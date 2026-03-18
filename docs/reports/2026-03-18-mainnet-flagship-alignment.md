# 2026-03-18 Mainnet Flagship Alignment

This report records the mainnet flagship contract alignment and post-update
validation performed on 2026-03-18.

## Scope

Aligned flagship mainnet contracts:

- `LastSurvivor`
- `GASBOX`
- `Red Envelope`
- `Daily Check-in`
- `FogPlay`
- `SelfLoan`

`NeoPay` was already ABI-aligned and did not require an update.

## Mainnet Update Transactions

The following update transactions were submitted from mainnet admin
`NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK`:

- `LastSurvivor`: `0xa61f6f2b4a7472a241759be1f8ec11104fe40e8c145c29bdc7d9f4605ac97e96`
- `GASBOX`: `0x909e946b7188acabfd95e8bb58d6ddae6e833bfe061a8bc7903f8542a8082872`
- `Red Envelope`: `0x68ad350ff65f6cccaafb965076de3a9a465dff484f348b28f5aa8032593c4337`
- `Daily Check-in`: `0x0a9f5aefc94dd409b19579e24b4f79c66c6331d336c1de99babbd42c05043f2f`
- `FogPlay`: `0x6dfc69231e0a8846d6075a4a2b881aeaa64107288c039bc1397a45708ea3b4b4`
- `SelfLoan`: `0xacb173f46c138cea5363b4c8a43f84db0cc3031a76e9765a9b6c4e1a4ab66604`

## Post-Update Mainnet ABI Audit

Validation entrypoint:

```bash
NEO_TARGET_NETWORK=mainnet node deploy/scripts/audit_flagship_deployed_abi.js
```

Result:

- all flagship mainnet contracts now match the current local build ABI
- zero remaining ABI drift was reported after the updates above

## Post-Update Mainnet Active-State Audit

Validation entrypoint:

```bash
NEO_TARGET_NETWORK=mainnet node deploy/scripts/verify_flagship_active_state.js
```

Result:

- all flagship mainnet contract hashes matched host definitions
- all read checks returned `HALT`
- zero active-state problems were reported

## Mainnet Live User Flows

Validation entrypoint:

```bash
FLAGSHIP_LIVE_WIF=... NEO_TARGET_NETWORK=mainnet node deploy/scripts/live_validate_flagship_user_flows.js
```

Successful mainnet flows:

- `dailyCheckin`
- `lastSurvivor`
- `gasBox`
- `fogPlay`
- `redEnvelope`
- `neoPay`

Representative successful txs from the validation run:

- `dailyCheckin`: `0x74ef3c7422ab10e11a75bba7d2252446fbedf7277c5a91f0ffea96a85429a069`
- `lastSurvivor buy`: `0xb8377e1c76d52f22029b39365408c956a1161b3fe783e8381126690a22ecfd1f`
- `gasBox settle`: `0x9340d596a65ce53c972d7e4f9fdb77e84f80f5d81ab008510e9ffb24cacaeb86`
- `fogPlay bet`: `0xf55a48859d210856446a6000d75c2c495377f622e83eaed1ad534d4c8bb47dca`
- `redEnvelope create`: `0xc5c5b17a32c74519e48b297ce9f5b3af15978f6e14079c478ef038b0617a3868`
- `neoPay create`: `0xbb12fe4368a61d914fa4bca7c9a2e1631f300eecf8d9f1e14214573c742bf927`

## Mainnet SelfLoan Status

`SelfLoan` is no longer a contract-logic blocker on mainnet. After the mainnet
update, the remaining validation blocker is the wallet balance of the testing
account:

- current flagship mainnet validation signer: `NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK`
- current mainnet NEO balance observed during validation: `0`
- `SelfLoan` needs at least `1 NEO` collateral for the live flow

The validation script now reports this explicitly:

- `insufficient wallet NEO balance for selfLoan collateral: need 1, have 0`

This is a funding precondition issue, not a post-update ABI or contract logic
mismatch.

## Current Assessment

As of 2026-03-18:

- flagship mainnet ABI is aligned with current source
- flagship mainnet read paths are healthy
- 6 of 7 flagship mainnet live flows were validated successfully
- the remaining incomplete flagship mainnet live flow (`SelfLoan`) is blocked by
  missing NEO collateral in the available testing wallets, not by a known
  contract defect

## Additional Mainnet ABI Alignment

After the flagship set was aligned, a second ABI audit was performed on the
next source-owned, dual-network app tier:

- `FlashLoan`
- `BurnLeague`
- `BreakupContract`
- `DevTipping`

Mainnet update transactions:

- `FlashLoan`: `0xdec59891319405c4c6b34b10d4dbc9385cd8c7623247d1e5ffc3d3831c885578`
- `BurnLeague`: `0x7fbe1cce829cd95709c3474f24e06d3e217d4b80490ab006118073f1c3307464`
- `BreakupContract`: `0x2c5fba5c6d862c69c2bda088494653467df2cc1f2fc91196c5bee793643ff101`
- `DevTipping`: `0xfaad491d7c0dd77d9f4798a8dd6630d8b479eee8d90d805d7dde5c9ef3151085`

Post-update ABI verification for those four contracts returned zero problems.
