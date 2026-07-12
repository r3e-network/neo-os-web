# Neo Convert production status

Version: `1.1.0`  
Status date: 2026-07-11

## Product result

Neo Convert is complete as a professional **local Neo N3 key, address, and
NeoVM script workbench**. It is not presented as a token swap or DeFi product:
there is no exchange rate, fee quote, MiniApp contract, wallet signature, or
transaction path to invent.

- The real `key-workbench-stage.webp` resource, source-to-output rail, and one
  compact source control establish the main conversion flow. The primary
  input is no longer hidden inside a detail drawer, and the screen does not
  become a form wall.
- The source is masked by default and can be revealed explicitly. Convert and
  Enter share the same primary action.
- Full derived values, private reveal controls, generated-account backup,
  exact wallet balances, and session clearing stay in the secondary drawer.
- The source field, buttons, labels, keyboard path, reduced-motion behavior,
  responsive layout, and focused status states are covered by component tests.
- Official NEO/GAS token images appear only in the optional read-only wallet
  snapshot through shared `CoinArt`; interface affordances use Lucide.

## Conversion correctness and recovery

1. A deterministic private-key vector verifies the exact WIF, compressed
   public key, and Neo N3 address output.
2. Private keys must be exactly 32 bytes and pass secp256r1 scalar validation;
   zero and out-of-range scalars are rejected. Public keys must be compressed
   `02`/`03` points and pass curve decoding before address derivation.
3. WIF and address inputs are length-bounded before Base58 conversion, then
   checksum, payload length, prefix/version, suffix, and curve validity are
   checked. An oversized paste cannot monopolize the Base58 decoder.
4. Neo N3 address output exposes the canonical `0x` display order and the VM
   little-endian order without silently accepting a legacy address version.
5. NeoVM disassembly frames PUSHDATA1/2/4, PUSHINT, jumps, slot operands,
   TRY, SYSCALL, and other fixed operands. A truncated prefix or operand
   rejects the complete script instead of inventing an instruction.
6. Script input is capped at 65,536 bytes. Oversized and malformed input has a
   distinct recoverable status and never fills the result panel with partial
   output.
7. The complete source is bounded before format detection, including non-hex
   pastes; UI state retains at most one character beyond the processing limit
   so it can show an explicit error without holding unbounded input.
8. Editing the source immediately invalidates the old derivation and remasks
   private output. Generating a new account clears the previous conversion.
9. WIF/private-key results and generated account secrets are absent from the
   DOM until explicit reveal. Paper-wallet export is rejected until the
   generated secret fields have been revealed.
10. Clipboard rejection produces error feedback instead of false copy success.
   The explicit clear action removes source, derived values, generated account,
   reveal state, and inline copy feedback from the current app session.
11. Neo Convert does not call app storage, browser storage, or fetch for key
    work. Explicit clipboard copies and downloaded PDFs are external artifacts
    and cannot be erased by the in-app clear action; the UI documentation says
    so directly.

## Optional balance boundary

- Connected-wallet NEO and GAS balances are read by explicit captured address
  from raw base units, formatted with 0 and 8 protocol decimals, respectively.
- Number-backed balance observers are used only as refresh signals, so they
  cannot round the displayed amount.
- A response is discarded if the wallet address changed during the request.
  Disconnect or a direct connected-address switch clears the old snapshot
  immediately; an RPC failure renders unavailable values, and a later retry
  returns the snapshot to ready.
- This read-only snapshot is the only network feature. There is no contract
  binding, write confirmation, transaction journal, or pending replay because
  the product has no write operation. Details are in
  [NETWORK_STATUS.md](./NETWORK_STATUS.md).

## Verification evidence

- Focused conversion, disassembly, integration, PlayArea, and production suite:
  `36/36` tests passed across `5/5` files.
- Global i18n parity, official-token, and Open UI companion checks passed
  `90/90`, including Neo Convert's new bounded-input copy.
- Scoped TypeScript and ESLint checks passed with zero warnings or errors;
  `git diff --check` passed for the scoped files.
- Production build transformed `3,898` modules in `21.82s`. The app entry is
  `273.21 kB` (`86.58 kB` gzip) and app CSS is `104.30 kB` (`18.58 kB` gzip). The
  `387.16 kB` (`125.18 kB` gzip) paper-wallet module remains lazy-loaded only
  after explicit export, so it is not an initial entry dependency.
- Static HTTP/MIME smoke returned HTTP 200 with the correct type for `22/22`
  emitted files. Manifest and public source assets matched `dist/` byte for
  byte for `9/9` comparisons.
- Source and emitted manifest SHA-256:
  `886641068886792f531b4c93ce6018f720b75cbc1ad9331a11d247f61bbae1be`.
- Repository MiniApp dApp support verification checked all `77` manifests with
  zero failures.
- The active 1672×941 generated key-workbench resource, catalog banner, logo,
  and legacy scene were inspected directly from local files. The active stage
  is bright, product-specific, foreground-safe, and replaces its old
  pseudo-token mark with a neutral keyhole/circuit seal.
- Browser/Playwright capture was intentionally excluded from this scoped lane,
  so live host/device visual comparison remains a parent integration check.
- Parent release synchronization copied the final dist byte-for-byte into the
  host and regenerated a valid `77/77` catalog with unique IDs/slugs and Neo
  Convert `1.1.0`. No deployment, contract update, wallet signature, funded
  transaction, secret, git staging, or commit was performed.

## Remaining release-day checks

- Verify the rendered app at host breakpoints in the user's selected browser.
- Exercise the optional read-only balance snapshot with a connected wallet on
  both supported networks; no funded transaction is required.
- Resolve the original generation/provider record for the retained logo and
  legacy artwork before making a new external license claim. See
  [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).
- The build still reports the shared Semi theme's upstream Sass `@import`
  deprecation and the intentionally lazy PDF chunk size warning. Neither is an
  app-local runtime failure.
