# Oracle Price Console network status

Read-only verification: 2026-07-11 22:19 CST

No wallet, signature or transaction was used. `getLatest(String)` was called directly against each configured Morpheus DataFeed contract. The production MiniApp binds those same network-specific RPC/contract pairs from the generated Morpheus registry, resolves `AGG:<ASSET>-USD` first, and uses `TWELVEDATA:<ASSET>-USD` only as an explicit fallback.

## Mainnet

- RPC: `https://api.n3index.dev/mainnet`
- Contract: `0x03013f49c42a14546c8bbe58f9d434c3517fccab`
- `TWELVEDATA:NEO-USD`: `HALT`, price `1.984000`, source/write timestamp `1783778891` (about 285 seconds old at verification).
- `TWELVEDATA:GAS-USD`: `HALT`, price `1.064600`, source/write timestamp `1783778271` (about 905 seconds old at verification).

## Testnet

- RPC: `https://api.n3index.dev/testnet`
- Contract: `0x9bea75cf702f6afc09125aa6d22f082bfd2ee064`
- `TWELVEDATA:NEO-USD`: `HALT`, price `1.984000`, record timestamp `1783779143` (about 33 seconds old), but upstream source timestamp `1773072508` is much older.
- `TWELVEDATA:GAS-USD`: `HALT`, price `1.039600`, record timestamp `1783672358` (about 106,818 seconds old) and upstream source timestamp `1773432436` is older still.

The UI therefore exposes the exact resolved feed key, on-chain write freshness and upstream market-source time separately. A recently rewritten record cannot hide an old market-source timestamp, and the stale testnet GAS record remains visibly stale. Both price display and the secondary route reference use the contract's fixed six-decimal scale.
