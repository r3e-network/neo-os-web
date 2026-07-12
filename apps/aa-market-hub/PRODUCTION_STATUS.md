# AA Market Hub Production Status

Status date: 2026-07-11

## Product result

AA Market Hub is implemented as a bright marketplace, not a contract-parameter form. The escrow desk, listing shelf, focused selection, exact GAS price, and one primary action establish the main hierarchy; seller tools, metadata, recovery evidence, and contract details remain secondary.

The current release supports wallet-free discovery plus direct-wallet create, update, cancel, atomic buy, and stranded-payment refund flows. It does not claim relay or gasless execution while the live relay boundary remains unavailable.

## Product-correctness and recovery rules

1. Every read resolves the selected network's canonical market and AA Core; a configured-contract mismatch is rejected.
2. Every write additionally requires a positively detected wallet network. A transient or unknown wallet network cannot fall back to the launch URL for a financial action.
3. Listing IDs, counts, timestamps, pending payments, and GAS Fixed8 values remain exact integer strings until a bounded display conversion is safe.
4. A purchase is one wallet batch: exact GAS transfer with Integer listing ID data, then market settlement.
5. A broadcast creates a durable pending record. It is not success.
6. Create, cancel, and buy require exact AA Core events plus authoritative market/AA Core readback. Buy also requires both exact GAS transfer events.
7. Update and refund use their deployed eventless-market evidence model: `HALT` plus exact listing readback for update; GAS refund transfer plus zero pending-payment readback for refund.
8. Wallet, network, contract, operation, expected values, and transaction ID are bound into recovery. Missing or malformed evidence stays pending; `FAULT` is terminal.
9. Pending storage requires exact write/readback and delete/readback. Storage failure remains visible and never turns a broadcast into success.
10. Late listing loads are discarded after wallet or network context changes, and wallet connection, recovery, and financial writes share explicit concurrency guards.

## Visual and interaction result

- The in-app `market-escrow-desk.webp` resource is the primary scene; the launcher uses the dedicated marketplace banner and storefront logo.
- The palette is warm cream, mint, and gold with dark foreground copy and high-contrast white panels.
- Official NEO/GAS art is supplied through the shared `CoinArt` component; interface controls use Lucide.
- The rendered experience contains no emoji, inline SVG, CSS illustration, ASCII art, or placeholder artwork.
- Long parameter walls are replaced by listing cards, a focused selected asset, contextual trade/manage actions, and progressive detail drawers.

## Validation evidence

- Focused logic, integration, PlayArea, and production-state suite: `36/36` tests passed.
- App TypeScript and scoped ESLint passed.
- Production build: Vite transformed `1,853` modules.
- App JavaScript: `231.38 kB` (`69.96 kB` gzip).
- App CSS: `109.00 kB` (`20.07 kB` gzip).
- Static HTTP smoke: `16/16` emitted files returned HTTP 200.
- Source/dist manifest and public assets: `9/9` byte-identical after build.
- Local inspection confirmed the real escrow desk, marketplace banner, and storefront logo are bright, product-specific resources.
- No deployment, contract update, wallet signature, funded transaction, or browser automation was performed in this pass.
- The built MiniApp was copied to the host public directory byte-for-byte; the host catalog remains `77/77` unique app IDs and slugs with one AA Market Hub `2.0.0` entry.

## Remaining release-day work

- Re-run current mainnet/testnet read-only contract evidence because counts and runtime availability change over time.
- Exercise a separately authorized funded lifecycle with a disposable AA shell and test wallet before claiming live transactional QA.
- Complete host-level browser/device visual QA in the user's selected browser.
- Resolve missing upstream creation/license records for the existing image files before redistributing them outside this repository.
