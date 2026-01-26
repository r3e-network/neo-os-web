# Dependabot Alerts Remediation Design

**Goal:** Eliminate all open GitHub Dependabot alerts (critical/moderate/low) across npm/pnpm, Go modules, GitHub Actions, and Docker (if present) while keeping builds/tests green.

**Scope:** Entire monorepo and CI pipelines, using GitHub Dependabot alerts as the source of truth.

## Section 1: Discovery, Triage, and Remediation Loop

We will treat GitHub Dependabot as authoritative. First, pull open alerts via `gh api` and capture key metadata: ecosystem, package, severity, vulnerable range, fixed version, and whether the dependency is direct or transitive. We will normalize this into a remediation matrix grouped by ecosystem (npm/pnpm, Go modules, GitHub Actions, Docker) and then by direct vs transitive.

For npm/pnpm, we will identify direct parent dependencies in the root or workspace `package.json` files, prefer upgrading parents over overrides, and only use root `pnpm.overrides` when there is no safe upgrade path. For Go modules, we will map advisories to module paths and plan `go get` updates. For GitHub Actions, we will bump action tags to patched releases (pin full `vX.Y.Z` when possible). For Docker (if alerts exist), we will update base image tags to patched versions.

After each batch of changes, we will re-run the `gh api` alert query and local audits to confirm the alert count drops. The loop continues until GitHub shows zero open alerts. If any alert lacks a viable patch, we will document the constraint and propose the narrowest mitigation.

## Section 2: Execution, Verification, and Rollback

We will execute in small, isolated batches by ecosystem to reduce risk and keep changes reviewable. For npm/pnpm, update one workspace or a shared dependency set at a time and regenerate `pnpm-lock.yaml`. If a major upgrade is required, we will apply only the minimal compatibility changes needed to keep builds/tests green. For Go modules, use `go get` followed by `go mod tidy`. For GitHub Actions, update tags to patched versions and avoid floating `@main`.

Verification after each batch (order matters):
1. `pnpm test`
2. `pnpm build`
3. `go test ./...`
4. `go build ./...`
5. `pnpm audit --json`
6. Re-check `gh api` Dependabot alerts

For rollback, keep commits small (one batch per commit). If a batch introduces regressions, pin to the last safe version or split into smaller changes until the problematic upgrade is isolated.

Completion criteria: GitHub Dependabot shows zero open alerts, local verification is green, and all remediation steps are documented.
