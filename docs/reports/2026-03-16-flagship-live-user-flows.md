# 2026-03-16 Flagship Live User Flows

## Scope

This report captures real Neo N3 testnet user-flow execution for the currently
verified flagship paths:

- Daily Check-in
- GASBOX
- FogPlay
- Red Envelope
- SelfLoan

All actions below were executed with the shared testnet account:

- address: `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`

## Contract Hashes

| App | Testnet Contract |
| --- | --- |
| Daily Check-in | `0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528` |
| GASBOX | `0x523c112560a2e196fa0fcfa215d93c08e117d9c1` |
| FogPlay | `0x43f953c00931ca38044bf0e5ca50d608aea7ae8b` |
| Red Envelope | `0x4079c09a0ff121fc44d817c37d6ae8694b268e9f` |
| SelfLoan | `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

## Live Validation Summary

### Daily Check-in

- check-in tx: `0x8670ee0358ee127b289085707e0038f3899e54939c8b7e32158d482efe406bed`
- path:
  - direct `GAS.transfer`
  - contract auto-check-in in `OnNEP17Payment`
- result:
  - `CheckedIn` notification present

### GASBOX

This path required a fresh testnet redeploy plus in-place updates until the
hybrid settle path became signer-safe under real `settlePlay` execution.

- update tx: `0x5b5e15ac096acf0d4919b0437439b15db348082109425fff6f0e077e63221136`
- validation machine: `machineId = 1`
- prepaid GAS tx: `0x4f8266d30b175de8a1f78f049fa01c908d599b41afdfddb3094c7860ae0c155f`
- initiate tx: `0xae3be658943e45432fcb7c421e34390418feb9658257747dff25ccbc56a3c3a8`
- play id: `4`
- settle tx: `0x827af9c1b791f03167f4f11875c5044e109858f618c23fa2a37ab669ff5ee30b`
- result:
  - fresh contract deployed to `0x523c112560a2e196fa0fcfa215d93c08e117d9c1`
  - `select-item` hybrid script registered successfully
  - direct `GAS.transfer` payment path succeeded
  - `PlayInitiated` emitted
  - on-chain `debugExpectedSelection(playId)` matched client expectation
  - real `settlePlay` HALTed successfully
  - `PlayResolved` emitted with GAS prize transfer
  - `getPlay(playId)` returned `resolved = true` and `itemIndex = 1`

### FogPlay

- prepaid GAS tx: `0xaee7b7ca1297e1564bf3fea780cee904256f3516e5b2a8547d6eadf5b37df01e`
- bet tx: `0x6b44cae8d3ff7f72d0a7a2f8551fc0dc93f72f21830793a1c25e3f44929c119e`
- oracle request id: `3863`
- result:
  - `BetPlaced` emitted
  - Oracle request fulfilled successfully
  - `getRequest(3863)` reached fulfilled status
  - stored bet `betId = 8` resolved

Additional isolated updater validation after re-separating the Oracle updater:

- oracle request id: `3860`
- relayer route: `/vrf/random`
- result:
  - fulfilled successfully by the isolated local relayer

### Red Envelope

- prepaid GAS tx: `0x4a321a107ad84b1f7cd95d96d091fbb6c5aa5b473cd8a832ba59c14d7b11b023`
- create tx: `0x040a53b87ec39a53be8c323ec46245585a0475658eb4d94b9762e0ac99449d2d`
- oracle request id: `3864`
- envelope id: `5`
- claim tx: `0xc1e03c55739dd1aa480a790919a0014495ef1340e84417760b6264a0a24855ff`
- result:
  - `EnvelopeCreated` emitted
  - Oracle request fulfilled successfully
  - `getEnvelope(5)` reached `Ready = true`
  - `EnvelopeClaimed` emitted
  - GAS claim transfer succeeded

### SelfLoan

This path required the contract to be updated in place to use:

- direct NEO collateral credit
- explicit GAS pool funding
- two-step borrow flow

Latest isolated validation after the final contract update:

- pool funding tx: `0x794945538163ecdc7847495509469135011c3f931723bdb05129f66ad91f34c1`
- collateral tx: `0x271c2453c0858c0e7f81663fd253a33e7dd29554974b494eaa5880a4c5b57483`
- create-loan tx: `0x2543f7d5616e7a14c19fa1155d05f7b7cce67cc025597c6301a61d56e12b38d9`
- result:
  - `LoanCreated` emitted
  - `loanId = 3`
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
