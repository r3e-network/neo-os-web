# Getting Started

This guide helps you get started with the Neo MiniApp Platform.

## Prerequisites

- Node.js 18+ and npm/pnpm
- Neo wallet (NeoLine, O3, or OneGate)
- Basic knowledge of React/Next.js

## Installation

```bash
# Clone the repository
git clone https://github.com/user/service_layer.git
cd service_layer/platform/host-app

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server (auto-copies miniapps + registry)
pnpm dev
```

## Environment Setup

Edit `.env.local` with your configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Connect Your Wallet

1. Install a Neo wallet browser extension
2. Click "Connect Wallet" in the navigation
3. Approve the connection request
4. Your address will appear in the header

## Explore MiniApps

1. Browse the homepage for featured apps
2. Use categories to filter by type
3. Click any app to launch it
4. Interact using your connected wallet

## Build or Submit a MiniApp (Submission Pipeline)

1. Build your MiniApp in your own repo and include a `neo-manifest.json`.
2. Submit the GitHub repo URL for review and approval.
3. Internal miniapps in `git@github.com:r3e-network/miniapps.git` are auto-approved.

Keep `app_id` aligned with your MiniApp `APP_ID` constant so SDK calls are scoped correctly.

## UniversalMiniApp Contract

All MiniApps can use the shared UniversalMiniApp contract. If you need on-chain
events or storage, set `contracts.<chain>.address` in `neo-manifest.json` to the UniversalMiniApp
hash for your network. Otherwise you can omit it and keep the MiniApp frontend-only.

## Next Steps

- [API Reference](./API.md) - Learn the REST API
- [SDK Guide](./SDK.md) - Build your own MiniApp
- [Architecture](./ARCHITECTURE.md) - Understand the system
