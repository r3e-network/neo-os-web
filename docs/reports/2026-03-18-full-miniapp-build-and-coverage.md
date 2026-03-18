# 2026-03-18 Full MiniApp Build And Coverage Audit

This report captures a full catalog frontend build sweep and coverage
classification snapshot for the `neo-miniapps-platform` repository on
2026-03-18.

## Scope

Two repository-wide checks were run:

1. full frontend build sweep across every `apps/*` package with a `build` script
2. catalog / contract coverage audit via `deploy/scripts/audit_all_miniapp_coverage.js`

## Frontend Build Sweep

Validation approach:

- enumerate every `apps/*/package.json`
- run `npm --prefix apps/<name> run build`
- record pass/fail and short tail output

Build sweep result:

- total `apps/*` packages with `package.json`: `53`
- build failures: `0`
- `shared/` was skipped because it has no standalone build script

All shipped miniapp frontends successfully built, including:

- flagship apps
- AA tools
- Oracle tools
- secondary and non-flagship apps

## Non-Blocking Build Warnings Observed

The build sweep surfaced a few warnings that did **not** block output generation:

- Sass deprecation warnings in:
  - `fogplay`
  - `soulbound-certificate`
  - `timestamp-proof`
- chunk-size / dynamic-import warnings in:
  - `neo-convert`
  - `neo-swap`
  - `neoburger`

These are optimization / maintenance issues, not current functional blockers.

## MiniApp Coverage Classification

Coverage audit summary:

- `frontend-only`: `18`
- `testnet+mainnet`: `20`
- `testnet-only`: `5`
- `mainnet-only-no-source`: `3`

Current manifest count:

- `52` miniapp manifests under `apps/*`

Current package count:

- `53` app packages under `apps/*`
- the additional package is `apps/shared`

## Interpretation

### Frontend-only tools

These apps intentionally have no owned contract in this repository and instead
act as integration consoles or utilities. Examples include:

- AA tools
- Oracle tools
- Neo X bridge launcher
- Flamingo product launchers
- explorer / wallet-health style tools

### testnet+mainnet apps

These are the strongest current production candidates because they have:

- source present in this repository
- deployed contracts on both networks
- active host manifest / definition entries

### testnet-only apps

These apps are present and build cleanly, but are not yet deployed on mainnet.
Current examples include:

- `event-ticket-pass`
- `milestone-escrow`
- `quadratic-funding`
- `soulbound-certificate`
- `trustanchor`

### mainnet-only-no-source

These are integration surfaces where the manifest points to a mainnet contract
that is not owned by this repository’s contract source tree. Current examples:

- `forever-album`
- `neo-swap`
- `neoburger`

They are not immediate frontend blockers, but they are not part of the
same-source compile/deploy loop used by the flagship contracts.

## Current Assessment

As of 2026-03-18:

- all miniapp frontends in this repository build successfully
- flagship testnet and mainnet validation is already in place
- Oracle / AA tool miniapps build successfully and participate in the current
  integration surface
- remaining catalog work is now mostly about:
  - deeper non-flagship live flow validation
  - resolving non-blocking frontend warnings
  - deciding which testnet-only apps should be promoted to mainnet
  - deciding how to treat mainnet-only integrations that do not have owned
    contract source in this repository
