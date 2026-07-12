# Oracle Price Console

Oracle Price Console is a timestamp-bound Morpheus market signal station for Neo N3. The price ticket, official NEO/GAS assets, feed freshness and on-chain request path are the primary product surface; raw request parameters stay out of the first screen.

## Product behavior

- Reads public prices directly through the configured Morpheus DataFeed integration without requiring a wallet.
- Uses official shared `CoinArt` for NEO and GAS.
- Resolves the exact `AGG:<ASSET>-USD` canonical key first and uses the exact `TWELVEDATA:<ASSET>-USD` key only as a bounded provider fallback.
- Shows the resolved feed key, RPC endpoint, network and deployed contract in the secondary inspection drawer.
- Publishes the exact mainnet and testnet Morpheus DataFeed dependencies in the MiniApp manifest; runtime reads still resolve from the shared generated registry.
- Preserves the contract's fixed six-decimal price scale; small positive prices never collapse into a misleading `$0.0000` display.
- Treats zero, negative, non-finite and failed reads as unavailable rather than a successful `$0` quote.
- Clears the previous quote when a pair changes or the next read fails.
- Binds each response to the exact requested asset, so a late NEO response cannot overwrite a newer GAS selection.
- Uses the on-chain record timestamp as the freshness signal and discloses the upstream market-source timestamp separately.
- Missing or implausibly future timestamps remain explicitly unverified; they are never labeled fresh.
- A once-fresh quote automatically becomes stale at the one-hour boundary without requiring another request.
- Normalizes only bounded USD pairs from the on-chain catalog and ignores malformed or cross-quote entries.
- The on-chain pair catalog is progressive enhancement; catalog failure leaves the stable NEO/GAS/BTC watchlist available.
- Pair switching remains available during a read; the superseded response is ignored and cannot overwrite the new selection.
- Launch links accept a bare symbol, a USD pair, or the exact resolved aggregate/provider key; another quote currency is rejected instead of being silently relabeled as USD.

## Verification

```bash
npx tsc -p apps/oracle-price-console/tsconfig.json --noEmit
npx eslint apps/oracle-price-console/src
cd apps/shared
npm exec vitest -- run test/oracle-price-console.freshness.test.ts test/oracle-price-console.integration.test.tsx test/oracle-price-console.playarea.test.tsx
```

The MiniApp is read-only. It does not sign transactions or claim that a data-feed read is a trade.

See `ASSET_PROVENANCE.md`, `NETWORK_STATUS.md`, and `PRODUCTION_STATUS.md` for the current resource, deployment-binding, and release evidence.
