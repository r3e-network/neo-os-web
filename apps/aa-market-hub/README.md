# AA Market Hub — Neo Abstract Account Marketplace

AA Market Hub is a product-style marketplace for discovering, listing, buying, and managing deterministic Neo Abstract Account shells. The foreground experience is a bright escrow desk and listing shelf; contract hashes and recovery details stay secondary to the actual marketplace flow.

> **Current status:** `AAAddressMarket` and `UnifiedSmartWalletV3` are deployed on Neo N3 mainnet and testnet. Their live ABI and current read state were checked through read-only N3Index RPC on 2026-07-11. No deployment, contract update, funded transaction, or account use was performed in this pass. See [NETWORK_STATUS.md](./NETWORK_STATUS.md).

## Marketplace Flow

1. **Explore without a wallet** — Browse active on-chain listings and inspect the seller, AA account ID, canonical AA Core binding, price, and escrow status.
2. **Create a listing** — Connect the current AA backup-owner wallet, choose the registered AA shell, set a price from 0.01 to 1,000 GAS, and optionally add a title and metadata URI. Creation moves that shell into market escrow.
3. **Buy atomically** — The buyer signs one batched wallet transaction: exact-price `GAS.transfer` followed by `settleListing`. The transfer's fourth argument is the **Integer listing ID**, which lets `onNEP17Payment` bind the payment to the intended listing.
4. **Reconfigure ownership** — Settlement makes the buyer the new AA backup owner, clears the previous verifier and hook, and exits market escrow. The buyer must configure fresh permissions and plugins before using the account.
5. **Manage safely** — Sellers can update an active listing's price or cancel it. A payer can refund an exact stranded pending payment when settlement did not complete.

## What Is Being Sold

The market transfers control of the deterministic **AA shell**; it does not separately custody, value, or migrate the seller's keys, off-chain identity, or assets. Sellers must remove assets and revoke external allowances before listing because anything left at the AA address may become controllable by the buyer after settlement. A listing is buyable only when it targets the canonical `UnifiedSmartWalletV3` deployment for the detected network and its authoritative escrow binding still matches the listing.

## Transaction Truth and Recovery

A wallet intent, relay response, broadcast result, or transaction ID is never shown as success by itself.

- Every write is bound to the original wallet actor, network, canonical market, canonical AA Core, operation, transaction ID, and expected values.
- An indexed `FAULT` ends the pending attempt without producing a success state.
- Create, cancel, and buy confirmation use the exact `UnifiedSmartWalletV3` escrow event plus authoritative market and AA Core readback.
- Buy confirmation additionally requires the exact GAS payment and seller-payout `Transfer` events.
- The deployed market ABI emits no business events. Price updates therefore require a `HALT` application log and exact listing readback; refunds require the matching GAS refund transfer and a zero pending-payment readback.
- Missing events, indexer lag, wallet switching, or a network/contract mismatch leaves the operation visibly pending and recoverable instead of guessing.

## Current Execution Boundary

- **Live:** wallet-free discovery and direct-wallet create, update, cancel, buy, and refund flows against canonical contracts.
- **Not live:** gasless or operator-relayed market writes. The configured relay endpoint currently returns HTTP `501 relay_not_configured`, and its allowlist does not expose direct market operations.
- **Required wallet capability:** standard Neo contract invokes; purchases additionally require an atomic multi-invoke transaction.

## Canonical Contracts

| Network | AAAddressMarket | UnifiedSmartWalletV3 |
| --- | --- | --- |
| Neo N3 Mainnet | `0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69` | `0x0268a387913b250166ddec032b03332690a1ef78` |
| Neo N3 Testnet | `0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf` | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` |

The app rejects wallet/launch-network or configured-contract mismatches before writes. If the wallet network cannot be positively detected, reads may remain available but every market write stays blocked. It never accepts a locally entered market hash as authority.

## Live Interface Used by the App

Market reads: `getListingCount`, `getListing`, `getPendingPaymentOf`.

Market writes: `createListing`, `updateListingPrice`, `cancelListing`, `settleListing`, `refundPendingPayment`.

AA Core verification reads: `getBackupOwner`, `getMarketEscrowContract`, `getMarketEscrowListingId`, `isMarketEscrowActive`, `getVerifier`, `getHook`.

AA Core confirmation events: `MarketEscrowEntered`, `MarketEscrowCancelled`, `MarketEscrowSettled`.

## Development and Verification

From the repository root:

```bash
npx tsc -p apps/aa-market-hub/tsconfig.json --noEmit
npm --prefix apps/aa-market-hub test
npm --prefix apps/aa-market-hub run build
```

See [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for the current validation evidence and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for the visual-resource boundary.

## 中文说明

AA Market Hub 是 Neo 抽象账户地址的链上交易市场，不是把合约参数平铺出来的表单。用户可以免连接钱包浏览商品；卖家连接钱包后把已注册的 AA 壳放入托管，买家用一笔原子批量交易完成精确 GAS 付款与交割，卖家也可以改价或取消，异常中断的付款可以按链上记录退款。

购买转移的是 **AA 壳的控制权**，市场不会单独托管、估值或迁移卖家的密钥、链下身份与资产。卖家上架前必须转出资产并撤销外部授权，因为留在 AA 地址中的内容在交割后可能由买家控制。交割后买家成为新的 backup owner，旧 verifier 与 hook 被清空，必须重新配置安全权限。

所有写操作先进入可恢复的 pending 状态。只有应用日志、AA Core 托管事件、GAS `Transfer` 事件和合约回读共同证明结果后，界面才会显示成功；单独的交易哈希、广播结果或 relay 响应都不算成功。当前 relay 返回 `501 relay_not_configured`，所以线上明确使用直连钱包，不宣传 gasless/relay 能力。

## License

MIT License — R3E Network
