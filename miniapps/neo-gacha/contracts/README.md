# MiniAppNeoGacha

Neo Gacha is an on-chain blind box marketplace with escrowed prizes, transparent odds, and verifiable randomness.
Machines, inventory, and marketplace state are stored on-chain, while randomness is provided via the ServiceLayerGateway.

## Testnet Deployment

- Contract address: `NQhDGifaGnnoCjYysHPLwBCKUfVQ7UHpsT`
- Script hash (LE): `0x38f050f88deab96ac6bf5d1f197dd8f5d71182fc`
- Script hash (BE): `0xb2d46b83f577b0b7bce231545f192ce0bdfa6e34`
- Deploy tx: `0xd615f2fe436037ee22f7defc9ef577b3635f6632a370d126840ad9e736def454`
- PaymentHub: `NZLGNdQUa5jQ2VC1r3MGoJFGm3BW8Kv81q`
- ServiceLayerGateway: `NTWh6auSz3nvBZSbXHbZz4ShwPhmpkC5Ad`

## Core Methods

- `CreateMachine(creator, name, description, category, tags, price)` -> `machineId`
- `UpdateMachine(owner, machineId, name, description, category, tags, price)`
- `AddMachineItem(creator, machineId, name, weight, rarity, assetType, assetHash, amount, tokenId)`
- `SetMachineActive(owner, machineId, active)`
- `SetMachineListed(owner, machineId, listed)`
- `ListMachineForSale(owner, machineId, price)`
- `CancelMachineSale(owner, machineId)`
- `BuyMachine(buyer, machineId, receiptId)`
- `DepositItem(owner, machineId, itemIndex, amount)` (NEP-17)
- `DepositItemToken(owner, machineId, itemIndex, tokenId)` (NEP-11)
- `WithdrawItem(owner, machineId, itemIndex, amount)` (NEP-17)
- `WithdrawItemToken(owner, machineId, itemIndex, tokenId)` (NEP-11)
- `PlayMachine(player, machineId, receiptId)` -> `playId`

## Read Methods

- `TotalMachines()`
- `GetMachine(machineId)`
- `GetMachineItem(machineId, itemIndex)`
- `GetPlay(playId)`

## Events

- `MachineCreated(creator, machineId)`
- `MachineUpdated(machineId)`
- `MachineItemAdded(machineId, itemIndex)`
- `MachineActivated(machineId, active)`
- `MachineListed(machineId, listed)`
- `MachineBanned(machineId, banned)`
- `MachineSaleListed(machineId, price)`
- `MachineSold(machineId, seller, buyer, price, platformFee, creatorRoyalty)`
- `InventoryDeposited(machineId, itemIndex, amount, tokenId)`
- `InventoryWithdrawn(machineId, itemIndex, amount, tokenId)`
- `PlayRequested(player, machineId, playId, requestId)`
- `PlayResolved(player, machineId, itemIndex, playId, assetType, assetHash, amount, tokenId)`
- `RngRequested(playId, requestId)`

## Notes

- Prize weights must sum to 100 before activation.
- Inventory must be deposited for each prize type before activation.
- Inventory is escrowed in-contract for trustless prize delivery.
- Payments are validated using PaymentHub receipts.
- RNG requests are fulfilled via the ServiceLayerGateway callback.
