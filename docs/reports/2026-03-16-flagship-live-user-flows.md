## Scope

This report captures real Neo N3 testnet execution for the seven current
flagship miniapp paths:

- LastSurvivor
- GASBOX
- Red Envelope
- Daily Check-in
- FogPlay
- SelfLoan
- NeoPay

All actions below were executed with the shared testnet account:

- address: `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`

## Contract Hashes

| App | Testnet Contract |
| --- | --- |
| LastSurvivor | `0xf0914d411877c8393c029f48ec0c4c64d44f1b49` |
| GASBOX | `0x523c112560a2e196fa0fcfa215d93c08e117d9c1` |
| Red Envelope | `0x4079c09a0ff121fc44d817c37d6ae8694b268e9f` |
| Daily Check-in | `0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528` |
| FogPlay | `0x43f953c00931ca38044bf0e5ca50d608aea7ae8b` |
| SelfLoan | `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` |
| NeoPay | `0x89d2499928e3035247186f412934d6b0e0b665ef` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

## Mainnet Flagship Rollout

Mainnet contracts and miniapp subdomains currently deployed / updated:

| App | Mainnet Contract | Domain | Notes |
| --- | --- | --- | --- |
| LastSurvivor | `0x180a3a35c088eab4feded508c2ccb1556e07a840` | `lastsurvivor.miniapp.neo` | newly deployed to correct manifest name |
| GASBOX | `0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c` | `gasbox.miniapp.neo` | newly deployed to correct manifest name |
| Red Envelope | `0x5f371cc50116bb13d79554d96ccdd6e246cd5d59` | `redenvelope.miniapp.neo` | updated in place |
| Daily Check-in | `0xbd4f3646e189350b9c11a659655854e6f03f9be4` | `dailycheckin.miniapp.neo` | newly deployed to correct manifest name |
| FogPlay | `0xa5a4b5b82066d86eae9312f6072d1c3604882c81` | `fogplay.miniapp.neo` | newly deployed to correct manifest name |
| SelfLoan | `0x942da575b31f39cbb59e64b5813b128739b44c25` | `selfloan.miniapp.neo` | updated in place |
| NeoPay | `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34` | `neopay.miniapp.neo` | newly deployed; first mainnet address |

Mainnet dependency alignment completed:

- all 7 flagship contracts now point `abstractAccount` to mainnet AA Core `0x9742b4ed62a84a886f404d36149da6147528ee33`
- `FogPlay` and `Red Envelope` point `oracle` to mainnet Morpheus Oracle `0x017520f068fd602082fe5572596185e62a4ad991`
- those callback consumer contracts are allowlisted on the mainnet Oracle and funded with callback fee credit

## Live Validation Summary

### Daily Check-in

- check-in tx: `0xae9ffef5daf02b4c215c2861b202f3cb0ee040dab80cfa2f4348082b4039417c`
- result:
  - direct `GAS.transfer` path succeeded
  - `CheckedIn` notification present

### LastSurvivor

Validated user flow:

- round start tx: `0x07b12014aad9a3699a9d7c1e5c2526fa4d5abf25e0393b4501506a743bc459ed`
- payment tx: `0x2c7f06f2f3d11c4cd136c9ee71b27f171cdd7d3bfc328952aa92bb4c0aa9c350`
- buy tx: `0x5f34e37310ec071f10faa4989369ce61650149725f201d6ffb35e1c9675bae3c`
- result:
  - `startNewRound` HALTed
  - direct prepaid `GAS.transfer` into the MiniApp contract succeeded
  - `buyKeysWithCost` HALTed
  - `KeysPurchased` emitted
  - `TimeExtended` emitted
  - `getGameStatus()` returned:
    - `roundId = 7`
    - `active = true`
    - `pot = 9500000`
    - `totalKeys = 1`
    - `lastBuyer = NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`
  - `getPlayerKeys(address, 7) = 1`

### GASBOX

This path required a fresh testnet redeploy and signer-safe hybrid settlement
fixes before the live flow could pass.

Key deployment and validation transactions:

- deploy tx: `0xbf0a240019a57a3033392401c3653b779592f3ec4c3eb9ca5a790e09dd13d1ce`
- script registration tx: `0x87cecd9d0b42634da648572a2fa1f1f1e500c140e0f4daee46fcad1741289cba`
- final update tx: `0x5b5e15ac096acf0d4919b0437439b15db348082109425fff6f0e077e63221136`

Latest live user flow:

