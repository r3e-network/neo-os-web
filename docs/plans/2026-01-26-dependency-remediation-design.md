# Dependency Remediation Design

**Goal:** Eliminate all current Dependabot alerts (critical, moderate, low) while preserving build stability across the monorepo.

**Scope:** Root workspace and all Node workspaces (host app, admin console, mobile wallet, shared packages, SDK). Go modules are verified but not upgraded in this pass.

## Approach

### 1) Audit-driven upgrades
- Run `pnpm audit --json` at the repo root to capture the full advisory set.
- Split advisories into direct vs transitive dependencies.
- For direct dependencies, upgrade to the latest safe versions (including majors if required).
- For transitive-only advisories without a parent upgrade path, use root `pnpm.overrides` to pin patched versions.

### 2) Minimize churn
- Prefer upgrading parent packages over deep overrides when possible.
- Limit overrides to the smallest compatible version range needed.
- Avoid unrelated refactors; only adjust code/config when required by a major upgrade.

### 3) Verification gates
- Re-run `pnpm audit --json` until critical/moderate alerts are cleared (and aim to clear all severities).
- Run local validation in this order:
  1. `pnpm test`
  2. `pnpm build`
  3. `go test ./...`
  4. `go build ./...`

### 4) Documentation
- Record the upgraded packages and any overrides added.
- Note any required code/config adjustments caused by major upgrades.

## Guardrails
- Keep changes focused to dependency/version updates and strictly necessary compatibility fixes.
- Avoid touching unrelated lockfiles or user files.
- Preserve existing tool versions unless a security fix requires change.
