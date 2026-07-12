# Neo Swap

Neo Swap is a production-oriented NEO/GAS quote desk for Neo N3. It reads both price legs from the Morpheus data feed, calculates the cross-rate and minimum received, and presents the result in a focused swap terminal.

There is currently **no deployed swap router** in `neo-manifest.json`. The MiniApp therefore stays in planning mode: it can refresh a public quote and optionally read wallet balances, but it cannot submit or claim a completed swap.

## Current product behavior

- Public NEO/GAS quote refresh does not require a wallet.
- NEO and GAS use the shared official Neo Press Kit token artwork.
- The quote is accepted only when both price legs are finite and positive; each fixed-six Morpheus price is immediately restored to an integer.
- An uninitialized aggregate record (`HALT` with zero price/time) falls back to the same contract's explicit `TWELVEDATA:*` record; a zero provider record still fails closed.
- Freshness uses the older on-chain `recordTimestamp`; a missing or 10-minute-old record is stale.
- RPC/data-feed failures clear the old quote and expose a retry state. No fabricated fallback price is shown.
- A response is bound to the exact requested pair, so an older in-flight quote cannot overwrite a later token switch.
- NEO fractional input and token precision overflow are rejected visibly instead of being silently truncated.
- Output and minimum received are calculated directly in token base units with `BigInt`; the rounded six-decimal display rate is never reused as transaction math.
- Slippage presets change only the integer minimum-received floor; they never change the quoted output.
- GAS `MAX` reserves 0.1 GAS for network fees. NEO `MAX` remains a whole number.
- Wallet balances use `app.wallet.raw()` and are accepted only when the detected wallet network exactly matches the quote network; an ambiguous, mismatched or switched-account result stays unavailable.

## Settlement boundary

`contracts` is intentionally empty. A non-empty platform contract address is not enough to enable settlement: it must also exactly match the reviewed network, Hash160, operation, confirmation event, and ABI version in `src/settlement.ts`. The active binding is currently `null`, so the primary action refreshes the quote and `canSwap` stays false.

The dormant settlement adapter is retained for API compatibility. It may be enabled only after all of the following are true:

1. A reviewed router implementing `swapTokenInForTokenOut` is deployed for the selected network.
2. Its address is added to the platform manifest/contract registry.
3. The `SwapExecuted` event shape and confirmation semantics are integration-tested.
4. Live route output, fees, deadline behavior, and min-output enforcement are verified on testnet.
5. The MiniApp is re-reviewed before `payments` permission is enabled.

When those gates are eventually enabled, the transaction adapter persists the exact txid at broadcast time, blocks duplicate submissions, waits for the transaction-scoped `SwapExecuted` event, and requires the route binding's validator to match that event to the wallet, pair and integer amount intent. It retains an unverified transaction for explicit recovery after refresh. A broadcast or event name alone is never reported as a completed swap.

Until those gates pass, documentation and UI must describe this MiniApp as a quote/planning surface, not a liquidity pool or executable DEX.

## Data and wallet behavior

- Quote source: Morpheus `getPriceWithMeta()` for NEO and GAS.
- Display timestamp: older upstream `dataTimestamp` leg.
- Safety timestamp: older on-chain `recordTimestamp` leg.
- Wallet data: exact raw NEO/GAS base units only after a read is verified for the current address; disconnected, failed, or switched-account reads are shown as unavailable rather than numeric zeroes.
- Custody: none.
- Dedicated app contract: none.

## Development

```bash
npm --prefix apps/neo-swap run dev
npm --prefix apps/neo-swap run build
npx tsc -p apps/neo-swap/tsconfig.json --noEmit
cd apps/shared
npx vitest run test/neo-swap.logic.test.ts test/neo-swap.playarea.test.tsx test/neo-swap.integration.test.tsx test/neo-swap.production.test.ts test/official-token-assets.test.tsx
```

The development URL is printed by Vite. Visual and wallet acceptance must be performed later on that local URL with the user's chosen browser.

## Assets

- `public/liquidity-route-v2.webp`: original generated route artwork with no embedded currency or token marks.
- `public/logo.{webp,avif}` and `public/banner.{webp,avif}`: route artwork composited with the shared official NEO/GAS PNGs.
- NEO/GAS marks: shared `CoinArt` component backed by the official Neo Press Kit files under `apps/shared/assets/tokens/`.
- Provenance: see [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) and the compatibility [ATTRIBUTION.md](./ATTRIBUTION.md).

See [TESTNET-STATUS.md](./TESTNET-STATUS.md) for the current enablement gate.
