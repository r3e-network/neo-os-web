# Neo Signature Desk production status

Version: `1.1.0`  
Reviewed: 2026-07-12

## Product experience

- The primary surface is a bright signing desk: the editable document, exact
  payload, wallet handoff, and returned signature record form one visual flow
  instead of a stack of generic forms.
- The application scene is now also the production catalog/social banner, so
  discovery no longer leads with the old text-heavy `Neo Sign Anything` card.
- Account, network, route progress, and one contextual primary action stay in
  the main stage. Payload-mode configuration, record facts, and metadata-only
  history live in a secondary drawer.
- Controls use the shared product system and Lucide icons. Primary actions are
  compact, foreground copy stays on opaque high-contrast surfaces, and the
  warm white/green scene is not used as a text background.
- Local file hashing is a secondary action. The selected file itself is never
  uploaded; the desk works with its local SHA-256 digest.

## Product correctness and recovery

- Purpose-bound mode signs a deterministic v1 envelope containing the domain,
  normalized Neo N3 network, signer address, content kind, UTF-8 byte count,
  content SHA-256, and optional file metadata. Exact mode signs only the
  displayed UTF-8 text and labels account/network as observed request context.
- Mainnet/testnet detection must resolve to an explicit Neo N3 network. An
  ambiguous value clears the displayed network and cannot open the signing
  prompt.
- A changed wallet, network, message, mode, domain, or file context invalidates
  an in-flight response. Concurrent sign clicks collapse to one wallet request.
- The shared framework now retains a wallet-reported signing account when the
  provider exposes one. The app accepts address or script-hash representation
  only when it matches the prepared signer; a different reported signer is
  rejected and never becomes a record.
- Wallet output must be a plausible hex/base64 signature and any returned public
  key must have a supported compressed or uncompressed encoding. The exported
  artifact is explicitly labeled `wallet-returned` and
  `cryptographicallyVerifiedHere: false`; it does not claim local verification
  across wallet-specific message-signing conventions.
- Files above 64 MiB are rejected before reading. Obsolete asynchronous hashes
  cannot overwrite a newer selection, and a failed replacement clears the old
  digest instead of presenting stale content as the new file.
- Local history stores at most eight metadata rows, never raw messages,
  signatures, public keys, or full records. Failed readback is surfaced as
  unavailable persistence while the current in-memory record remains copyable.

## Verification evidence

- Focused signing logic, PlayArea, and integration suites: `33/33` passed.
- Shared framework chain-extension suite: `21/21` passed, including normalized
  propagation of the wallet-reported account.
- App TypeScript, scoped ESLint, dedicated frontend structure gate, and scoped
  `git diff --check` passed.
- Production build: Vite `7.3.2`, `1,844` modules transformed; app entry
  `203.42 kB` (`61.42 kB` gzip), stylesheet `104.44 kB` (`19.10 kB` gzip).
- Static HTTP smoke: every emitted file returned a non-empty HTTP 200 (`16/16`).
- Source and emitted manifest, signing-desk scene, and catalog icon were
  byte-identical. The signing-desk scene, banner, and icon were opened locally;
  the active scene is bright and product-relevant, while the legacy banner is
  retained only as an unselected compatibility asset.
- The reviewed `dist` was copied to the host miniapp directory and remains
  byte-identical. Catalog verification reports 77 entries, 77 unique app IDs,
  and exactly one Signature Desk row using `signature-desk.webp` as its banner.
- Build warnings are limited to upstream Semi UI Sass `@import` deprecations.
- Git index remained empty. No browser automation, wallet signature, funded
  transaction, deployment, staging, or commit was performed.

## External release boundaries

1. Run one real MainNet/TestNet wallet compatibility matrix for supported
   providers and retain the exact displayed payload, provider response shape,
   reported account, and exported record. This requires explicit wallet-signing
   authority and was not simulated as success.
2. Complete browser/device visual QA for layout, keyboard focus, drawer behavior,
   and reduced-motion behavior; static source and asset inspection cannot prove
   rendered interaction quality.
3. Replace the legacy acronym catalog icon when a fully traceable generated or
   commissioned square identity asset is available. The production experience
   and banner already use the real signing-desk scene.
