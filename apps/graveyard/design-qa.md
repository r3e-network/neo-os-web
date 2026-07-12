# Graveyard design QA

Date: 2026-07-11  
Prototype: `http://127.0.0.1:5271/`  
Selected concept: `/Users/jinghuiliao/.codex/generated_images/019f4b9f-157a-73d0-942d-e96920706a8d/exec-a697d695-fb91-4266-af3c-dbef5e46bf89.png`

## Verification environment

- Browser path: the in-app browser binding was unavailable (`Browser is not available: iab`), so the existing persistent Browser/Chrome binding was used.
- Viewports: 390 × 844 mobile and 1280 × 900 desktop.
- Same-state visual comparison: selected concept and the ready mobile implementation were placed side-by-side in `/tmp/graveyard-design-comparison-final.png` and inspected together with `view_image`.
- Additional evidence: `/tmp/graveyard-qa-mobile-ready.png`, `/tmp/graveyard-qa-confirm-final.png`, `/tmp/graveyard-qa-desktop-final.png`, and `/tmp/graveyard-qa-records.png`.

## Fidelity ledger

| Comparison point | Concept evidence | Render evidence | Result |
|---|---|---|---|
| Primary hierarchy | Sunlit garden and central memorial lead into one ritual | Generated garden occupies the first stage; digest seal sits over the plinth; one dark-moss review CTA dominates | Passed |
| Memory source | Three code-native source tabs | Private note, local file, and existing hash tabs are visible and interactive at both viewports | Passed |
| Artifact treatment | Ivory folded letter with botanical wax seal | Dedicated generated paper/wax-seal runtime asset carries the real textarea/file/hash controls | Passed |
| Memory types | Five tactile material tokens with clear selected state | Five warm material tokens use distinct Lucide metaphors, visible labels, border, elevation, and check state | Passed |
| Privacy and contrast | Opaque light surfaces over warm imagery, dark green copy | Header plaque, digest seal, paper, privacy strip, and fee rail preserve readable contrast; no text sits directly on a noisy image | Passed |
| Fee hierarchy | Bury-now and forget-later costs before the CTA | Live burial/forget fee displays and official GAS art remain visible on mobile before review | Passed |
| Responsive first viewport | Core task and CTA visible in the mobile composition | Mobile spacing was compressed after comparison; the enabled review CTA now fits in the 390 × 844 first viewport | Passed |
| Confirmation state | Deliberate review before signing | Bottom-sheet dialog shows digest, type, fee, wallet route, three transaction stages, permanence, and event-gated success copy | Passed |

## Material mismatches fixed during QA

1. Initial implementation pushed the primary CTA below the mobile first viewport. Hero, letter, token, and review spacing were tightened without removing information.
2. Wallet and digest status initially consumed two tall rows. They now form a compact two-column review strip on mobile.
3. The original mobile surface hid fee review entirely. The redesigned fee rail stays present at every breakpoint.

## Intentional, requirement-driven deviations

- Wallet and digest readiness are explicit compact tiles even though the concept did not show both; they are required to make the paid chain action recoverable and unambiguous.
- The note limit is 2,000 characters rather than the concept's decorative 120-character count. Only its SHA-256 digest reaches the contract, so an arbitrary 120-character product restriction was not introduced.
- History and epitaphs share one progressively disclosed records surface instead of two equal primary actions.

## Functional QA

- Page identity: `http://127.0.0.1:5271/`, title `Graveyard`.
- Meaningful DOM and generated assets loaded: garden 1440 × 1080, letter 1440 × 810, official GAS art 150 × 150.
- No horizontal overflow at 1280 px (`scrollWidth === clientWidth`).
- Private note produced a real 64-character digest and enabled Review burial.
- `0x`-prefixed uppercase SHA-256 was normalized to lowercase without rehashing.
- Escape dismissed the confirmation dialog without dispatching the paid action.
- The confirmation now traps keyboard focus, restores it on close, and sends no raw private note in the final paid-action payload.
- Records opened progressively and showed wallet-scoped empty-state guidance.
- Fresh reload produced no app-origin warnings or errors; observed warnings came only from a wallet browser extension.
- Local-file selection surface was browser-verified; binary file hashing and invalid-file replacement are covered by the Graveyard logic test suite because the Browser binding does not expose file-input upload automation.
- Live wallet signatures and TestNet transactions were intentionally not sent in this lane.

## Automated checks

- Graveyard TypeScript: passed.
- Graveyard production build: passed.
- Scoped ESLint: passed.
- Graveyard logic/playarea/integration tests: 46 passed, including paused-contract gating, full event-identity matching, persisted prepaid-credit recovery, duplicate-payment blocking, wallet-scope clearing, unverified-event, live-fee, and fee-change re-confirmation coverage.
- The app no longer emits the unused shared v2/Semi theme from `PlayArea.scss`; production CSS is 90.28 kB (16.69 kB gzip), including the explicit prepaid-recovery state. All Graveyard class selectors are referenced by the current PlayArea rather than retained legacy decoration.
- Static contrast assertions cover the primary ink, muted copy, letter placeholder/count, fee helper, recovery status, and primary action pairs at WCAG AA (4.5:1 or higher).
- The public manifest exposes an empty operation list, preventing the host from rebuilding the ritual as a duplicate generic parameter form.

## Post-capture safety delta

The visual captures above remain historical reference evidence only. The follow-up changes add a compact recovery strip, paused-contract copy, safer default focus, and stronger small-copy colors. This lane did not have the requested in-app browser surface and did not substitute Playwright or Chrome, so a fresh same-viewport screenshot comparison remains required before platform-wide visual sign-off.

Above-the-fold copy diff: passed. Visible copy is the bilingual implementation of the selected concept plus required wallet, privacy, fee, permanence, and recovery boundaries; no unrelated claims or marketing sections were added.

Functional/static result: passed. Fresh visual sign-off: pending IAB availability.
