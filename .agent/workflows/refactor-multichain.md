---
description: Refactor Platform for Multi-Chain Support
---

# Refactor Platform for Multi-Chain Support

This workflow guides the refactoring of the Neo MiniApps Platform to fully support multiple blockchain networks (Neo N3, NeoX, Ethereum, etc.) across the specific areas requested.

## 1. Unified Wallet Store

Refactor `platform/host-app/lib/wallet/store.ts` to fully embrace multi-chain architecture.

- [x] Remove hardcoded "neo-n3" defaults where inappropriate.
- [x] Integrate `multi-chain-store.ts` logic into the main store or replace it.
- [x] Ensure `switchChain` handles all provider types correctly.
- [x] Support connecting to multiple chains/accounts if design permits (or clean switching).

## 2. Miniapp SDK & Viewer Bridge

Update the communication bridge between Host and Miniapp to support multi-chain operations.

- [x] In `platform/host-app/components/features/miniapp/MiniAppViewer.tsx`:
  - [x] Add `wallet.switchChain` to `dispatchBridgeCall`.
  - [x] Update `wallet.getAddress` to potentially return address for specific chain ID.

## 3. Account System

Update the account system types to be chain-agnostic.

- [x] In `platform/host-app/lib/neohub-account/types.ts`:
  - [x] Promote `LinkedChainAccount` to primary status.
  - [x] Update `NeoHubAccountFull` to use `LinkedChainAccount`.

## 4. UI Updates

Ensure UI reflects multi-chain capabilities.

- [x] Verify `MiniAppCard` displays chain logos (already implemented, verify usage).
- [x] Update `Navbar` or `WalletConnectionModal` to allow network selection if needed.

## 5. Backend (Indexer) Configuration

- [x] Update `services/indexer/config.go` to support generic chain configuration/RPCs beyond just Neo N3 Mainnet/Testnet.

## 6. Edge Functions Multi-Chain Support

Refactor edge functions to support EVM chains alongside Neo N3.

- [x] Expand `platform/edge/functions/_shared/evm.ts` with payment utilities
- [x] Refactor `pay-gas` to support EVM native token transfers
- [x] Refactor `rng-request` to support EVM VRF providers
- [x] Verify `wallet-balance` EVM support (already implemented)

## 7. MiniApp Manifest Updates

Ensure all MiniApps declare supported chains correctly.

- [x] Update `miniapps.json` with proper `supportedChains` arrays
- [x] Add EVM contract addresses where applicable
- [x] Verify chain filtering works correctly

## 8. Backend Services Multi-Chain

Backend services currently use single-chain architecture. Full multi-chain support requires:

- [x] `infrastructure/chains` package already supports multi-chain configuration
- [ ] Update `services/requests/marble/service.go` for multi-chain dispatch
  - Requires multiple chain clients (one per chain type)
  - Requires request routing based on chain_id
- [ ] Add EVM event listener support
  - Requires ethclient integration
  - Requires EVM event subscription
- [ ] Add EVM transaction proxy support
  - Requires EVM transaction signing
  - Requires EVM gas estimation

**Note:** Backend multi-chain support is a significant architectural change that should be planned separately. The current implementation supports:

- Multi-chain configuration loading
- Chain-specific contract address resolution
- Single-chain operation per service instance

## 9. Summary of Completed Work

### Frontend (Complete)

- [x] Chain registry and types (`lib/chains/`)
- [x] Wallet store with multi-chain support
- [x] Chain badge components for UI
- [x] MiniApp card chain logo display
- [x] Chain filtering on MiniApps page
- [x] SDK types with multi-chain support
- [x] Bridge handler with chain-aware messages

### Edge Functions (Complete)

- [x] EVM utilities (`_shared/evm.ts`)
- [x] Multi-chain `pay-gas` function
- [x] Multi-chain `rng-request` function
- [x] Multi-chain `wallet-balance` function

### MiniApp Manifests (Complete)

- [x] Structure supports `supportedChains` and `chainContracts`
- [x] Example apps updated with NeoX support

### Backend (Partial)

- [x] Chain configuration infrastructure
- [ ] Multi-chain service dispatch (future work)
- [ ] EVM event listeners (future work)
- [ ] EVM transaction proxy (future work)
