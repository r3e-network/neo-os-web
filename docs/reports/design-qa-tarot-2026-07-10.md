# Design QA — On-Chain Tarot, option 3

- Date: 2026-07-10
- Result: passed
- Scope: local guest ritual only; GameFi remains fail-closed pending an authoritative contract/domain deployment and historical-credit recovery decision.
- Reference: `/Users/jinghuiliao/.codex/generated_images/019f4a42-0f2c-76c1-8a56-5629cbe7670e/exec-13820112-db99-4dd9-8702-479eb6021b2d.png`
- Primary viewport: 390 × 844
- Short viewport: 320 × 568

## Visual comparison

- Same-state, same-viewport combined comparison: `/tmp/neo-miniapps-phaser-audit-2026-07-10/on-chain-tarot/56-option3-final-reference-comparison.png`
- Final idle state: `/tmp/neo-miniapps-phaser-audit-2026-07-10/on-chain-tarot/55-option3-handoff-390x844.png`
- Final revealed state: `/tmp/neo-miniapps-phaser-audit-2026-07-10/on-chain-tarot/53-option3-final-complete-zh.png`
- Short-mobile state: `/tmp/neo-miniapps-phaser-audit-2026-07-10/on-chain-tarot/54-option3-short-320x568-final.png`

The implementation matches the selected bright ritual-table direction: warm daylight palette, clear foreground/background separation, three tactile intent tokens, three physical cards, a single dominant action, restrained secondary help, and no form-style interaction. Chinese card names, ARIA labels, and copied readings use the same localized card identity.

## Interaction and recovery checks

- Intent selection → local secure shuffle → 0/3 dealt → single-card flip 1/3 → reveal all 3/3 → new reading: passed.
- Atomic reveal-all action leaves the spread at exactly 3/3: passed.
- Help drawer opens and closes with Escape; focus-return behavior is covered by the DOM regression test: passed.
- 320 × 568 micro-layout keeps intent tokens, three cards, progress, CTA, and help visible without overlap: passed.
- Dynamic reduced-motion settles active deal/flip/celebration tweens to authoritative state: passed by scene regression tests.
- Critical ritual assets retry twice, then expose matching Canvas and semantic DOM recovery paths while disabling hidden normal actions: passed by scene/shared tests.
- Fresh in-app-browser warning/error log count after the final flow: 0.

## Iterations made from comparison

1. Replaced the generic launcher/form surface with direct play and real ritual/card/token assets.
2. Added circular token masks, selected-path connectors, deal/flip/reveal motion, and a single visual hierarchy.
3. Fixed double dispatch, non-atomic reveal, tween conflicts, resize replay, short-screen footer clipping, and square token backgrounds.
4. Added 78-card zh/en localization, secure unbiased local randomness, storage fail-soft behavior, resource recovery, roving radio controls, focus restoration, and localized sound/error copy.

## Release boundary

The visual and local guest experience passes this design QA. Paid GameFi is intentionally not advertised or reachable because the legacy manifest address and current domain binding are not an authoritative compatible pair. A recovery-only wallet path must not be enabled until the exact historical contract and balances are verified.
