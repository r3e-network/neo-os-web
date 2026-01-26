# Repo Quality Review and Cleanup Design

**Goal:** Make the repo production-ready and professional by removing unused/outdated artifacts, reducing duplication, aligning structure, and validating build/test flow with a focus on the miniapp platform while covering the whole repo.

**Scope:** Entire repo (platform apps, packages, services, infra, scripts, docs). Balanced cleanup: remove clearly unused/outdated files with evidence, consolidate obvious duplication, and make light structural improvements without large moves or risky churn.

## Review + Inventory

- Build a precise inventory of repo areas, focusing on generated/stale artifacts, duplicate utilities, and inconsistent patterns.
- Classify candidates into:
  - Safe deletes (no references + generated/stale)
  - Risky deletes (no references but uncertain)
  - Consolidation targets (shared logic duplicated across zones)
- Preserve a do-not-touch list for intentional artifacts (e.g., secrets/infra assets).
- Capture baseline build/test status and failures for debugging inputs.

## Cleanup + Architecture Alignment

- Map structure to intended ownership zones and verify conventions for config/build/docs.
- Remove unused/outdated files only with evidence (no imports, no scripts, no docs, not required for deploy).
- Consolidate duplication into shared modules or documented patterns when safe.
- Keep structural changes light; prefer within-folder reorganizations over large moves.
- Verify miniapp layout logic: web layout for web host, mobile layout for wallet.

## Validation + Debugging

- Run baseline build/test locally; reproduce any failures and follow systematic debugging (single hypothesis, minimal change).
- Use TDD for behavioral fixes (failing test first, minimal code to pass).
- Stage cleanup changes incrementally with focused test coverage.
- Only push after local build/test passes and repo is clean.

## Success Criteria

- No unused or outdated files left in the repo within defined scope.
- Reduced duplication where safe without regressions.
- Local build and tests pass.
- Miniapp layout behaves correctly on web and mobile targets.
- Documentation and build flow match admin workflow (download, review, build, upload).
