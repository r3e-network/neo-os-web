# Soulbound Certificate production status

Version: 1.2.0  
Reviewed: 2026-07-12

## Product experience

- The primary surface is a real certificate artifact made from `certificate-paper.webp`; template design, issuance, and public verification update that artifact directly.
- The warm cream, green, and gold visual system keeps all text on opaque high-contrast foreground surfaces instead of placing copy directly over the artwork.
- Issuer fields are grouped into recipient/template dossiers and advanced disclosure panels. The screen exposes one contextual primary action rather than a wall of equal-weight forms and buttons.
- Public verification remains wallet-free. Wallet connection appears only when an issuer action requires it.
- A pending transaction replaces the normal CTA with the single read-only **Check confirmation** action; duplicate writes remain unavailable.
- If recovery storage is unavailable before a write, the normal CTA becomes the single **Retry recovery storage** action instead of leaving the user at a dead disabled button.
- Desktop, mobile, narrow-height, and reduced-motion CSS states are implemented. Browser screenshot QA was intentionally not run in this scoped pass, so rendered visual fidelity remains an explicit external check.

## Product correctness and recovery

- Reads and writes require an explicit Neo N3 MainNet/TestNet binding to the canonical Soulbound Certificate contract.
- Failed or bounded reads use `failed` / `partial` / `cache` source states and are never presented as authoritative zero counts or an empty credential wallet.
- Every new write creates a version-2 recovery receipt before invocation and persists it on transaction broadcast. The app proves the local recovery store with a set/get/delete round trip before asking the wallet to sign.
- If durable storage disappears immediately after broadcast, the exact transaction receipt remains locked in session memory. The primary action becomes **Retry recovery storage**, which writes and verifies that same receipt before confirmation checks resume.
- Existing version-1 pending receipts remain readable so an upgrade never discards an already-broadcast transaction.
- Success requires the exact transaction event plus authoritative readback. Template creation and updates bind every submitted template field; issuance binds owner, recipient name, achievement, and memo; toggle and revocation bind their exact final states.
- Unknown and lagging outcomes remain pending even after 24 hours; elapsed time alone never unlocks a possible broadcast. A mined FAULT is shown as failed. A HALT without the expected event remains locked for later reconciliation.

## Verification completed locally

- Focused Vitest: **66/66 passed** across `soulbound-certificate.logic.test.ts` and `soulbound-certificate.playarea.test.tsx`.
- TypeScript: `tsc --noEmit -p apps/soulbound-certificate/tsconfig.json` passed.
- Scoped ESLint: app source plus the two focused shared suites passed with no findings.
- App structure gate: `soulbound_certificate_frontend_structure.test.mjs` passed **1/1**.
- Production build: Vite transformed **1900 modules** and completed successfully. The app entry chunk is **243.48 kB / 71.38 kB gzip**; the CSS is **109.77 kB / 19.75 kB gzip**.
- Static HTTP: every file in `dist` returned HTTP 200 (**17/17**), including the certificate paper, atelier image, manifest, and all JS/CSS chunks.
- Read-only live RPC: MainNet and TestNet returned `MiniAppSoulboundCertificate`, NEP-11, the required lifecycle ABI/events, and HALT `getPlatformStats` reads.
- Asset inspection: all four active rasters were opened locally; dimensions, crop suitability, brightness, and foreground space were checked.
- Scoped `git diff --check` passed.

No host copy, deployment, signing, funded transaction, git staging, or commit is part of this app-scoped task.

## External release boundaries

1. Run the funded TestNet lifecycle documented in [NETWORK_STATUS.md](./NETWORK_STATUS.md) and retain transaction/readback evidence.
2. Complete browser/device visual QA against the real rendered app; static source and image inspection cannot prove layout, focus order, or motion in a browser.
3. Attach original generation/license records for the core raster assets listed in [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md).