- machine id: `2`
- play payment tx: `0xfc9705c3657493bacebae61e815202f366a140a0a9bfb694e1517c329f30c023`
- initiate tx: `0x4799a6d03b751c92b7f80a11933c61192eb880abc82d8f6e8fd39687a86ef761`
- play id: `8`
- settle tx: `0xd2744b8aca125b98ebc7aed74f92268a10ef69fb2d36bb849559b82ae7cfa633`
- result:
  - direct `GAS.transfer` payment path succeeded
  - `PlayInitiated` emitted
  - on-chain `debugExpectedSelection(playId)` matched the winning index
  - real `settlePlay` HALTed successfully
  - `PlayResolved` emitted with GAS prize transfer
  - `getPlay(8)` returned `resolved = true` and `itemIndex = 1`

### FogPlay

This path required explicit Oracle callback-fee top-up to the callback contract
credit pool before submitting the randomness request.

- oracle fee top-up tx: `0xc7317660b584dc9354f9b0a3822ef5538622548d240d214c5e51f6d89b23793d`
- prepaid GAS tx: `0xe0494e9247590e798317678b87ffbff666e7580c27da9075c09b62604c39532e`
- bet tx: `0xd96503fd69bcd369d01a487697fcdfc1759d23752a29295546c5e3d6058aa0c5`
- oracle request id: `3871`
- result:
  - `BetPlaced` emitted
  - Oracle request fulfilled successfully
  - `getRequest(3871)` reached fulfilled status
  - stored bet `betId = 11` resolved

### Red Envelope

This path also required explicit Oracle callback-fee top-up for the callback
consumer contract.

- oracle fee top-up tx: `0x7969982f0412b482bab2803131eccfa43b366678611169de80298ae03b756990`
- prepaid GAS tx: `0x2fb1785fa897672cb071f7ab49c60bb13c713ca1aa765f006884d36d239e126a`
- create tx: `0x0b459265bae25bf0f1919ec39db865e6b463981542d4e528826b7ef60584c5df`
- oracle request id: `3872`
- envelope id: `10`
- claim tx: `0x7099726e2e4855b6500d3ae246b433cfc361470cad616d68b2513ee6f3c6081e`
- result:
  - `EnvelopeCreated` emitted
  - Oracle request fulfilled successfully
  - `getEnvelope(10)` reached `Ready = true`
  - `EnvelopeClaimed` emitted
  - GAS claim transfer succeeded

### SelfLoan

This path is running on the direct NEO collateral credit plus explicit GAS pool
funding design.

- pool funding tx: `0x74af7b6c7af55a64f5bb8eb3aa25b9fbbe5e569b7edaae355d737fde97d4c297`
- collateral tx: `0x3cf8963a4bed2a29f0221ac484d35cb3820e7665c89bc01b1319ef2b6b19ddb3`
- create-loan tx: `0x4cb3bec61ca31fda265b0ec429b12bfddb7365e1b394de9096c34f10f68eec2b`
- result:
  - `LoanCreated` emitted
  - `loanId = 8`
  - `collateral = 1`
  - `debt = 20000000` (`0.2 GAS`)

### NeoPay

This path required a contract update to switch stream creation from contract-side
asset pulling to prepaid asset credit consumption.

- contract update tx: `0x1f398e6051213b4b1ed7596ed30e331f65e39164953c05bff6d153e4849df31d`
- funding tx: `0x48219f1196bbedb4b5bcd5fbbec83fdfa66c0b7de7a95eee7f73ca646ce76c97`
- create tx: `0x696232fd4bc6896d075247bacc1069d62e8d868085b0b65a17ff8736b23af556`
- stream id: `6`
- cancel tx: `0x365b51aa646909880847b9c60cc2626c5a12f871529870a78b87caecfe91d8fa`
- result:
  - prepaid GAS funding to contract succeeded
  - `createStream` HALTed and emitted `StreamCreated`
  - `getStreamDetails(6)` returned active stream state
  - `claimStream` simulation rejected with `nothing claimable` before interval unlock
  - `cancelStream` HALTed and emitted `StreamCancelled`
  - `getStreamDetails(6)` returned `status = cancelled`

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

For `FogPlay` and `Red Envelope` to remain healthy on testnet:

- the fixed local or upgraded remote Morpheus relayer must remain the active
  Oracle updater
- callback consumer contracts must retain at least one Oracle request fee of
  prepaid credit (`0.01 GAS` at the current testnet setting)
