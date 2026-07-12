# AA Market Hub Network Status

Read-only verification date: **2026-07-11**

| Network | Canonical market | Canonical AA Core | Market name | Listing snapshot |
| --- | --- | --- | --- | ---: |
| Neo N3 Mainnet | `0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69` | `0x0268a387913b250166ddec032b03332690a1ef78` | `AAAddressMarket` | 0 total |
| Neo N3 Testnet | `0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf` | `0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2` | `AAAddressMarket-market-mneku8bc-market` | 87 total: 56 active, 31 cancelled |

The counts above are a dated snapshot, not cached product data. The app reads current listings from the selected network.

## Verified Live Boundary

Both market deployments returned `HALT` for `getListingCount`. All 87 testnet listing reads returned `HALT`. A sampled active testnet listing was also verified against AA Core: its escrow was active, its escrow contract matched the canonical testnet market, and its escrow listing ID matched the market listing.

The deployed market business ABI is aligned across both networks:

- Reads: `getListingCount`, `getListing`, `getPendingPaymentOf`
- Writes: `createListing`, `updateListingPrice`, `cancelListing`, `settleListing`, `refundPendingPayment`
- NEP-17 receiver: `onNEP17Payment`
- Business events: **none**

The canonical AA Core deployments expose the escrow verification reads and the confirmation events `MarketEscrowEntered`, `MarketEscrowCancelled`, and `MarketEscrowSettled`.

## Production Confirmation Rules

1. Reads and writes are pinned to the canonical market and AA Core for the detected network.
2. Discovery is wallet-free; writes require the matching connected wallet/network context.
3. GAS amounts remain integer Fixed8 base units. Listing prices are 0.01–1,000 GAS, title length is at most 80 characters, and metadata URI length is at most 240 characters.
4. A buy is one transfer-then-settle transaction. `GAS.transfer` sends the exact listing price to the market and passes `{ type: "Integer", value: listingId }` as its data argument.
5. Broadcast creates a durable pending record, not success.
6. Create, cancel, and buy require the matching AA Core event plus authoritative market/AA Core readback. Buy also requires exact GAS payment and payout events.
7. Because the market emits no events, update confirmation uses `HALT` plus exact listing readback. Refund confirmation uses the market-to-payer GAS transfer plus a zero pending-payment readback.
8. `FAULT` is terminal failure. Missing evidence or temporary RPC/indexer lag remains pending for explicit recovery.
9. The live relay endpoint returned HTTP `501 relay_not_configured`; the market advertises direct-wallet execution only.

No deployment, contract update, funded transaction, or account use was performed during this verification pass. A fresh funded mainnet/testnet lifecycle replay remains a separate operational QA step.

## 双网状态

核验日期：**2026-07-11**。主网与测试网市场合约均可只读访问，测试网快照为 87 条 listing（56 条 active、31 条 cancelled）；这些数字仅代表核验时刻，前端会重新读取链上状态。

线上 `AAAddressMarket` ABI 没有业务事件，因此不能用“拿到交易哈希”代替确认。创建、取消和购买通过 AA Core 托管事件与合约回读确认；购买还要核对精确的 GAS 付款和卖家收款事件；改价通过 `HALT` 和精确 listing 回读确认；退款通过 GAS 退款事件和 pending payment 清零确认。当前 relay 返回 `501 relay_not_configured`，线上只承诺直连钱包执行。
