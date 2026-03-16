# 2026-03-16 Flagship Live User Flows

## Scope

This report captures real Neo N3 testnet user-flow execution for the currently
verified flagship paths:

- Daily Check-in
- FogPlay
- Red Envelope
- SelfLoan

All actions below were executed with the shared testnet account:

- address: `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`

## Contract Hashes

| App | Testnet Contract |
| --- | --- |
| Daily Check-in | `0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528` |
| FogPlay | `0x43f953c00931ca38044bf0e5ca50d608aea7ae8b` |
| Red Envelope | `0x4079c09a0ff121fc44d817c37d6ae8694b268e9f` |
| SelfLoan | `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

## Live Validation Summary

### Daily Check-in

- check-in tx: `0xca385eb785d7e5c1f835795cea003fc2edff5f9a14818a5f12dd4b63e719afd9`
- path:
  - direct `GAS.transfer`
  - contract auto-check-in in `OnNEP17Payment`
- result:
  - `CheckedIn` notification present

### FogPlay

- prepaid GAS tx: `0x10075a202c8e5ca0f941ab1d6d48351bed60ce86374c7e0bdb207d63e627b401`
- bet tx: `0xfbe5f3dd0d2e64b7de7243ff67f4c20521b3b6a61f39b56c14dc981aa7076473`
- oracle request id: `3861`
- result:
  - `BetPlaced` emitted
  - Oracle request fulfilled successfully
  - `getRequest(3861)` reached fulfilled status
  - stored bet `betId = 7` resolved

Additional isolated updater validation after re-separating the Oracle updater:

- oracle request id: `3860`
- relayer route: `/vrf/random`
- result:
  - fulfilled successfully by the isolated local relayer

### Red Envelope

- prepaid GAS tx: `0x9615b7a2304e310844095c288dc35e60bced367ffb57834863b8a9ddd656e435`
- create tx: `0xc5d96e8b56d757ba4d9b26e2cb54a7c639caa99eb6cc2dc699921f1260f9e1e8`
- oracle request id: `3862`
- envelope id: `4`
- claim tx: `0x63d13f89deaa7b22b0958e68dd34ce805720c9754d7130235d003865abeb9689`
- result:
  - `EnvelopeCreated` emitted
  - Oracle request fulfilled successfully
  - `getEnvelope(4)` reached `Ready = true`
  - `EnvelopeClaimed` emitted
  - GAS claim transfer succeeded

### SelfLoan

This path required the contract to be updated in place to use:

- direct NEO collateral credit
- explicit GAS pool funding
- two-step borrow flow

Validated transactions:

- pool funding tx: `0x80d8651bf0b834e14eb0c1dcb344a4cd98e124b612c6af3060d499457d10afda`
- collateral deposit tx: `0xf1da4fc6c69f740bba7cc7416d33ba4e09af7a89de56c4ea785f41ebe7f93ae2`
- create-loan tx: `0xf5ab63bfbf152f9a5adbf5a0d74ae9ff830fceff36d4ebd8fca9909a56049a13`

Further isolated validation after the final contract update:

- pool funding tx: `0x7b95e8fbdcd0a0c5f206cf089bb92109ec24cd210a743b3c6f4a449d81d2153d`
- collateral tx: `0xb2597e1f0ccb16e14b5b97b0f1788084ea83c6fbd2da185323cdb002783e9ac9`
- create-loan tx: `0xd3efe7e23da846911b45784737f2c754eb866f3ad81b6724630f0bbaf2892f3f`
- result:
  - `LoanCreated` emitted
  - `loanId = 1`
  - `collateral = 1`
  - `debt = 20000000` (`0.2 GAS`)
  - account NEO decreased by `1`
  - account GAS increased by the borrowed amount after fee

## Runtime Notes

### Oracle / RNG Execution

The current live testnet `rng` flows depend on the fixed local Morpheus stack.

Reason:

- the external/shared relayer still contains older `rng` routing behavior
- it can misroute `request_type = rng` to URL-fetch handling and return
  `Invalid URL`

To avoid that during validation, the testnet Morpheus Oracle updater was moved
to an isolated local updater account and the local fixed relayer was used to
fulfill callback requests.

Current isolated updater:

- address: `NNeEe3uKiphx13iF5TLgmwgrduwPU2uK4d`

Latest updater-switch tx:

- `0x9eeb866f9c46f335d400a87ef5fe9eed8a743565aada039a22f8a8f871f3d8d0`

## Operational Requirement

For `FogPlay` and `Red Envelope` to remain healthy on testnet, the fixed local
or upgraded remote Morpheus relayer must remain the only actor with Oracle
`updater` authority.

If updater authority is returned to an older relayer build before it is
upgraded, new `rng` requests can regress even though the contracts and frontends
are already correct.
