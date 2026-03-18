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

### `flashloan`

Testnet deployed contract:

- contract: `0xee51e5b399f7727267b7d296ff34ec6bb9283131`
- remote name: `MiniAppFlashLoan`

Frontend compatibility:

- `getPoolBalance` → present
- `getLoan` → present
- `requestLoan/4` → present

Assessment:

- current frontend ABI matches current testnet deployment
- `flashloan` is a valid next candidate for deeper live-flow validation

### `breakup-contract`

Testnet deployed contract:

- contract: `0x84a3864028b7b71e9f420056e1eae2e3e3113a0c`
- remote name: `MiniAppBreakupContract`

Frontend mismatch:

- frontend expects `GetContractDetails`
- deployed contract exposes `getContract`
- frontend expects `createContract/6`
- deployed contract exposes `createContract/5`
- frontend expects `signContract/2`
- deployed contract exposes `signContract/3`
- frontend expects `TriggerBreakup/2`
- deployed contract exposes `triggerBreakup/2`

Assessment:

- current testnet deployment is not compatible with the current frontend
- this is a real user-facing blocker, not a probing artifact

### `burn-league`

Testnet deployed contract:

- contract: `0xf1aa73e2fb00664e8ef100dac083fc42be6aaf85`
- remote name: `MiniAppBurnLeague`

Frontend mismatch:

- frontend calls `TotalBurned`
- deployed contract exposes `totalBurned`
- frontend calls `RewardPool`
- deployed contract exposes `rewardPool`
- frontend calls `GetUserTotalBurned`
- deployed contract exposes `getUserBurned`
- frontend calls `burnGas/2`
- deployed contract exposes `burnGas/3`

Assessment:

- current testnet deployment is still on an older ABI generation
- current frontend should be treated as incompatible with that deployment

### `on-chain-tarot`

Testnet deployed contract:

- contract: `0xc2bb26d21f357f125a0e49cbca7718b6aa5c3b1e`
- remote name: `MiniAppOnChainTarot`

Frontend mismatch:

- frontend calls `requestReading/4`
- deployed contract exposes `requestReading/3`
- `getReading/1` is present

Assessment:

- read path exists
- write path is ABI-incompatible
- current testnet reading requests should be treated as blocked until the
  deployment is updated

### `unbreakable-vault`

Testnet deployed contract:

- contract: `0xb60bf51f7fc9b7e0beeabfde0765d8ec9b895dd4`
- remote name: `MiniAppUnbreakableVault`

Frontend mismatch:

- frontend calls `createVault/6`
- deployed contract exposes `createVault/4`
- frontend calls `attemptBreak/3`
- deployed contract exposes `attemptBreak/4`
- frontend calls `GetVaultDetails`
- deployed contract exposes `getVault`

Assessment:

- current frontend and current testnet deployment are ABI-incompatible
- current testnet write path should be treated as blocked

## Admin / Update Constraint

For the incompatible testnet contracts above, the current on-chain admin
address is:

- `NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu`

That admin address does **not** match the currently available testnet operator
WIFs in this workspace, so these contracts cannot be updated from the currently
available credentials.

## Practical Conclusion

### Testnet-compatible right now

- `flashloan`

### Testnet deployments that need update before frontend parity can be claimed

- `breakup-contract`
- `burn-league`
- `on-chain-tarot`
- `unbreakable-vault`

This means the phrase “all miniapps work on testnet” is still too strong unless
these legacy testnet deployments are either:

1. updated to the current frontend ABI, or
2. the frontend is intentionally downgraded to match the old deployed ABI
