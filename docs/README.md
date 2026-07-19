# docs/ — documentation index

Canonical documentation tree for neo-miniapps-platform. Historical archives live under `archive/`; design references under `prototypes/`; current reports under `reports/`.

## Current

- `ARCHITECTURE.md` — MiniApp-OS v2 architecture (host shell, edge OS Binder, contract estate)
- `platform-contract-library-v2.md` — the registry-anchored engine estate design (the v2 target: register apps, mint per-app AppAccounts, shared engines)
- `DESIGN_LANGUAGE.md` / `DESIGN_SYSTEM.md` / `design-context-impeccable.md` — v4 design language, tokens, brand context
- `credit-system-design.md`, `framework-evolution-rfc.md`, `guest-mode-adoption.md`, `game-miniapps-design.md` — subsystem designs
- `examples/`, `superpowers/` (specs + plans for the joint program), `reports/` (audit/baseline/verification reports)

## Reports (reports/)

- `joint-audit-2026-07.md` — three-repo joint audit (41 findings: fixes, pins, verdicts)
- `joint-baseline-2026-07-18.md` — Phase 0 baselines + drift-resolution log
- `audit-findings-2026-07/` — machine-readable findings (miniapps/morpheus/aa JSON + duplication census)
- `design-qa-tarot-2026-07-10.md` — On-Chain Tarot design QA record

## Archives (archive/)

- `archive/claudedocs/` — the former root `claudedocs/` tree (consolidated 2026-07-18; includes the contract-estate census and session reports)
- `archive/platform/` — platform-era architecture records
- `archive/` (root subdir of this folder) — older archived docs

## Prototypes (prototypes/)

- HTML design prototypes (admin-console, platform/miniapp homepages, miniapp template) + zhuada-e design docs (audit guide, GDD)

## Conventions

- New design specs go to `superpowers/specs/`, implementation plans to `superpowers/plans/`.
- New verification/audit outputs go to `reports/` (never to the repo root).
- Do not create new root-level `*.md` files outside this tree without updating this index.
