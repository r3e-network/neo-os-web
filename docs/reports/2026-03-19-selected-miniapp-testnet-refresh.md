# 2026-03-19 Selected MiniApp Testnet Refresh

This report replaces the older secondary-miniapp testnet reports that referenced superseded testnet contract addresses.

## Scope

- Updated in place:
  - `MiniAppFlashLoan` at `0xde8e595d8d3c293731db499367ee2a768e1e458b`
- Redeployed on testnet:
  - `MiniAppDiceGame` -> `0x1e448bf07a742da74084d4c64a61052980beb496`
  - `MiniAppGasCircle` -> `0x4630b40a4e67882cfab3d3f5041c1da597b0c7b6`
  - `MiniAppExFiles` -> `0xb55358f282a519762ad8c7db57dff2f01bb8cd2a`
  - `MiniAppMasqueradeDAO` -> `0xa79f897c8f1d6b1450b7204668b82cffd1bad4a0`
  - `MiniAppMillionPieceMap` -> `0x4cac0ac79bac3b94c388fe0f27a9ed1a8e476cbf`
  - `MiniAppGraveyard` -> `0xb55aa635b10a5abb5cbac169db26a38df739778e`
  - `MiniAppHeritageTrust` -> `0x42e14d04c17dad0b1d76ee7509e537791230431b`
  - `MiniAppHallOfFame` -> `0x00d44aefa345f72c0eb15036129a32a56c765474`
  - `MiniAppTurtleMatch` -> `0x4750b2d55de0282579e66c2b1b6c07d9138380ad`

## Signer

- testnet signer: `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`

## Shared dependencies applied

- Morpheus Oracle: `0x4b882e94ed766807c4fd728768f972e13008ad52`
- AA core: `0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38`
- AutomationAnchor configured explicitly on:
  - `MiniAppDiceGame` -> `0xa016f7be94ad7c4d87ad2f8d38784797c2dc494b`
  - `MiniAppGasCircle` -> `0xa016f7be94ad7c4d87ad2f8d38784797c2dc494b`

## Transactions

- `MiniAppFlashLoan` update:
  - update tx: `0x750275692a5936c6596460cf7859ef8f6d3cb448ae5858055aeef99f53dd816e`
  - follow-up `setOracle`: `0x1b27522bbd098bf3b4992437e734108c8f895753ea08aaf5718aac4397a96adf`
  - follow-up `setAbstractAccount`: `0x577fad164b63420e04d7aa8566a5ad00acf3bd52ea0d1aba70b5d28051909c3f`
- `MiniAppDiceGame` deploy tx: `0x814801663a969c00a116b1554fad0cc185a80a5a040a25da079180b8319e77cd`
- `MiniAppGasCircle` deploy tx: `0x8416e8ab2d08981d25becf004821a82bad29cf41c3c1dd54fbe3c4089c8ade0d`
- `MiniAppExFiles` deploy tx: `0x6ece4ad45782e49368da5b4b1bf7e44a937e65078af39045c8b42e6e6e0d6fba`
- `MiniAppMasqueradeDAO` deploy tx: `0x79fa2e410dc13cbeb831c7249f75542c30ed3a999be759583d159801e0117ea0`
- `MiniAppMillionPieceMap` deploy tx: `0x8a27f38c36aa047c9e2c0c96ae8c366647998357e138061445af6634e66eb6eb`
- `MiniAppGraveyard` deploy tx: `0xde1ee50fb536aad642f2fccbb2d273308e67c7570f6489fa373cbe783b864376`
- `MiniAppHeritageTrust` deploy tx: `0x2548855f27759fb137579db31a701ee35762821f315b2a39236669d5164573ea`
- `MiniAppHallOfFame` deploy tx: `0x4fbd581aed3f681fcf6aa9de162c238d42899eff9c76e67be210bffae9c5f0a3`
- `MiniAppTurtleMatch` deploy tx: `0x3371102c0e40aea27ee45f6aab76007a064004d13365057713dd8a42018e7dcd`

## Verification summary

- all refreshed contracts now dry-run as `ready` for future updates with the current signer
- `admin`, `oracle`, and `abstractAccount` were read back on-chain after deployment/update
- `MiniAppFlashLoan` update transaction reached `HALT`
- no active non-report docs remain with the superseded testnet hashes for these refreshed contracts
