---
description: Update MiniApp SDK and Apps for Multi-Chain Support
---
# Refactor MiniApps for Multi-Chain Support

This workflow updates the @neo/uniapp-sdk and individual MiniApps to leverage the new multi-chain platform capabilities.

## 1. Update SDK (@neo/uniapp-sdk)
Expose the new chain management features to MiniApps.
- [x] Update `src/types.ts`: Add `switchChain` to `MiniAppSDK` interface.
- [x] Update `src/bridge.ts`: Implement `switchChain` in `createPostMessageSDK` and pass-through.
- [x] Update `src/composables/useWallet.ts`: Expose `switchChain` composable function.

## 2. Update MiniApps
Make MiniApps chain-aware and capable of switching networks.

### Neo Swap (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains` (Neo N3).
- [x] Update `App.vue` or `SwapTab.vue`: Check `chainType`. If not "neo-n3", show a prompt to "Switch to Neo N3" using the new SDK method.

### Lottery (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### Gas Sponsor (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### Council Governance (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### Candidate Vote (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### NeoBurger (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### Burn League (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### Daily Check-in (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

### Coin Flip (Neo N3 Only)
- [x] Update `manifest.json`: Explicitly define `supported_chains`.
- [x] Update `index.vue`: Add chain check and switch prompt.

## 3. Verification
- [x] Verify types and build status.
