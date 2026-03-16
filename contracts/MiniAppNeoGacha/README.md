# MiniAppNeoGacha

`MiniAppNeoGacha` is the on-chain engine behind **GASBOX**.

## Current Product Rules

- blind-box / gacha machines are created and stocked on-chain
- prize odds are explicit and total machine weight must equal `100`
- inventory is escrowed in the contract
- draw resolution uses direct Morpheus Oracle randomness callbacks
- rapid repeat play is handled at the UX layer through AA session keys

## Contract Role

The contract is responsible for:

- machine creation and machine marketplace state
- prize inventory deposits / withdrawals
- draw requests and request-to-play bookkeeping
- deterministic prize selection verification
- prize transfer logic for NEP-17 and NEP-11 items

It does **not** implement ServiceLayerGateway anymore. Oracle callbacks are expected to come from the configured Morpheus Oracle contract.

## Core Methods

- `CreateMachine(...)`
- `UpdateMachine(...)`
- `AddMachineItem(...)`
- `SetMachineActive(...)`
- `ListMachineForSale(...)`
- `BuyMachine(...)`
- `DepositItem(...)`
- `DepositItemToken(...)`
- `WithdrawItem(...)`
- `WithdrawItemToken(...)`
- `PlayMachine(player, machineId, receiptId)`

## Key Read Methods

- `TotalMachines()`
- `GetMachine(machineId)`
- `GetMachineItem(machineId, itemIndex)`
- `GetPlay(playId)`

## Integration Notes

- The canonical app id is `miniapp-neo-gacha`.
- Mainnet product name is **GASBOX**.
- Frontend, manifest, host definitions, and contract docs should all refer to direct Oracle randomness rather than ServiceLayerGateway.
