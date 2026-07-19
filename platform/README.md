# R3E MiniApps Platform Architecture

This workspace contains the complete stack for the R3E MiniApps ecosystem, built around an advanced dynamic data-driven rendering engine and polymorphic template architecture.

## Overview

The platform allows configuring complex decentralized applications (MiniApps) like Polymarket, Lotteries, and DAOs entirely through JSON configuration without writing a single line of frontend or contract code per app.

## Directory Structure

- **`host-app/`**: Next.js host shell. It renders MiniApp manifests, native playareas, operation sidebars, NEP-21 wallet login, and real chain/oracle/AA data surfaces.
- **`admin-console/`**: React-based operations console for manifest review, service health, templates, media reports, and production readiness checks.
- **`edge/`**: Supabase Edge Functions handling routing, limits, anti-abuse, social auth sync, and wallet nonce derivations for Neo N3 plus embedded EVM-format signers.
- **`sdk/`**: Client side SDK enabling direct integrations.
- **Manifest runtime + native playareas**: the host runtime loads MiniApps from manifests and renders them through shared platform panels plus per-app host-native playareas.

## Core Concepts

### 1. MiniApp Catalog Studio
MiniApps are managed through manifests, native playareas, staged standalone dApps,
and production catalog metadata. Operators use `admin-console` to review and
publish those assets instead of relying on static demo templates.

### 2. Neo Wallet Auth
`host-app` handles universal login:
- OneGate through the shared NEP-21 dAPI provider
- NeoLine through the same NEP-21 dAPI provider path
- direct WIF only for local/testnet validation tooling

### 3. Platform Domain Contracts
Current production contracts live under `/contracts/platform/` and are split
into partial C# files by business workflow so that anchor, DeFi, game, and
social logic stay reviewable.

The next contract evolution is documented in
[`docs/platform-contract-library-v2.md`](../docs/platform-contract-library-v2.md)
(Platform Contract Library v2): a registry-anchored engine estate where apps
register on PlatformRegistry, receive a minted AppAccount treasury contract,
and bind to shared engines as validated descriptor rows instead of deploying
dedicated per-app contracts. The first slice (PlatformRegistry + AppAccount)
landed 2026-07-16/17; the legacy per-app `MiniApp*` contracts are absorbed
cohort by cohort.

The matching frontend/contract symmetry model was documented in the now-deprecated
[`_archive/COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md`](./_archive/COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md)
(v1 composable module architecture, superseded by MiniApp-OS v2; see
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the current design).
