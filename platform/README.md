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
[`contracts/MiniAppFactory/MODULAR_CAPABILITY_COMPOSITION_ARCHITECTURE.md`](../contracts/MiniAppFactory/MODULAR_CAPABILITY_COMPOSITION_ARCHITECTURE.md):

- `NeoPay` is the reference `shared`-mode example, where one app instance binds reusable
  `funding_vault` + `stream_vesting` modules with no dedicated business contract deployment.
- `GASBox` is the reference `router`-mode example, where a thin generated orchestrator keeps
  inventory, randomness, escrow, and settlement atomic while still reusing shared modules.

The matching frontend/contract symmetry model is documented in
[`COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md`](./COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md).
