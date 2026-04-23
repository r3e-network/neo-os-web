# R3E MiniApps Platform Architecture

This workspace contains the complete stack for the R3E MiniApps ecosystem, built around an advanced dynamic data-driven rendering engine and polymorphic template architecture.

## Overview

The platform allows configuring complex decentralized applications (MiniApps) like Polymarket, Lotteries, and DAOs entirely through JSON configuration without writing a single line of frontend or contract code per app.

## Directory Structure

- **`host-app/`**: Next.js-based dynamic rendering host. Fetches JSON configurations and dynamically instantiates Polymarket-styled layouts, interactive operation sidebars, and wallet authenticators for Auth0 social login plus Neo N3 wallet extensions.
- **`admin-console/`**: React-based zero-code DApp issuer. Features a built-in Template Marketplace to assemble app manifests visually and interact with contract templates dynamically via JSON Schema rendering.
- **`edge/`**: Supabase Edge Functions handling routing, limits, anti-abuse, Auth0 sync, and wallet nonce derivations for Neo N3 plus embedded EVM-format signers.
- **`sdk/`**: Client side SDK enabling direct integrations.
- **Manifest runtime + external remotes**: the host runtime now loads MiniApps from manifests (and optional external Module Federation remotes) without a dedicated legacy local remote workspace.

## Core Concepts

### 1. Template Marketplace
All applications are built from atomic Contract and Frontend templates. 
Users use `admin-console` to browse and configure these. 
Configs are pushed to `miniapp-definitions/` and the DB.

### 2. Cross-Chain Wallet Auth
`host-app` handles universal login:
- Social (Google/GitHub) via Auth0 -> Hosted Wallet
- Neo N3 Ecosystem Wallets
- Auth0 social login plus Neo N3 extension wallets

### 3. Smart Contract Factories
Found in `/contracts/MiniAppTemplates/`.
Generic, parameter-driven C# contracts (`Template.Prediction.cs`, `Template.Lottery.cs`) handle arbitrary state for specific templates without requiring individual contract deployments.

The next contract evolution is documented in
[`contracts/MiniAppFactory/MODULAR_CAPABILITY_COMPOSITION_ARCHITECTURE.md`](../contracts/MiniAppFactory/MODULAR_CAPABILITY_COMPOSITION_ARCHITECTURE.md):

- `NeoPay` is the reference `shared`-mode example, where one app instance binds reusable
  `funding_vault` + `stream_vesting` modules with no dedicated business contract deployment.
- `GASBox` is the reference `router`-mode example, where a thin generated orchestrator keeps
  inventory, randomness, escrow, and settlement atomic while still reusing shared modules.

The matching frontend/contract symmetry model is documented in
[`COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md`](./COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md).
