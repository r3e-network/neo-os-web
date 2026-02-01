# Dependabot Alerts Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all open GitHub Dependabot alerts by eliminating obsolete npm lockfiles in pnpm-managed packages and re-verifying security status.

**Architecture:** Dependabot is reporting open alerts only from `package-lock.json` files in pnpm-managed workspaces. We will delete those tracked lockfiles (root `.gitignore` already ignores them), then re-check alerts and run the standard verification suite.

**Tech Stack:** pnpm, GitHub CLI (`gh`), Go toolchain

### Task 1: Capture open Dependabot alerts baseline

**Files:**
- Modify: none

**Step 1: List open alerts (expected count: 6)**

Run:
```bash
gh api -H "Accept: application/vnd.github+json" /repos/r3e-network/neo-miniapps-platform/dependabot/alerts --paginate -q '.[] | select(.state=="open") | {number, dependency:.dependency.package.name, ecosystem:.dependency.package.ecosystem, severity:.security_advisory.severity, vulnerable:.security_vulnerability.vulnerable_version_range, first_patched:(.security_vulnerability.first_patched_version.identifier // ""), manifest:.dependency.manifest_path}'
```
Expected: Only npm alerts in `package-lock.json` files for `platform/host-app`, `platform/mobile-wallet`, and `packages/@neo/uniapp-sdk`.

### Task 2: Remove obsolete npm lockfiles

**Files:**
- Delete: `platform/host-app/package-lock.json`
- Delete: `platform/mobile-wallet/package-lock.json`
- Delete: `packages/@neo/uniapp-sdk/package-lock.json`

**Step 1: Remove tracked lockfiles**

Run:
```bash
git rm platform/host-app/package-lock.json \
  platform/mobile-wallet/package-lock.json \
  packages/@neo/uniapp-sdk/package-lock.json
```
Expected: three deletions staged.

### Task 3: Re-check Dependabot alerts

**Files:**
- Modify: none

**Step 1: Re-run open alert query**

Run:
```bash
gh api -H "Accept: application/vnd.github+json" /repos/r3e-network/neo-miniapps-platform/dependabot/alerts --paginate -q 'map(select(.state=="open")) | length'
```
Expected: `0` on the first page and only `0` on subsequent pages.

### Task 4: Verify test/build suite

**Files:**
- Modify: none

**Step 1: Run JS tests**

Run: `pnpm test`  
Expected: PASS (no failures).

**Step 2: Run JS build**

Run: `pnpm build`  
Expected: PASS (no build failures).

**Step 3: Run Go tests**

Run: `go test ./...`  
Expected: PASS.

**Step 4: Run Go build**

Run: `go build ./...`  
Expected: PASS.

### Task 5: Commit remediation changes

**Files:**
- Delete: `platform/host-app/package-lock.json`
- Delete: `platform/mobile-wallet/package-lock.json`
- Delete: `packages/@neo/uniapp-sdk/package-lock.json`

**Step 1: Commit**

```bash
git commit -m "chore: remove obsolete npm lockfiles"
```
