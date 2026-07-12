# On-Chain Tarot

A production-polished, Phaser 3 three-card tarot ritual. The currently published experience is local and guest-only while the wallet-funded GameFi contract is rebuilt around a verified oracle/VRF settlement path.

## Current release

- **App ID:** `miniapp-onchaintarot`
- **UI:** Phaser 3 ritual table with animated dealing, card reveal, three intention tokens, keyboard controls, reduced-motion support, and an accessible reading drawer
- **Mode:** local guest reading only
- **Randomness:** Web Crypto with rejection sampling; no predictable `Math.random()` fallback
- **Wallet / GAS:** not requested or used
- **Persistence:** only the local reading tally is stored; questions and card results are not published

The catalog manifest intentionally has no contract operations, payment permission, or randomness permission. The GameFi entry stays disabled instead of presenting an unverified on-chain path as production-ready.

## Why GameFi is gated

Two testnet deployments exist, but neither is the contract/API that the production GameFi promise requires. A new local replacement and its asynchronous frontend path are complete but intentionally not published yet:

| Contract | Testnet hash | Live ABI status | Release decision |
|---|---|---|---|
| Legacy `MiniAppOnChainTarot` | `0x5cdf29c30727ce06696736ae0fb49abd9fd79730` | Oracle-style `requestReading` / `onOracleResult`; this is the hash historically bound to the catalog/domain | Not compatible with the current `ReadingDrawn` client flow |
| Standalone `MiniAppTarot` | `0xb680225a1be276b03ecd7de82ea985dcc7435cec` | Deposit, `draw`, `ReadingDrawn`, refund and readback operations | Uses same-transaction `Runtime.GetRandom`, not oracle VRF |

`MiniAppTarotVrf` now implements reusable credit, Morpheus request/callback settlement,
three distinct cards, pending persistence, terminal readback, full failure/timeout credit
restoration, and successful-reading-only HUD counters. The Phaser table keeps real card
backs on the desk while the Oracle is pending; it never treats request submission as a
drawn spread. Deployment, Oracle allowlisting, reserve funding, live wallet tests, and
manifest/domain binding remain required before `supportsGameFi` can change.

Both ABIs were read from Neo N3 testnet on 2026-07-11. See [TESTNET-STATUS.md](./TESTNET-STATUS.md) for the activation gate.

GameFi can be re-enabled only after a replacement deployment has all of the following:

1. Oracle/VRF request and asynchronous settlement with a request-to-reading binding.
2. Three distinct card indices in the 0–77 range, stored and retrievable on-chain.
3. Correct deposit, draw, cancellation/refund, replay protection, and verified event/readback behavior.
4. The same verified script hash in the contract registry, miniapp manifest, and `.miniapp.neo` domain.
5. A complete testnet wallet run covering refusal, timeout, retry, settlement, recovery, and unused-credit withdrawal.

## Development

```bash
npm test
npm run build
npm run dev
```

Card-source and generated-deck provenance is documented in [public/cards/ATTRIBUTION.md](./public/cards/ATTRIBUTION.md).

## License

MIT License — R3E Network. Third-party card-source attribution remains subject to its recorded source terms.
