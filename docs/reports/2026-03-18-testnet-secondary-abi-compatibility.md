# 2026-03-18 Testnet Secondary ABI Compatibility

This report narrows the current testnet status of the non-flagship,
source-owned miniapps that are still relevant for broader platform validation.

## Scope

Focused apps:

- `breakup-contract`
- `burn-league`
- `flashloan`
- `on-chain-tarot`
- `unbreakable-vault`

These were selected because they either:

- had earlier read-path `FAULT`s in generic probing, or
- represent product categories still worth validating beyond the flagship set

## Method

Validation compared:

1. the frontend methods actually invoked by the current miniapp UI
2. the ABI methods exposed by the currently deployed **testnet** contract

This avoids false negatives caused by probing the wrong read method and gives a
direct answer to the practical question:

- does the current frontend still match the current testnet deployment?

## Results

### `burn-league`

Superseding testnet deployment:

- contract: `0x0946e3c3db8abdd2fa14bbae4978992015473c09`
- remote name: `MiniAppBurnLeague`

Frontend / contract alignment:

- frontend now calls `totalBurned`
- frontend now calls `rewardPool`
- frontend now calls `getUserTotalBurned`
- `burnGas/2` matches the current deployment

Live smoke:

- `startSeason -> burnGas` succeeded
- `totalBurned` and `getUserTotalBurned` both advanced on-chain

Assessment:

- current frontend and current testnet deployment are aligned
- current write path is validated

### `breakup-contract`

Superseding testnet deployment:

- contract: `0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8`
- remote name: `MiniAppBreakupContract`

Frontend / contract alignment:

- frontend now calls `getContractDetails`
- frontend now calls `triggerBreakup`
- `createContract/6` and `signContract/2` match the current deployment

Live smoke:

- `createContract -> signContract -> triggerBreakup` succeeded
- `getContractDetails` reflects a completed breakup with penalty accounting

Assessment:

- current frontend and current testnet deployment are aligned
- current write path is validated

### `on-chain-tarot`

Superseding testnet deployment:

- contract: `0x5cdf29c30727ce06696736ae0fb49abd9fd79730`
- remote name: `MiniAppOnChainTarot`

Frontend / contract alignment:

- frontend now pays the correct `0.1 GAS` for the three-card spread
- frontend now submits `spreadType=2` and `category=1`
- current deployment uses `requestFromCallback` semantics for Oracle RNG
- current callback decoder consumes raw randomness bytes from Morpheus relayer

Live smoke:

- `requestReading/4` succeeded
- `getReadingDetails` returned `completed=true`
- cards were written on-chain for the request

Assessment:

- current frontend and current testnet deployment are aligned
- Oracle-backed write path is validated

### `unbreakable-vault`

Superseding testnet deployment:

- contract: `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0`
- remote name: `MiniAppUnbreakableVault`

Frontend / contract alignment:

- frontend now calls `getVaultDetails`
- `createVault/6` and `attemptBreak/3` match the current deployment

Live smoke:

- `createVault -> attemptBreak` succeeded
- `getVaultDetails` reflects the increased bounty and incremented attempt count

Assessment:

- current frontend and current testnet deployment are aligned
- current write path is validated

### `flashloan`

Superseding testnet deployment:

- contract: `0xde8e595d8d3c293731db499367ee2a768e1e458b`
- remote name: `MiniAppFlashLoan`

Frontend / contract alignment:

- frontend now targets `requestLoan`
- current deployment uses direct prepaid GAS pool funding rather than
  `PaymentHub` receipt validation
- the live model is self-contained atomic callback execution

Live smoke:

- callback harness: `0x7aa01290d33f6b2313a7efd6acde58f3e64b636f`
- `deposit -> requestLoan -> callback execute -> exact repayment` succeeded
- `getLoanDetails` returned `success=true`
- `getPoolBalance` increased by the expected fee amount

Assessment:

- current frontend and current testnet deployment are aligned
- current write path is validated

## Practical Conclusion

### Testnet-compatible right now

- `flashloan`
- `burn-league`
- `breakup-contract`
- `on-chain-tarot`
- `unbreakable-vault`

This means the phrase “all source-owned secondary miniapps covered in this
report work on testnet” is now justified for the current deployment set.
