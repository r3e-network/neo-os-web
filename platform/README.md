# R3E MiniApps Platform Architecture

This workspace contains the complete stack for the R3E MiniApps ecosystem, built around an advanced dynamic data-driven rendering engine and polymorphic template architecture.

## Overview

The platform allows configuring complex decentralized applications (MiniApps) like Polymarket, Lotteries, and DAOs entirely through JSON configuration without writing a single line of frontend or contract code per app.

## Directory Structure

- **`host-app/`**: Next.js-based dynamic rendering host. Fetches JSON configurations and dynamically instantiates Polymarket-styled layouts, interactive operation sidebars, and multi-chain wallet authenticators (Auth0 + N3 + Neo X).
- **`admin-console/`**: React-based zero-code DApp issuer. Features a built-in Template Marketplace to assemble app manifests visually and interact with contract templates dynamically via JSON Schema rendering.
- **`edge/`**: Supabase Edge Functions handling routing, limits, anti-abuse, Auth0 sync, and NeoX/N3 nonce derivations.
- **`sdk/`**: Client side SDK enabling direct integrations.
- **`builtin-app/`**: Legacy Micro-Frontends (Being phased out in favor of the new JSON-driven Host app).

## Core Concepts

### 1. Template Marketplace
All applications are built from atomic Contract and Frontend templates. 
Users use `admin-console` to browse and configure these. 
Configs are pushed to `miniapp-definitions/` and the DB.

### 2. Cross-Chain Wallet Auth
`host-app` handles universal login:
- Social (Google/GitHub) via Auth0 -> Hosted Wallet
- Neo N3 Ecosystem Wallets
- Neo X (EVM) via MetaMask `NeoXConnect.ts`

### 3. Smart Contract Factories
Found in `/contracts/MiniAppTemplates/`.
Generic, parameter-driven C# contracts (`Template.Prediction.cs`, `Template.Lottery.cs`) handle arbitrary state for specific templates without requiring individual contract deployments.